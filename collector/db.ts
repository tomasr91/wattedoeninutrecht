/**
 * SQLite-opslag via de ingebouwde node:sqlite (Node ≥ 22.13), zonder native
 * dependencies. Het databasebestand (data/agenda.sqlite) wordt door de
 * wekelijkse workflow in de repository bijgewerkt, zodat de historie bewaard blijft.
 */
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StoredActivity } from '../src/domain/reconcile.ts';
import { sourceKey } from '../src/domain/reconcile.ts';
import { activityEndDate } from '../src/domain/filters.ts';
import type { SourceRunStatus } from '../src/domain/types.ts';

export type Db = DatabaseSync;

export function openDb(file: string, migrationsDir: string): Db {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;');
  migrate(db, migrationsDir);
  return db;
}

export function migrate(db: Db, dir: string): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: string }[]).map((r) => r.version));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(join(dir, f), 'utf8'));
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(f, new Date().toISOString());
      db.exec('COMMIT');
      applied.push(f);
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migratie ${f} mislukt: ${(e as Error).message}`);
    }
  }
  return applied;
}

export function loadActivities(db: Db): StoredActivity[] {
  const rows = db.prepare('SELECT data, content_hash, missing_count FROM activities').all() as {
    data: string;
    content_hash: string;
    missing_count: number;
  }[];
  return rows.map((r) => ({ ...JSON.parse(r.data), contentHash: r.content_hash, missingCount: r.missing_count }));
}

export function saveActivities(db: Db, list: StoredActivity[], nowIso: string): void {
  const upsert = db.prepare(`
    INSERT INTO activities (source_key, id, source_id, start_date, end_date, status, content_hash, missing_count, data, updated_at, audiences, min_age_months, zone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      id = excluded.id, start_date = excluded.start_date, end_date = excluded.end_date, status = excluded.status,
      content_hash = excluded.content_hash, missing_count = excluded.missing_count, data = excluded.data,
      updated_at = excluded.updated_at, audiences = excluded.audiences, min_age_months = excluded.min_age_months, zone = excluded.zone
  `);
  db.exec('BEGIN');
  try {
    for (const a of list) {
      const { contentHash, missingCount, ...activity } = a;
      upsert.run(
        sourceKey(a),
        a.id,
        a.sources[0].sourceId,
        a.start.slice(0, 10),
        activityEndDate(a),
        a.status,
        contentHash,
        missingCount,
        JSON.stringify(activity),
        nowIso,
        a.audiences.join(','),
        a.age.officialMinMonths ?? a.age.estimatedMinMonths ?? null,
        a.zone,
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Ruim activiteiten op die langer dan `days` dagen verlopen zijn (historie blijft beperkt). */
export function deleteActivities(db: Db, keys: string[]): number {
  const del = db.prepare('DELETE FROM activities WHERE source_key = ?');
  let n = 0;
  for (const k of keys) n += Number(del.run(k).changes);
  return n;
}

export function pruneExpired(db: Db, beforeDate: string): number {
  const r = db.prepare("DELETE FROM activities WHERE status = 'verlopen' AND end_date < ?").run(beforeDate);
  return Number(r.changes);
}

export function upsertSource(db: Db, s: { id: string; name: string; method: string; homepage: string; description: string; enabled: boolean }): void {
  db.prepare(`
    INSERT INTO sources (id, name, method, homepage, description, enabled) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, method = excluded.method, homepage = excluded.homepage,
      description = excluded.description, enabled = excluded.enabled
  `).run(s.id, s.name, s.method, s.homepage, s.description, s.enabled ? 1 : 0);
}

export function recordSourceRun(db: Db, id: string, r: { ok: boolean; at: string; count: number; error?: string; notes?: string }): void {
  if (r.ok) {
    db.prepare('UPDATE sources SET last_attempt = ?, last_success = ?, last_error = NULL, failing_since = NULL, last_count = ?, notes = ? WHERE id = ?').run(
      r.at, r.at, r.count, r.notes ?? null, id,
    );
  } else {
    db.prepare('UPDATE sources SET last_attempt = ?, last_error = ?, failing_since = COALESCE(failing_since, ?), notes = ? WHERE id = ?').run(r.at, r.error ?? 'onbekende fout', r.at, r.notes ?? null, id);
  }
}

export function sourceStatuses(db: Db): SourceRunStatus[] {
  const rows = db.prepare('SELECT * FROM sources ORDER BY id').all() as Record<string, unknown>[];
  return rows.map((r) => ({
    sourceId: String(r.id),
    sourceName: String(r.name),
    enabled: r.enabled === 1,
    ok: r.last_error === null && r.last_success !== null,
    lastAttempt: (r.last_attempt as string) ?? undefined,
    lastSuccess: (r.last_success as string) ?? undefined,
    failingSince: (r.failing_since as string) ?? undefined,
    fetched: Number(r.last_count ?? 0),
    error: (r.last_error as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
  }));
}

export function startRun(db: Db, at: string): number {
  return Number(db.prepare('INSERT INTO runs (started_at) VALUES (?)').run(at).lastInsertRowid);
}

export function finishRun(db: Db, id: number, r: { ok: boolean; at: string; stats: unknown; log: string }): void {
  db.prepare('UPDATE runs SET finished_at = ?, ok = ?, stats = ?, log = ? WHERE id = ?').run(r.at, r.ok ? 1 : 0, JSON.stringify(r.stats), r.log, id);
}

export function lastSuccessfulRun(db: Db): string | undefined {
  const row = db.prepare('SELECT finished_at FROM runs WHERE ok = 1 AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1').get() as
    | { finished_at: string }
    | undefined;
  return row?.finished_at;
}

export function lastRun(db: Db): string | undefined {
  const row = db.prepare('SELECT finished_at FROM runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1').get() as
    | { finished_at: string }
    | undefined;
  return row?.finished_at;
}
