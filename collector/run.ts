/**
 * Wekelijkse update: bronnen ophalen → normaliseren → verwerken in SQLite →
 * ontdubbelen → exporteren naar public/data/*.json voor de app.
 *
 * Gebruik:
 *   npm run collect                 alle ingeschakelde bronnen
 *   npm run collect -- --source=bibliotheek-utrecht   (meerdere: --source=a,b)
 *   npm run collect:dry             ophalen en rapporteren, niets opslaan
 *   npm run export                  alleen opnieuw exporteren uit de database
 *
 * Exitcode 0 als minstens één bron slaagt (de rest wordt gelogd), anders 1.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dataset, UpdateStatus } from '../src/domain/types.ts';
import { addDays, addMonths, todayInAmsterdam } from '../src/domain/dates.ts';
import { reconcile, sourceKey, type SourceResult } from '../src/domain/reconcile.ts';
import { normalize } from './normalize.ts';
import { buildExport } from './export.ts';
import { computeExpected, type RecurringMoment } from '../src/domain/expected.ts';
import * as dbm from './db.ts';
import { notAnOuting } from './outings.ts';
import type { DetailCache } from './adapters/types.ts';
import { geocodeAddressesPdok, geocodeMissing, geocodingEnabled } from './geocode.ts';
import type { SourceAdapter } from './adapters/types.ts';
import { uitagendaUtrecht } from './adapters/uitagenda-utrecht.ts';
import { bibliotheekUtrecht } from './adapters/bibliotheek-utrecht.ts';
import { podiumHogeWoerd } from './adapters/podium-hoge-woerd.ts';
import { curatedAdapter, pruneCuratedFiles } from './adapters/curated.ts';
import { tivoliVredenburg } from './adapters/tivolivredenburg.ts';
import { stadsschouwburgUtrecht } from './adapters/stadsschouwburg-utrecht.ts';
import { podiumSprits } from './adapters/podium-sprits.ts';
import { utrechtNatuurlijk } from './adapters/utrecht-natuurlijk.ts';
import { kasteelDeHaar } from './adapters/kasteel-de-haar.ts';
import { jaarbeurs } from './adapters/jaarbeurs.ts';
import { pathe } from './adapters/pathe.ts';
import { comedyhuis } from './adapters/comedyhuis.ts';
import { hofman } from './adapters/hofman.ts';
import { icalAdapter, jsonLdAdapter, tribeAdapter } from './adapters/generic.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const only = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
const dryRun = args.has('--dry-run');
const exportOnly = args.has('--export-only');

interface SourceConfig {
  id: string;
  enabled: boolean;
  type?: 'ical' | 'jsonld' | 'tribe';
  name?: string;
  homepage?: string;
  options?: Record<string, unknown>;
}
interface Config {
  windowMonths: number;
  windowMarginDays: number;
  maxDetailPagesPerSource: number;
  pruneExpiredAfterDays: number;
  sources: SourceConfig[];
}

const BUILT_IN: Record<string, SourceAdapter> = {
  'uitagenda-utrecht': uitagendaUtrecht,
  'bibliotheek-utrecht': bibliotheekUtrecht,
  'podium-hoge-woerd': podiumHogeWoerd,
  tivolivredenburg: tivoliVredenburg,
  'stadsschouwburg-utrecht': stadsschouwburgUtrecht,
  'podium-sprits': podiumSprits,
  'utrecht-natuurlijk': utrechtNatuurlijk,
  'kasteel-de-haar': kasteelDeHaar,
  jaarbeurs,
  pathe,
  comedyhuis,
  hofman,
  handmatig: curatedAdapter(join(ROOT, 'data', 'curated')),
};

function adapterFor(cfg: SourceConfig): SourceAdapter | undefined {
  if (cfg.type === 'ical') return icalAdapter({ id: cfg.id, name: cfg.name ?? cfg.id, homepage: cfg.homepage, options: cfg.options });
  if (cfg.type === 'tribe') return tribeAdapter({ id: cfg.id, name: cfg.name ?? cfg.id, homepage: cfg.homepage, options: cfg.options });
  if (cfg.type === 'jsonld') return jsonLdAdapter({ id: cfg.id, name: cfg.name ?? cfg.id, homepage: cfg.homepage, options: cfg.options });
  return BUILT_IN[cfg.id];
}

const logLines: string[] = [];
const log = (m: string) => {
  logLines.push(m);
  console.log(m);
};

function writeExport(db: dbm.Db, today: string, nowIso: string, totals: UpdateStatus['totals']) {
  const { activities, merged } = buildExport(dbm.loadActivities(db), today);
  const status: UpdateStatus = {
    lastSuccessfulRun: dbm.lastSuccessfulRun(db),
    lastRun: dbm.lastRun(db),
    sources: dbm.sourceStatuses(db),
    totals: { ...totals, active: activities.length, merged },
  };
  let expected: Dataset['expected'] = [];
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'data', 'vaste-momenten.json'), 'utf8')) as { horizonDays: number; moments: RecurringMoment[] };
    expected = computeExpected(cfg.moments, activities, today, cfg.horizonDays);
    for (const e of expected) log(`Komt eraan zonder datum in de agenda: ${e.name} (meestal ${e.whenText}, over ${e.inDays} dagen)`);
  } catch (e) {
    log(`! vaste-momenten.json niet te lezen: ${(e as Error).message}`);
  }
  const dataset: Dataset = { generatedAt: nowIso, activities, status, expected };
  const outDir = join(ROOT, 'public', 'data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'activities.json'), JSON.stringify(dataset));
  writeFileSync(join(outDir, 'status.json'), JSON.stringify(status, null, 2));
  log(`Export: ${activities.length} activiteiten (${merged} dubbele samengevoegd) → public/data/activities.json`);
}

async function main() {
  const config = JSON.parse(readFileSync(join(ROOT, 'collector', 'sources.config.json'), 'utf8')) as Config;
  const nowIso = new Date().toISOString();
  const today = process.env.TODAY_OVERRIDE ?? todayInAmsterdam();
  const until = addDays(addMonths(today, config.windowMonths), config.windowMarginDays);
  const db = dbm.openDb(process.env.DB_FILE ?? join(ROOT, 'data', 'agenda.sqlite'), join(ROOT, 'collector', 'migrations'));

  const zeroTotals = { active: 0, added: 0, updated: 0, cancelled: 0, expired: 0, merged: 0 };
  if (exportOnly) {
    writeExport(db, today, nowIso, zeroTotals);
    return 0;
  }

  log(`Update gestart ${nowIso} — venster ${today} t/m ${until}${dryRun ? ' (dry-run)' : ''}`);
  const runId = dryRun ? -1 : dbm.startRun(db, nowIso);
  const results: SourceResult[] = [];
  const okNames = new Map<string, { name: string; count: number }>();
  /** Items die een bron wel noemt maar die we bewust niet tonen: uit de database halen. */
  const dropKeys: string[] = [];

  for (const cfg of config.sources) {
    const adapter = adapterFor(cfg);
    if (!adapter) {
      log(`! Onbekende bron "${cfg.id}" in sources.config.json — overgeslagen`);
      continue;
    }
    if (!dryRun) {
      dbm.upsertSource(db, { id: adapter.id, name: adapter.name, method: adapter.method, homepage: adapter.homepage, description: adapter.description, enabled: cfg.enabled });
    }
    if (!cfg.enabled || (only && !only.split(',').includes(cfg.id))) continue;

    log(`→ ${adapter.name} (${adapter.id})`);
    const t0 = Date.now();
    try {
      const r = await adapter.run({
        today,
        until,
        nowIso,
        maxDetailPages: config.maxDetailPagesPerSource,
        cache: dryRun ? undefined : detailCache(db, adapter.id, nowIso),
        log,
        options: cfg.options ?? {},
      });
      let activities = r.events.map(normalize);
      // Optioneel per bron: alleen bepaalde doelgroepen (bv. de bibliotheek alleen voor kinderen).
      const only = cfg.options?.onlyAudiences as string[] | undefined;
      if (only?.length) {
        const dropped = activities.filter((a) => !a.audiences.some((x) => only.includes(x)));
        activities = activities.filter((a) => a.audiences.some((x) => only.includes(x)));
        dropKeys.push(...dropped.map(sourceKey));
      }
      // Geen uitjes (acties, campagnes, openingstijden van een zaak): bij elke run eruit.
      const excludeVenues = (cfg.options?.excludeVenues as string[] | undefined) ?? [];
      const notOutings = activities.filter((a) => notAnOuting(a, excludeVenues));
      if (notOutings.length) {
        log(`  ${notOutings.length} geen uitje: ${[...new Set(notOutings.map((a) => a.title))].slice(0, 8).join('; ')}`);
        activities = activities.filter((a) => !notAnOuting(a, excludeVenues));
        dropKeys.push(...notOutings.map(sourceKey));
      }
      results.push({ sourceId: adapter.id, ok: true, coverage: r.coverage, keepCheckedDates: r.keepCheckedDates, authoritative: r.authoritative, activities });
      okNames.set(adapter.id, { name: adapter.name, count: activities.length });
      log(`  ✓ ${activities.length} activiteiten in ${Math.round((Date.now() - t0) / 1000)}s${r.notes ? ` — ${r.notes}` : ''}`);
      if (!dryRun) dbm.recordSourceRun(db, adapter.id, { ok: true, at: nowIso, count: activities.length, notes: r.notes });
    } catch (e) {
      const msg = (e as Error).message ?? String(e);
      results.push({ sourceId: adapter.id, ok: false, error: msg, activities: [] });
      log(`  ✗ mislukt: ${msg} — eerder verzamelde gegevens blijven staan`);
      if (!dryRun) dbm.recordSourceRun(db, adapter.id, { ok: false, at: nowIso, count: 0, error: msg });
    }
  }

  // Handmatige kopieën van een bron die deze run zelf is gelukt, zijn dubbel: weglaten (en dus opruimen).
  const live = new Set([...okNames].filter(([id, v]) => id !== 'handmatig' && v.count > 0).map(([, v]) => v.name));
  const manual = results.find((r) => r.sourceId === 'handmatig' && r.ok);
  if (manual && live.size) {
    const before = manual.activities.length;
    manual.activities = manual.activities.filter((a) => !live.has(a.sources[0].sourceName));
    if (before !== manual.activities.length) log(`Handmatig: ${before - manual.activities.length} kopieën overgeslagen; die bronnen werkten zelf`);
  }

  const anyOk = results.some((r) => r.ok);
  const existing = dbm.loadActivities(db);
  const { activities: reconciled, stats, removed } = reconcile(existing, results, nowIso, today);
  // Bronnen die uit staan: hun activiteiten uit de app halen (alleen bij een volledige run).
  if (!only) {
    const disabled = new Set(config.sources.filter((c) => !c.enabled).map((c) => c.id));
    for (const a of reconciled) if (disabled.has(a.sources[0].sourceId)) dropKeys.push(sourceKey(a));
  }
  const dropSet = new Set(dropKeys);
  const activities = reconciled.filter((a) => !dropSet.has(sourceKey(a)));
  removed.push(...dropKeys);
  {
    const n = await geocodeAddressesPdok(db, activities, log);
    log(`Adressen (PDOK): ${n} locaties aangevuld`);
  }
  if (geocodingEnabled()) {
    const n = await geocodeMissing(db, activities, log);
    log(`Geocodering: ${n} locaties aangevuld`);
  }
  log(`Resultaat: +${stats.added} nieuw, ${stats.updated} gewijzigd, ${stats.unchanged} ongewijzigd, ${stats.cancelled} geannuleerd, ${stats.expired} verlopen, ${stats.missing} niet meer gevonden`);

  if (dryRun) {
    log('Dry-run: niets opgeslagen.');
    return anyOk ? 0 : 1;
  }
  dbm.saveActivities(db, activities, nowIso);
  // Opgeslagen detailpagina's die al een maand niet meer gebruikt zijn: opruimen.
  db.prepare('DELETE FROM detail_cache WHERE fetched_at < ?').run(new Date(Date.parse(nowIso) - 30 * 86400000).toISOString());
  if (live.size) {
    const n = pruneCuratedFiles(join(ROOT, 'data', 'curated'), live);
    if (n) log(`Handmatige bestanden opgeschoond: ${n} items van bronnen die zelf werken`);
  }
  if (removed.length) log(`Verwijderd: ${dbm.deleteActivities(db, removed)} activiteiten die niet meer in een volledige lijst staan`);
  const pruned = dbm.pruneExpired(db, addDays(today, -config.pruneExpiredAfterDays));
  if (pruned) log(`Opgeruimd: ${pruned} lang verlopen activiteiten`);
  dbm.finishRun(db, runId, { ok: anyOk, at: new Date().toISOString(), stats, log: logLines.join('\n') });
  writeExport(db, today, nowIso, { ...zeroTotals, added: stats.added, updated: stats.updated, cancelled: stats.cancelled, expired: stats.expired });

  const failed = results.filter((r) => !r.ok);
  if (failed.length) log(`Let op: ${failed.length} bron(nen) mislukt: ${failed.map((f) => f.sourceId).join(', ')}`);
  return anyOk ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);

/** Detailpagina-cache in SQLite, per bron. */
function detailCache(db: ReturnType<typeof dbm.openDb>, sourceId: string, nowIso: string): DetailCache {
  const get = db.prepare('SELECT fetched_at, value FROM detail_cache WHERE key = ?');
  const put = db.prepare('INSERT OR REPLACE INTO detail_cache (key, fetched_at, value) VALUES (?, ?, ?)');
  return {
    get<T>(key: string) {
      const r = get.get(`${sourceId}|${key}`) as { fetched_at: string; value: string } | undefined;
      return r ? { fetchedAt: r.fetched_at, value: JSON.parse(r.value) as T } : undefined;
    },
    set(key: string, value: unknown) {
      put.run(`${sourceId}|${key}`, nowIso, JSON.stringify(value));
    },
  };
}
