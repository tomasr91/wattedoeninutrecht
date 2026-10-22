/**
 * Datumhulpjes zonder tijdzone-valkuilen: we rekenen met kalenderdatums
 * ('YYYY-MM-DD') via UTC, en bepalen "vandaag" expliciet in Europe/Amsterdam.
 */

export const TZ = 'Europe/Amsterdam';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Datumdeel van 'YYYY-MM-DD' of 'YYYY-MM-DDTHH:mm'. */
export function dateOf(value: string): string {
  return value.slice(0, 10);
}

/** 'HH:mm' of undefined. */
export function timeOf(value: string): string | undefined {
  return value.length >= 16 ? value.slice(11, 16) : undefined;
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export function addMonths(key: string, months: number): string {
  const d = parseDateKey(key);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return toDateKey(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / 86_400_000);
}

/** 0 = zondag … 6 = zaterdag */
export function weekday(key: string): number {
  return parseDateKey(key).getUTCDay();
}

export function isWeekend(key: string): boolean {
  const w = weekday(key);
  return w === 0 || w === 6;
}

/** Maandag van de week waarin de datum valt (ISO-week). */
export function startOfWeek(key: string): string {
  const w = weekday(key);
  return addDays(key, w === 0 ? -6 : 1 - w);
}

/** "Vandaag" in Amsterdam, onafhankelijk van de tijdzone van het apparaat of de server. */
export function todayInAmsterdam(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Huidige lokale tijd 'YYYY-MM-DDTHH:mm' in Amsterdam. */
export function nowInAmsterdam(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** Zet een UTC-moment om naar lokale Amsterdamse tijd 'YYYY-MM-DDTHH:mm'. */
export function utcToLocal(date: Date): string {
  return nowInAmsterdam(date);
}

const DAY_NAMES = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAY_NAMES_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS_LONG = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** UTC-moment (ISO) als Amsterdamse datum en tijd: 'wo 21 okt, 14:40'. */
export function formatDateTime(iso: string): string {
  const local = nowInAmsterdam(new Date(iso));
  return `${formatShortDate(local.slice(0, 10))}, ${local.slice(11, 16)}`;
}

export function formatLongDate(key: string): string {
  const d = parseDateKey(key);
  return `${DAY_NAMES_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
}

export function formatMonthYear(key: string): string {
  const d = parseDateKey(key);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function relativeDayLabel(key: string, today: string): string {
  const diff = diffDays(today, key);
  if (diff === 0) return `Vandaag, ${formatLongDate(key)}`;
  if (diff === 1) return `Morgen, ${formatLongDate(key)}`;
  if (diff === 2) return `Overmorgen, ${formatLongDate(key)}`;
  return formatLongDate(key).replace(/^./, (c) => c.toUpperCase());
}

/** Dagdeel op basis van begintijd. */
export type DayPart = 'ochtend' | 'middag' | 'avond' | 'hele-dag';

export function dayPartOf(start: string): DayPart {
  const t = timeOf(start);
  if (!t) return 'hele-dag';
  const h = Number(t.slice(0, 2));
  if (h < 12) return 'ochtend';
  if (h < 18) return 'middag';
  return 'avond';
}
