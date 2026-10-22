/**
 * De twee lijsten van de app: "Kinderen" en "Volwassenen", elk opgesplitst in
 * een chronologische agenda (eendaags t/m meerdaags) en een lijst doorlopend aanbod.
 * Pure logica, los van de UI, zodat het testbaar is.
 */
import type { Activity, Category, Child, Home } from './types';
import { addDays, dateOf, diffDays, isWeekend, timeOf, weekday } from './dates';
import { childFits, type ChildFit } from './age';
import { activityEndDate, firstDateInPeriod, overlapsPeriod } from './filters';
import { DEFAULT_HOME, distanceFromHome } from './geo';
import { normalizeText } from './dedupe';
import { kindLabel } from './kind';

export type ListAudience = 'kinderen' | 'volwassenen';

/** Fietsafstand: binnen 8 km van Leidsche Rijn Centrum, of in de gemeente Utrecht zelf. */
export const BIKE_MAX_KM = 8;

export function isBikeDistance(a: Activity, home: Home = DEFAULT_HOME, maxKm = BIKE_MAX_KM): boolean {
  if (a.zone === 'leidsche-rijn' || a.zone === 'utrecht') return true;
  const km = distanceFromHome(a.venue, home);
  return km !== undefined && km <= maxKm;
}

/** Dit weekend: de eerstvolgende zaterdag en zondag; op zondag alleen vandaag. */
export function thisWeekend(today: string): { from: string; to: string } {
  if (weekday(today) === 0) return { from: today, to: today };
  let sat = today;
  while (weekday(sat) !== 6) sat = addDays(sat, 1);
  return { from: sat, to: addDays(sat, 1) };
}

export type WeekendChoice = 'dit' | 'volgend';

/** Vanaf dit tijdstip telt een vrijdagactiviteit als "vrijdagavond" (alleen bij Volwassenen). */
export const FRIDAY_EVENING_FROM = '18:00';

/** Volgend weekend: het weekend na "dit weekend". */
export function nextWeekend(today: string): { from: string; to: string } {
  const w = thisWeekend(today);
  const sat = weekday(w.from) === 6 ? w.from : addDays(w.from, -1);
  return { from: addDays(sat, 7), to: addDays(sat, 8) };
}

/**
 * Het gekozen weekend. Kinderen: zaterdag en zondag. Volwassenen: daarbij ook de
 * vrijdagavond ervoor (niet als die al voorbij is).
 */
export function weekendWindow(
  choice: WeekendChoice,
  today: string,
  audience: ListAudience,
): { from: string; to: string; fridayEvening?: string } {
  const w = choice === 'dit' ? thisWeekend(today) : nextWeekend(today);
  if (audience !== 'volwassenen') return w;
  const sat = weekday(w.from) === 6 ? w.from : addDays(w.from, -1);
  const fri = addDays(sat, -1);
  return fri >= today ? { ...w, fridayEvening: fri } : w;
}

/** Vanaf zoveel kalenderdagen (begin- en einddag meegeteld) staat iets onder Doorlopend. */
export const LONG_RUNNING_MIN_DAYS = 7;

/**
 * Doorlopend aanbod: alles wat zeven dagen of langer loopt. Alleen de duur telt,
 * niet hoe de bron het noemt; korter staat in de gewone agenda.
 */
export function isLongRunning(a: Activity): boolean {
  if (a.endUnknown) return true;
  return diffDays(dateOf(a.start), activityEndDate(a)) + 1 >= LONG_RUNNING_MIN_DAYS;
}

export function matchesAudience(a: Activity, audience: ListAudience): boolean {
  if (audience === 'kinderen') return a.audiences.includes('kinderen') || a.audiences.includes('gezin');
  return a.audiences.includes('volwassenen');
}

export interface ListItem {
  activity: Activity;
  /** Dag waaronder het in de agenda staat (eerste dag binnen de periode). */
  day: string;
  /** Alleen bij Kinderen: geschiktheid per kind op die dag. */
  fits?: ChildFit[];
  km?: number;
  /** Zelfde activiteit, zelfde tijd, andere locaties (bv. een reeks in meerdere bibliotheken). */
  others: Activity[];
}

export interface Lists {
  days: { day: string; items: ListItem[] }[];
  ongoing: ListItem[];
  /** Kinderactiviteiten die voor geen van de kinderen passen (te jong of te oud). */
  hiddenForAge: number;
  total: number;
}

