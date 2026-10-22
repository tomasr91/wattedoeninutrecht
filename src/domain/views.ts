/**
 * De twee lijsten van de app: "Kinderen" en "Volwassenen", elk opgesplitst in
 * een chronologische agenda (eendaags t/m meerdaags) en een lijst doorlopend aanbod.
 * Pure logica, los van de UI, zodat het testbaar is.
 */
import { collapseSeries, isWeeklySeries } from './series';
import type { Activity, Category, Child, Home } from './types';
import { addDays, dateOf, diffDays, isWeekend, timeOf, weekday } from './dates';
import { childFits, type ChildFit } from './age';
import { activityEndDate, firstDateInPeriod, overlapsPeriod } from './filters';
import { DEFAULT_HOME, distanceFromHome } from './geo';
import { normalizeText } from './dedupe';
import { canonicalKind, kindLabel } from './kind';

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
  if (a.endUnknown || a.rolling || isWeeklySeries(a)) return true;
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
  // Verborgen labels, omgezet naar de samengevoegde labels (oude instellingen blijven zo werken).
  const hidden = new Set((opts.hiddenKinds ?? []).map(canonicalKind));
  let hiddenForAge = 0;
  const items: ListItem[] = [];

  for (const a of expandOccurrences(collapseSeries(activities, ctx.today))) {
    if (a.isTestData || a.status === 'verlopen') continue;
    // Zonder einddatum zou iets voor altijd blijven staan: niet tonen.
    if (hasNoEndDate(a)) continue;
    // "Doorlopend" volgens de bron, zonder einddatum (museum, doolhof, vaste avond): kan altijd → niet in deze
    // lijsten, maar in de inspiratielijst met vaste uitjes (zie inspirationList).
    if (a.rolling) continue;
    const friday = isFridayEvening(a);
    if (activityEndDate(a) < ctx.today || (!overlapsPeriod(a, window) && !friday)) continue;
    if (!matchesAudience(a, opts.audience)) continue;
    if (a.categories.some((c) => opts.excludeCategories.includes(c))) continue;
    if (hidden.size && hidden.has(kindLabel(a))) continue;
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

  const all = groupSameSession(items);
  // Bij Kinderen: geen leeftijd én geen schatting, terwijl de bron ook volwassenen noemt → niet tonen.
  // Zegt de bron alleen kinderen of gezin, dan blijft hij staan ("Leeftijd niet vermeld").
  const grouped = all.filter((i) => !(opts.audience === 'kinderen' && kidHiddenForUnknownAge(i.activity)));
  const ongoing = grouped
    .filter((i) => isLongRunning(i.activity))
    // Eerst op begindatum (wat al loopt telt als vandaag), dan op einddatum; beide oplopend.
    .sort((x, y) => effectiveStart(x.activity, ctx.today).localeCompare(effectiveStart(y.activity, ctx.today)) || activityEndDate(x.activity).localeCompare(activityEndDate(y.activity)));
  const dated = grouped.filter((i) => !isLongRunning(i.activity)).sort(chronological);

  const days = byDayList(dated);
  return { days, ongoing, hiddenForAge, total: grouped.length };
}

function byDayList(sorted: ListItem[]): { day: string; items: ListItem[] }[] {
  const byDay = new Map<string, ListItem[]>();
  for (const i of sorted) {
    if (!byDay.has(i.day)) byDay.set(i.day, []);
    byDay.get(i.day)!.push(i);
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, list]) => ({ day, items: list }));
}

/** Kinderactiviteit zonder leeftijd van de bron én zonder schatting. */
export function ageUnknown(a: Activity): boolean {
  if (a.audiences.length > 0 && a.audiences.every((x) => x === 'volwassenen')) return false;
  const g = a.age;
  return g.officialMinMonths === undefined && g.officialMaxMonths === undefined && g.estimatedMinMonths === undefined && g.estimatedMaxMonths === undefined;
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

/** Bij Kinderen niet getoond: geen leeftijd en geen schatting, en de bron noemt ook volwassenen. */
export function kidHiddenForUnknownAge(a: Activity): boolean {
  return matchesAudience(a, 'kinderen') && ageUnknown(a) && a.audiences.includes('volwassenen');
}

/**
 * Losse speeldata (bv. een voorstelling op 22 en 23 okt, of een pubquiz op 25 okt en 29 nov) zijn geen
 * doorlopend aanbod: elke datum wordt een eigen regel in de agenda. Alleen vaste wekelijkse reeksen blijven één regel.
 */
export function expandOccurrences(list: Activity[]): Activity[] {
  return list.flatMap((a) => {
    if (!a.occurrences?.length || a.rolling || isWeeklySeries(a)) return [a];
    const t = timeOf(a.start);
    return a.occurrences.map((d) => ({
      ...a,
      start: t ? `${d}T${t}` : d,
      end: undefined,
      allDay: !t,
      ongoing: undefined,
      occurrences: undefined,
      recurrenceNote: undefined,
    }));
  });
}

/** Begindatum voor het sorteren: wat al loopt, telt als vandaag. */
function effectiveStart(a: Activity, today: string): string {
  const d = dateOf(a.start);
  return d < today ? today : d;
}

/** Vaste uitjes zonder einddatum ("doorlopend" volgens de bron), voor een aparte inspiratielijst. */
export function inspirationList(activities: Activity[], audience: ListAudience): Activity[] {
  const seen = new Set<string>();
  // Vaste plekken eerst, zodat bij dezelfde naam (bv. "nijntje museum" ook uit UITagenda) de plek blijft.
  const isPlace = (a: Activity) => a.sources[0]?.sourceId === 'vaste-plekken';
  return activities
    .filter((a) => a.rolling && !a.isTestData && a.status !== 'verlopen' && a.status !== 'geannuleerd' && matchesAudience(a, audience))
    // Voorlezen wil je niet zien (net als in de agenda).
    .filter((a) => !a.categories.includes('voorlezen') && !/voorlez|voorleesuur/i.test(a.title))
    .sort((x, y) => Number(isPlace(y)) - Number(isPlace(x)))
    .filter((a) => !seen.has(normalizeText(a.title)) && seen.add(normalizeText(a.title)))
    .sort((x, y) => x.title.localeCompare(y.title, 'nl'));
}
