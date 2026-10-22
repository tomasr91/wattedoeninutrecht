import type { Activity } from './types';
import { addDays, dateOf, diffDays, timeOf, weekday } from './dates';
import { activityEndDate } from './filters';
import { normalizeText, stableHash } from './dedupe';

/**
 * Vaste reeksen: hetzelfde aanbod op dezelfde plek dat steeds terugkomt
 * (elke vrijdag en zaterdag een comedyavond, elke woensdag voorlezen).
 * Zo'n reeks wordt één doorlopende regel in plaats van een losse activiteit per datum.
 *
 * Herkend aan:
 * 1. de bron: "doorlopend", "elke vrijdag en zaterdag", "wekelijks" (`recurrenceNote`);
 * 2. het patroon: minstens 3 data, verspreid over minstens 2 weken, op hooguit 3 vaste weekdagen.
 */

export const SERIES_MIN_DATES = 3;
export const SERIES_MIN_SPAN_DAYS = 14;
const MAX_WEEKDAYS = 3;
/** Een losse activiteit van meer dan een week (expositie) is al doorlopend; die laten we zo. */
const MAX_MEMBER_SPAN_DAYS = 7;

const WD_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

function memberDates(a: Activity): string[] {
  if (a.occurrences?.length) return a.occurrences;
  const s = dateOf(a.start);
  const e = activityEndDate(a);
  const out: string[] = [];
  for (let d = s; d <= e && out.length <= MAX_MEMBER_SPAN_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "Elke vr en za · 20:30", "Elke woensdag · 10:00", "Dagelijks". */
export function recurrenceLabel(dates: string[], times: string[]): string {
  const uniqTimes = [...new Set(times.filter(Boolean))];
  const timeText = uniqTimes.length === 1 ? ` · ${uniqTimes[0]}` : '';
  const sorted = [...new Set(dates)].sort();
  const gaps = sorted.slice(1).map((d, i) => diffDays(sorted[i], d)).sort((x, y) => x - y);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  if (medianGap > 10) {
    // Niet wekelijks (bv. eens per maand): noem de data zelf.
    const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const short = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
    const wd = new Set(sorted.map(weekday));
    const lead = wd.size === 1 ? `${WD_SHORT[[...wd][0]][0].toUpperCase()}${WD_SHORT[[...wd][0]].slice(1)} ` : '';
    const list = sorted.length <= 4 ? sorted.map(short) : [short(sorted[0]), `nog ${sorted.length - 2} keer`, short(sorted.at(-1)!)];
    return `${lead}${list.slice(0, -1).join(', ')} en ${list.at(-1)}${timeText}`;
  }
  const days = [...new Set(dates.map(weekday))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const dayText =
    days.length >= 6
      ? 'Dagelijks'
      : days.length === 1
        ? `Elke ${['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'][days[0]]}`
        : `Elke ${days.slice(0, -1).map((d) => WD_SHORT[d]).join(', ')} en ${WD_SHORT[days.at(-1)!]}`;
  const uniq = [...new Set(times.filter(Boolean))];
  return uniq.length === 1 ? `${dayText} · ${uniq[0]}` : dayText;
}

export function seriesKeyOf(a: Activity): string {
  return `${normalizeText(a.title)}|${normalizeText(a.venue.name)}`;
}

/**
 * Voeg vaste reeksen samen. Verlopen data tellen niet mee; de reeks loopt van
 * de eerstvolgende datum t/m de laatst bekende datum en schuift vanzelf op.
 */
export function collapseSeries(activities: Activity[], today: string): Activity[] {
  const groups = new Map<string, Activity[]>();
  const out: Activity[] = [];
  for (const a of activities) {
    const span = diffDays(dateOf(a.start), activityEndDate(a)) + 1;
    if (a.isTestData || a.status === 'verlopen' || activityEndDate(a) < today || a.endUnknown || (span > MAX_MEMBER_SPAN_DAYS && !a.recurrenceNote)) {
      out.push(a);
      continue;
    }
    const key = seriesKeyOf(a);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  for (const [key, members] of groups) {
    const live = members.filter((m) => m.status !== 'geannuleerd');
    const dates = [...new Set(live.flatMap(memberDates))].filter((d) => d >= today).sort();
    const weekdays = new Set(dates.map(weekday));
    const fromText = members.find((m) => m.recurrenceNote)?.recurrenceNote;
    const byPattern = dates.length >= SERIES_MIN_DATES && diffDays(dates[0], dates.at(-1)!) >= SERIES_MIN_SPAN_DAYS && weekdays.size <= MAX_WEEKDAYS;
    if ((!fromText && !byPattern) || dates.length === 0) {
      out.push(...members);
      continue;
    }
    const sorted = [...live].sort((x, y) => (x.start < y.start ? -1 : 1));
    const first = sorted.find((m) => activityEndDate(m) >= today) ?? sorted[0];
    const times = live.map((m) => timeOf(m.start) ?? '');
    const note = fromText ?? recurrenceLabel(dates, times);
    out.push({
      ...first,
      id: `reeks-${stableHash(key)}`,
      start: dates[0],
      end: dates.at(-1)!,
      allDay: true,
      ongoing: true,
      openingNote: undefined,
      occurrences: dates,
      recurrenceNote: note,
      rolling: members.some((m) => m.rolling) || undefined,
      sources: dedupeSources(members),
    });
  }
  return out;
}

function dedupeSources(members: Activity[]): Activity['sources'] {
  const seen = new Set<string>();
  const out: Activity['sources'] = [];
  for (const s of members.flatMap((m) => m.sources)) {
    if (seen.has(s.sourceId)) continue;
    seen.add(s.sourceId);
    out.push(s);
  }
  return out;
}
