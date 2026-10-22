import { weekdaysFromNote } from './series';
import type { Activity, Audience, BookingStatus, Category, Child, IndoorKind, PeriodPreset, PriceKind, Zone } from './types';
import { addDays, addMonths, dateOf, dayPartOf, isWeekend, startOfWeek, weekday, type DayPart } from './dates';
import { childFits } from './age';
import { distanceFromHome } from './geo';
import type { Home } from './types';

export interface Period {
  preset: PeriodPreset;
  /** Inclusief, 'YYYY-MM-DD' */
  from: string;
  /** Inclusief, 'YYYY-MM-DD' */
  to: string;
}

/** Bereken een periode. `anchor` is voor 'week' (een dag in die week) of 'bereik' (start). */
export function makePeriod(
  preset: PeriodPreset,
  today: string,
  opts: { anchor?: string; to?: string } = {},
): Period {
  switch (preset) {
    case 'deze-week': {
      // Vandaag t/m zondag; op zondag t/m de zondag erna is niet logisch → alleen vandaag t/m zondag
      const monday = startOfWeek(today);
      return { preset, from: today, to: addDays(monday, 6) };
    }
    case 'komende-maand':
      return { preset, from: today, to: addDays(addMonths(today, 1), -1) };
    case 'drie-maanden':
      return { preset, from: today, to: addDays(addMonths(today, 3), -1) };
    case 'week': {
      const monday = startOfWeek(opts.anchor ?? today);
      const from = monday < today ? today : monday;
      return { preset, from, to: addDays(monday, 6) };
    }
    case 'bereik': {
      const from = opts.anchor ?? today;
      const to = opts.to && opts.to >= from ? opts.to : addDays(from, 6);
      return { preset, from, to };
    }
  }
}

export function activityEndDate(a: Activity): string {
  return dateOf(a.end ?? a.start);
}

/** Overlapt de activiteit met de periode? (ook voor meerdaagse/doorlopende activiteiten) */
export function overlapsPeriod(a: Activity, p: { from: string; to: string }): boolean {
  const wd = a.rolling ? weekdaysFromNote(a.recurrenceNote) : undefined;
  if (wd) return firstWeekdayIn(wd, dateOf(a.start) > p.from ? dateOf(a.start) : p.from, p.to) !== undefined;
  if (a.occurrences) return a.occurrences.some((d) => d >= p.from && d <= p.to);
  return dateOf(a.start) <= p.to && activityEndDate(a) >= p.from;
}

/** Eerste datum binnen de periode waarop de activiteit plaatsvindt (voor sorteren/groeperen). */
export function firstDateInPeriod(a: Activity, p: { from: string; to: string }): string {
  const wd = a.rolling ? weekdaysFromNote(a.recurrenceNote) : undefined;
  if (wd) return firstWeekdayIn(wd, dateOf(a.start) > p.from ? dateOf(a.start) : p.from, p.to) ?? p.from;
  if (a.occurrences) return a.occurrences.find((d) => d >= p.from) ?? p.from;
  const s = dateOf(a.start);
  return s >= p.from ? s : p.from;
}

export type WhenQuick = 'vandaag' | 'morgen' | 'weekend' | 'doordeweeks';
export type ForWhom = 'kinderen' | 'volwassenen' | 'gezin';
export type ChildSel = 'kind1' | 'kind2' | 'beide';
export type AgeBand = '0-2' | '2-4' | '4-6' | '6+';

export interface Filters {
  forWhom: ForWhom[];
  child: ChildSel | null;
  ageBands: AgeBand[];
  price: PriceKind[];
  indoor: Exclude<IndoorKind, 'onbekend' | 'beide'>[];
  zones: Zone[];
  categories: Category[];
  dayParts: DayPart[];
  when: WhenQuick[];
  booking: BookingStatus[];
  maxDistanceKm: number | null;
  onlySaved: boolean;
  search: string;
}

export const EMPTY_FILTERS: Filters = {
  forWhom: [],
  child: null,
  ageBands: [],
  price: [],
  indoor: [],
  zones: [],
  categories: [],
  dayParts: [],
  when: [],
  booking: [],
  maxDistanceKm: null,
  onlySaved: false,
  search: '',
};

export function countActiveFilters(f: Filters): number {
  let n = 0;
  for (const k of Object.keys(f) as (keyof Filters)[]) {
    const v = f[k];
    if (Array.isArray(v)) n += v.length ? 1 : 0;
    else if (typeof v === 'boolean') n += v ? 1 : 0;
    else if (typeof v === 'string') n += v.trim() ? 1 : 0;
    else if (v !== null && v !== undefined) n += 1;
  }
  return n;
}

