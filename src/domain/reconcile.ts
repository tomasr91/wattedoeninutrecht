import type { Activity, Confidence } from './types';
import { dateOf } from './dates';
import { normalizeText, stableHash } from './dedupe';
import { activityEndDate } from './filters';

/** Activiteit zoals opgeslagen, met administratie voor het bijhouden van wijzigingen. */
export interface StoredActivity extends Activity {
  contentHash: string;
  /** Aantal dagen (niet runs) waarop de bron dit item bij een geslaagde run niet meer noemde. */
  missingCount: number;
  /** Laatste dag waarop missingCount is opgehoogd; meerdere runs op één dag tellen één keer. */
  missingDay?: string;
}

export interface SourceResult {
  sourceId: string;
  ok: boolean;
  error?: string;
  /** Datumvenster dat de bron in deze run volledig heeft opgehaald. */
  coverage?: { from: string; to: string };
  /**
   * Handmatig gecontroleerde bronnen worden niet bij elke run opnieuw bij de
   * oorspronkelijke website gecontroleerd; hun controledatum blijft dan staan.
   */
  keepCheckedDates?: boolean;
  /**
   * De bron levert altijd de volledige lijst (bv. de handmatige bestanden): wat er niet meer in
   * staat, wordt direct verwijderd in plaats van na een paar runs als geannuleerd gemarkeerd.
   */
  authoritative?: boolean;
  activities: Activity[];
}

export interface ReconcileStats {
  added: number;
  updated: number;
  unchanged: number;
  cancelled: number;
  expired: number;
  missing: number;
}

/** Na zoveel gemiste runs gaan we uit van annulering of verplaatsing. */
/** Aantal runs (dagelijks) dat een activiteit bij de bron mag ontbreken voordat hij als vermoedelijk geannuleerd geldt. */
export const MISSING_THRESHOLD = 3;

/** Velden die voor de gebruiker betekenis hebben; wijziging hierin telt als update. */
export function contentHashOf(a: Activity): string {
  return stableHash(
    JSON.stringify([
      a.title, a.start, a.end, a.venue.name, a.venue.address, a.price, a.booking.status,
      a.booking.availability?.label, a.status, a.age.officialMinMonths, a.age.officialMaxMonths, a.url,
    ]),
  );
}

export function sourceKey(a: Activity): string {
  const s = a.sources[0];
  return `${s.sourceId}::${s.sourceEventId ?? a.id}`;
}

function lowerConfidence(c: Confidence): Confidence {
  return c === 'hoog' ? 'middel' : 'laag';
}

/**
 * Verwerk de resultaten van één update-run in de bestaande voorraad.
 *
 * - Nieuwe items worden toegevoegd, gewijzigde bijgewerkt.
 * - Items van een *mislukte* bron blijven ongewijzigd staan (met hun oude
 *   controledatum), zodat ze niet ten onrechte als actueel gelden.
 * - Items die een geslaagde bron niet meer noemt binnen het opgehaalde
 *   venster, krijgen eerst een waarschuwing en na {@link MISSING_THRESHOLD}
 *   runs de status 'geannuleerd'.
 * - Items waarvan de einddatum voorbij is, krijgen de status 'verlopen'.
 */