export interface ListOptions {
  audience: ListAudience;
  /** Alleen dit of volgend weekend; null = de gekozen periode. */
  weekend: WeekendChoice | null;
  onlyBike: boolean;
  /** Categorieën die je niet wilt zien (standaard: voorlezen). */
  excludeCategories: Category[];
  /** Soortlabels die je in deze lijst niet wilt zien (bv. "Indie"). */
  hiddenKinds?: string[];
}

export const DEFAULT_LIST_OPTIONS: ListOptions = {
  audience: 'kinderen',
  weekend: null,
  onlyBike: false,
  excludeCategories: ['voorlezen'],
};

/** Geen bekende einddatum (de bron noemt hem niet). */
export function hasNoEndDate(a: Activity): boolean {
  return !!a.endUnknown || a.uncertainties.some((u) => /einddatum\b.*\bniet\b|einddatum onbekend/i.test(u));
}

export function buildLists(
  activities: Activity[],
  opts: ListOptions,
  ctx: { today: string; period: { from: string; to: string }; children: Child[]; home?: Home },
): Lists {
  const home = ctx.home;
  const wk = opts.weekend ? weekendWindow(opts.weekend, ctx.today, opts.audience) : undefined;
  const window = wk ?? ctx.period;
  const isFridayEvening = (a: Activity) =>
    !!wk?.fridayEvening && dateOf(a.start) === wk.fridayEvening && (timeOf(a.start) ?? '') >= FRIDAY_EVENING_FROM;
  let hiddenForAge = 0;
  const items: ListItem[] = [];

  for (const a of activities) {
    if (a.isTestData || a.status === 'verlopen') continue;
    // Zonder einddatum zou iets voor altijd blijven staan: niet tonen.
    if (hasNoEndDate(a)) continue;
    const friday = isFridayEvening(a);
    if (activityEndDate(a) < ctx.today || (!overlapsPeriod(a, window) && !friday)) continue;
    if (!matchesAudience(a, opts.audience)) continue;
    if (a.categories.some((c) => opts.excludeCategories.includes(c))) continue;
    if (opts.hiddenKinds?.length && opts.hiddenKinds.includes(kindLabel(a))) continue;
    if (opts.onlyBike && !isBikeDistance(a, home)) continue;

    const day = friday ? dateOf(a.start) : firstDateInPeriod(a, window);
    let fits: ChildFit[] | undefined;
    if (opts.audience === 'kinderen' && ctx.children.length) {
      fits = childFits(a, ctx.children, day);
      if (fits.every((f) => f.fit === 'te-jong' || f.fit === 'te-oud' || f.fit === 'niet-voor-kinderen')) {
        hiddenForAge++;
        continue;
      }
    }
    items.push({ activity: a, day, fits, km: distanceFromHome(a.venue, home), others: [] });
  }

  const grouped = groupSameSession(items);
  const ongoing = grouped
    .filter((i) => isLongRunning(i.activity))
    .sort((x, y) => (activityEndDate(x.activity) < activityEndDate(y.activity) ? -1 : 1));
  const dated = grouped.filter((i) => !isLongRunning(i.activity)).sort(chronological);

  const byDay = new Map<string, ListItem[]>();
  for (const i of dated) {
    if (!byDay.has(i.day)) byDay.set(i.day, []);
    byDay.get(i.day)!.push(i);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, list]) => ({ day, items: list }));
  return { days, ongoing, hiddenForAge, total: grouped.length };
}

/** Op dag, dan: hele dag/meerdaags eerst, daarna op begintijd, dan titel. */
function chronological(x: ListItem, y: ListItem): number {
  if (x.day !== y.day) return x.day < y.day ? -1 : 1;
  const tx = x.activity.start.length > 10 && dateOf(x.activity.start) === x.day ? x.activity.start.slice(11) : '';
  const ty = y.activity.start.length > 10 && dateOf(y.activity.start) === y.day ? y.activity.start.slice(11) : '';
  if (tx !== ty) return tx < ty ? -1 : 1;
  return x.activity.title.localeCompare(y.activity.title, 'nl');
}

/** Zelfde titel en begintijd op meerdere locaties → één regel, dichtstbijzijnde locatie voorop. */
export function groupSameSession(items: ListItem[]): ListItem[] {
  const map = new Map<string, ListItem[]>();
  for (const i of items) {
    const key = `${normalizeText(i.activity.title)}|${i.activity.start}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  }
  return [...map.values()].map((group) => {
    const sorted = [...group].sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
    return { ...sorted[0], others: sorted.slice(1).map((s) => s.activity) };
  });
}

/** Is een dag zaterdag of zondag? (voor opmaak van dagkoppen) */
export const isWeekendDay = isWeekend;