const AGE_BANDS: Record<AgeBand, [number, number]> = {
  '0-2': [0, 23],
  '2-4': [24, 47],
  '4-6': [48, 71],
  '6+': [72, 216],
};

function ageBandMatches(a: Activity, band: AgeBand): boolean {
  if (a.audiences.every((x) => x === 'volwassenen')) return false;
  const [lo, hi] = AGE_BANDS[band];
  const min = a.age.officialMinMonths ?? a.age.estimatedMinMonths ?? 0;
  const maxRaw = a.age.officialMaxMonths ?? a.age.estimatedMaxMonths;
  const max = maxRaw === undefined ? 216 : maxRaw + 11;
  return min <= hi && max >= lo;
}

function audienceMatches(a: Activity, whom: ForWhom): boolean {
  const aud = new Set<Audience>(a.audiences);
  if (whom === 'kinderen') return aud.has('kinderen') || aud.has('gezin');
  if (whom === 'gezin') return aud.has('gezin') || (aud.has('kinderen') && aud.size > 0);
  return aud.has('volwassenen') || aud.has('gezin');
}

/** Valt (een deel van) de activiteit binnen een snelkeuze-moment? */
function whenMatches(a: Activity, w: WhenQuick, today: string, period: Period): boolean {
  const s = dateOf(a.start);
  const e = activityEndDate(a);
  const covers = (d: string) => s <= d && e >= d;
  switch (w) {
    case 'vandaag':
      return covers(today);
    case 'morgen':
      return covers(addDays(today, 1));
    case 'weekend': {
      // Eerstvolgende zaterdag/zondag binnen de periode
      for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
        if (isWeekend(d) && covers(d)) return true;
      }
      return false;
    }
    case 'doordeweeks': {
      if (s !== e) return true; // meerdaagse activiteiten lopen ook door de week
      const wd = weekday(s);
      return wd >= 1 && wd <= 5;
    }
  }
}

export interface FilterContext {
  today: string;
  period: Period;
  children: Child[];
  home: Home;
  savedIds: Set<string>;
}

export function applyFilters(activities: Activity[], f: Filters, ctx: FilterContext): Activity[] {
  const q = f.search.trim().toLowerCase();
  return activities.filter((a) => {
    if (a.isTestData) return false;
    if (a.status === 'verlopen') return false;
    if (!overlapsPeriod(a, ctx.period)) return false;
    if (activityEndDate(a) < ctx.today) return false;

    if (f.onlySaved && !ctx.savedIds.has(a.id)) return false;
    if (f.forWhom.length && !f.forWhom.some((w) => audienceMatches(a, w))) return false;

    if (f.child) {
      const fits = childFits(a, ctx.children, firstDateInPeriod(a, ctx.period));
      const ok = (i: number) => fits[i] && (fits[i].fit === 'geschikt' || fits[i].fit === 'mogelijk');
      if (f.child === 'kind1' && !ok(0)) return false;
      if (f.child === 'kind2' && !ok(1)) return false;
      if (f.child === 'beide' && !(ok(0) && ok(1))) return false;
    }

    if (f.ageBands.length && !f.ageBands.some((b) => ageBandMatches(a, b))) return false;
    if (f.price.length && !f.price.includes(a.price.kind)) return false;
    if (f.indoor.length) {
      const ok = f.indoor.some((i) => a.indoor === i || a.indoor === 'beide');
      if (!ok) return false;
    }
    if (f.zones.length && !f.zones.includes(a.zone)) return false;
    if (f.categories.length && !a.categories.some((c) => f.categories.includes(c))) return false;
    if (f.dayParts.length && !f.dayParts.includes(dayPartOf(a.start))) return false;
    if (f.when.length && !f.when.some((w) => whenMatches(a, w, ctx.today, ctx.period))) return false;
    if (f.booking.length && !f.booking.includes(a.booking.status)) return false;
    if (f.maxDistanceKm !== null) {
      const km = distanceFromHome(a.venue, ctx.home);
      // Onbekende afstand niet wegfilteren: liever tonen dan onterecht verbergen.
      if (km !== undefined && km > f.maxDistanceKm) return false;
    }
    if (q) {
      const hay = `${a.title} ${a.venue.name} ${a.venue.locality ?? ''} ${a.summary ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Eerste dag in [from, to] op een van deze weekdagen (0 = zondag). */
function firstWeekdayIn(days: number[], from: string, to: string): string | undefined {
  for (let d = from, i = 0; d <= to && i < 400; d = addDays(d, 1), i++) if (days.includes(weekday(d))) return d;
  return undefined;
}