export function reconcile(
  existing: StoredActivity[],
  results: SourceResult[],
  nowIso: string,
  today: string,
): { activities: StoredActivity[]; stats: ReconcileStats; removed: string[] } {
  const stats: ReconcileStats = { added: 0, updated: 0, unchanged: 0, cancelled: 0, expired: 0, missing: 0 };
  const byKey = new Map(existing.map((a) => [sourceKey(a), { ...a }]));
  const okSources = new Map(results.filter((r) => r.ok).map((r) => [r.sourceId, r]));
  const seen = new Set<string>();

  for (const r of results) {
    if (!r.ok) continue;
    for (const incoming of r.activities) {
      const key = sourceKey(incoming);
      seen.add(key);
      const hash = contentHashOf(incoming);
      const prev = byKey.get(key);
      const checked = (s: { lastChecked: string }) => (r.keepCheckedDates ? s.lastChecked : nowIso);
      if (!prev) {
        byKey.set(key, {
          ...incoming,
          sources: incoming.sources.map((s) => ({ ...s, firstSeen: nowIso, lastChecked: checked(s) })),
          lastChecked: checked(incoming),
          contentHash: hash,
          missingCount: 0,
        });
        stats.added++;
        continue;
      }
      const changed = prev.contentHash !== hash;
      byKey.set(key, {
        ...incoming,
        id: prev.id, // ID blijft stabiel, ook als de titel wijzigt
        sources: incoming.sources.map((s, i) => ({
          ...s,
          firstSeen: prev.sources[i]?.firstSeen ?? nowIso,
          lastChecked: checked(s),
        })),
        lastChecked: checked(incoming),
        contentHash: hash,
        missingCount: 0,
      });
      if (changed) stats.updated++;
      else stats.unchanged++;
    }
  }

  // Volledige lijsten: wat er niet meer in staat, gaat eruit
  const removed: string[] = [];
  for (const [key, a] of byKey) {
    if (seen.has(key) || !okSources.get(a.sources[0].sourceId)?.authoritative) continue;
    byKey.delete(key);
    removed.push(key);
  }

  // Zelfde activiteit onder een nieuwe sleutel (de bron of onze koppeling veranderde de ID):
  // het oude exemplaar is geen annulering maar een dubbele; weghalen.
  const incomingBySource = new Map<string, Activity[]>();
  for (const r of results) if (r.ok) incomingBySource.set(r.sourceId, r.activities);
  const SUSPECTED = 'Vermoedelijk geannuleerd of verplaatst — controleer de bron';
  for (const [key, a] of byKey) {
    if (seen.has(key)) continue;
    if (a.status === 'geannuleerd' && !a.uncertainties.includes(SUSPECTED)) continue; // door de bron zelf geannuleerd
    const same = incomingBySource.get(a.sources[0].sourceId)?.some(
      (b) => normalizeText(b.title) === normalizeText(a.title) && dateOf(b.start) <= activityEndDate(a) && activityEndDate(b) >= dateOf(a.start),
    );
    if (same) {
      byKey.delete(key);
      removed.push(key);
    }
  }

  // Niet meer gevonden bij een geslaagde bron (geteld in dagen, niet in runs)
  for (const [key, a] of byKey) {
    if (seen.has(key)) continue;
    const src = okSources.get(a.sources[0].sourceId);
    if (!src || !src.coverage) continue;
    const d = dateOf(a.start);
    const inWindow = d >= src.coverage.from && d <= src.coverage.to;
    if (!inWindow || a.status === 'geannuleerd' || activityEndDate(a) < today) continue;
    const newDay = a.missingDay !== today;
    const missingCount = a.missingCount + (newDay ? 1 : 0);
    const note = 'Niet meer vermeld bij de bron bij de laatste controle';
    const next: StoredActivity = {
      ...a,
      missingCount,
      missingDay: today,
      confidence: lowerConfidence(a.confidence),
      uncertainties: a.uncertainties.includes(note) ? a.uncertainties : [...a.uncertainties, note],
    };
    if (missingCount >= MISSING_THRESHOLD) {
      next.status = 'geannuleerd';
      const n2 = SUSPECTED;
      if (!next.uncertainties.includes(n2)) next.uncertainties = [...next.uncertainties, n2];
      stats.cancelled++;
    } else {
      stats.missing++;
    }
    byKey.set(key, next);
  }

  // Verlopen
  for (const [key, a] of byKey) {
    if (a.status !== 'verlopen' && activityEndDate(a) < today) {
      byKey.set(key, { ...a, status: 'verlopen' });
      stats.expired++;
    }
  }

  // Expliciet geannuleerd door de bron telt ook mee
  for (const r of results) {
    if (!r.ok) continue;
    for (const a of r.activities) {
      if (a.status === 'geannuleerd') {
        const prev = existing.find((e) => sourceKey(e) === sourceKey(a));
        if (!prev || prev.status !== 'geannuleerd') stats.cancelled++;
      }
    }
  }

  return { activities: [...byKey.values()], stats, removed };
}
