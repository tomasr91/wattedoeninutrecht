/**
 * "Komt eraan": jaarlijkse momenten (Koningsdag, intocht, festivals) die binnenkort vallen
 * maar waarvoor nog niets in de agenda staat. Zo zie je dat er iets aankomt, ook als de
 * organisator het programma nog niet heeft gepubliceerd.
 */
import type { Activity, Zone } from './types';
import { addDays, dateOf, diffDays } from './dates';
import { activityEndDate } from './filters';
import { normalizeText } from './dedupe';

export interface RecurringMoment {
  id: string;
  name: string;
  audience: 'kinderen' | 'volwassenen' | 'beide';
  /** 'MM-DD', inclusief. Een indicatie van wanneer het meestal is. */
  from: string;
  to: string;
  whenText: string;
  /** Hele woorden in de titel die op dit moment wijzen. */
  keywords: string[];
  /** Optioneel: alleen meetellen als de locatie een van deze woorden bevat. */
  venueKeywords?: string[];
  zones?: Zone[];
  checkName?: string;
  checkUrl?: string;
}

export interface ExpectedMoment {
  id: string;
  name: string;
  audience: RecurringMoment['audience'];
  whenText: string;
  from: string;
  to: string;
  inDays: number;
  checkName?: string;
  checkUrl?: string;
}

/** Eerstvolgende periode van een moment, vanaf vandaag gezien. */
export function nextOccurrence(m: Pick<RecurringMoment, 'from' | 'to'>, today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1]) {
    const crosses = m.to < m.from;
    const from = `${year}-${m.from}`;
    const to = `${crosses ? year + 1 : year}-${m.to}`;
    if (to >= today) return { from, to };
  }
  return { from: `${y + 1}-${m.from}`, to: `${y + 1}-${m.to}` };
}

const wordMatch = (text: string, word: string) => new RegExp(`(^| )${normalizeText(word)}( |$)`).test(normalizeText(text));

/** Staat er al iets in de agenda dat bij dit moment hoort (met twee weken speling)? */
export function isCovered(m: RecurringMoment, occ: { from: string; to: string }, activities: Activity[]): boolean {
  const lo = addDays(occ.from, -14);
  const hi = addDays(occ.to, 14);
  return activities.some((a) => {
    if (a.isTestData || a.status === 'verlopen') return false;
    if (dateOf(a.start) > hi || activityEndDate(a) < lo) return false;
    if (m.zones && !m.zones.includes(a.zone)) return false;
    if (m.venueKeywords && !m.venueKeywords.some((v) => wordMatch(`${a.venue.name} ${a.venue.locality ?? ''} ${a.venue.address ?? ''}`, v))) return false;
    return m.keywords.some((k) => wordMatch(a.title, k));
  });
}

export function computeExpected(moments: RecurringMoment[], activities: Activity[], today: string, horizonDays = 56): ExpectedMoment[] {
  const out: ExpectedMoment[] = [];
  for (const m of moments) {
    const occ = nextOccurrence(m, today);
    const inDays = Math.max(0, diffDays(today, occ.from));
    if (inDays > horizonDays) continue;
    if (isCovered(m, occ, activities)) continue;
    out.push({ id: m.id, name: m.name, audience: m.audience, whenText: m.whenText, from: occ.from, to: occ.to, inDays, checkName: m.checkName, checkUrl: m.checkUrl });
  }
  return out.sort((a, b) => (a.from < b.from ? -1 : 1));
}
