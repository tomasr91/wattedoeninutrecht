/**
 * Handmatig gecontroleerde activiteiten (data/curated/*.json).
 *
 * Bedoeld voor:
 *  - bronnen zonder bruikbare feed of opmaak (gemeentelijke intochten, seizoensevenementen),
 *  - de startdataset, verzameld via webonderzoek op 21-10-2026.
 *
 * Elk item heeft een officiële of secundaire bronlink en een `checkedAt`-datum.
 * Die datum wordt bij updates NIET ververst: de app laat zo zien hoe oud de
 * controle is, en de kwaliteitsscore daalt naarmate een item ouder wordt.
 */
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';
import { dateOf } from '../../src/domain/dates.ts';

export interface CuratedFile {
  meta: { collectedAt: string; collectedBy: string; method: string; note?: string };
  events: (Omit<RawEvent, 'sourceId' | 'checkedAt'> & { checkedAt?: string; sourceId?: string })[];
}

export function loadCurated(dir: string): CuratedFile[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as CuratedFile);
}

export function curatedAdapter(dir: string): SourceAdapter {
  return {
    id: 'handmatig',
    name: 'Alternatief verzameld',
    homepage: '',
    method: 'handmatig',
    description:
      'Activiteiten die met de hand bij de officiële bron zijn gecontroleerd (o.a. de startdataset en seizoensevenementen zonder feed).',
    async run(ctx: AdapterContext): Promise<AdapterResult> {
      const events: RawEvent[] = [];
      for (const file of loadCurated(dir)) {
        for (const e of file.events) {
          if (dateOf(e.end ?? e.start) < ctx.today) continue;
          events.push({
            ...e,
            sourceId: 'handmatig',
            sourceName: e.sourceName,
            checkedAt: e.checkedAt ?? file.meta.collectedAt,
          });
        }
      }
      return { events, keepCheckedDates: true, authoritative: true };
    },
  };
}

/**
 * Haal uit de handmatige bestanden alle items van bronnen die nu zelf automatisch werken.
 * Lege bestanden worden verwijderd. Geeft het aantal verwijderde items terug.
 */
export function pruneCuratedFiles(dir: string, liveSourceNames: Set<string>): number {
  let removed = 0;
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return 0;
  }
  for (const f of files) {
    const path = join(dir, f);
    const file = JSON.parse(readFileSync(path, 'utf8')) as CuratedFile;
    const keep = file.events.filter((e) => !liveSourceNames.has(e.sourceName));
    if (keep.length === file.events.length) continue;
    removed += file.events.length - keep.length;
    if (keep.length) writeFileSync(path, JSON.stringify({ ...file, events: keep }, null, 2) + '\n');
    else unlinkSync(path);
  }
  return removed;
}
