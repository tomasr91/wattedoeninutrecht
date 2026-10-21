import type { Activity, Profile, ScoreWeights } from './types';
import { childFits, type ChildFit } from './age';
import { dateOf, diffDays, isWeekend, timeOf, weekday } from './dates';
import { distanceFromHome } from './geo';
import { firstDateInPeriod, type Period } from './filters';

export const DEFAULT_WEIGHTS: ScoreWeights = {
  age: 30,
  distance: 25,
  interest: 20,
  practicality: 15,
  quality: 10,
};

export interface ScoreBreakdown {
  total: number;
  components: Record<keyof ScoreWeights, number>;
  lens: 'gezin' | 'volwassenen';
  reasons: string[];
  fits: ChildFit[];
  km?: number;
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));

function isAdultOnly(a: Activity) {
  return a.audiences.length > 0 && a.audiences.every((x) => x === 'volwassenen');
}

/** Leeftijd: hoe goed past dit bij de kinderen *op de datum van de activiteit*? */
function ageComponent(fits: ChildFit[]): number {
  if (fits.length === 0) return 0.5;
  const v = (f: ChildFit) =>
    ({ geschikt: 1, mogelijk: 0.55, onbekend: 0.35, 'te-jong': 0, 'te-oud': 0.1, 'niet-voor-kinderen': 0 })[f.fit];
  const vals = fits.map(v);
  const best = Math.max(...vals);
  const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
  // Beide kinderen geschikt is het mooist; één kind geschikt is nog steeds een goede optie.
  return clamp(0.6 * avg + 0.4 * best);
}

/**
 * Afstand: kinderactiviteiten krijgen een sterke voorkeur voor Leidsche Rijn,
 * volwassenenactiviteiten een mildere afstandscurve (de binnenstad is prima).
 */
function distanceComponent(a: Activity, km: number | undefined, profile: Profile, lens: ScoreBreakdown['lens']): number {
  const pref = profile.leidscheRijnPreference; // 0..2
  if (km === undefined) {
    // Geen coördinaten: val terug op zone
    const z = { 'leidsche-rijn': 0.9, utrecht: 0.6, omgeving: 0.3 }[a.zone];
    return z;
  }
  const max = Math.max(5, profile.maxDistanceKm);
  if (lens === 'volwassenen') {
    return clamp(1 - (km / max) * 0.8);
  }
  // Gezin: steilere curve + bonus voor Leidsche Rijn
  const base = clamp(1 - Math.pow(km / max, 0.6));
  const lrBonus = a.zone === 'leidsche-rijn' ? 0.15 * pref : 0;
  return clamp(base + lrBonus);
}

function interestComponent(a: Activity, profile: Profile, lens: ScoreBreakdown['lens']): number {
  const hits = a.categories.filter((c) => profile.interests.includes(c)).length;
  let s = hits > 0 ? 0.6 + 0.2 * Math.min(2, hits) : 0.3;
  if (lens === 'gezin' && (a.audiences.includes('gezin') || a.audiences.includes('kinderen'))) s += 0.1;
  if (a.special) s += 0.25; // bijzonder evenement mag een doorsnee activiteit dichtbij overtreffen
  return clamp(s);
}

/** Praktisch haalbaar voor een gezin met jonge kinderen? */
function practicalityComponent(a: Activity, today: string, period: Period, lens: ScoreBreakdown['lens']): number {
  const day = firstDateInPeriod(a, period);
  const t = timeOf(a.start);
  let s = 0.6;
  if (lens === 'gezin') {
    if (isWeekend(day) || weekday(day) === 3) s += 0.2; // weekend en woensdag(middag)
    if (t) {
      const h = Number(t.slice(0, 2));
      if (h >= 9 && h < 12) s += 0.15;
      else if (h >= 15 && h < 17) s += 0.1;
      else if (h >= 18) s -= 0.35;
      else if (h >= 12 && h < 15) s -= 0.05; // middagslaapje van de jongste
    }
    if (a.durationMinutes && a.durationMinutes > 90) s -= 0.1;
  } else {
    if (t && Number(t.slice(0, 2)) >= 19) s += 0.1;
  }
  if (a.status === 'uitverkocht') s -= 0.5;
  // Binnenkort is iets relevanter, maar niet te sterk
  const inDays = diffDays(today, day);
  s += inDays <= 7 ? 0.1 : inDays <= 21 ? 0.05 : 0;
  return clamp(s);
}

function qualityComponent(a: Activity, today: string): number {
  let s = { hoog: 0.9, middel: 0.65, laag: 0.35 }[a.confidence];
  const age = diffDays(dateOf(a.lastChecked), today);
  if (age > 14) s -= 0.2;
  else if (age > 7) s -= 0.1;
  if (timeOf(a.start) || a.allDay) s += 0.05;
  if (a.price.kind !== 'onbekend') s += 0.05; // onbekende prijs: lichte aftrek, nooit uitsluiten
  return clamp(s);
}

export function scoreActivity(
  a: Activity,
  profile: Profile,
  ctx: { today: string; period: Period },
): ScoreBreakdown {
  const adultOnly = isAdultOnly(a);
  const lens: ScoreBreakdown['lens'] = adultOnly ? 'volwassenen' : 'gezin';
  const fits = childFits(a, profile.children, firstDateInPeriod(a, ctx.period));
  const km = distanceFromHome(a.venue, profile.home);
  const w = profile.weights;

  const components = {
    age: lens === 'gezin' ? ageComponent(fits) : profile.includeAdults ? 0.75 : 0.2,
    distance: distanceComponent(a, km, profile, lens),
    interest: interestComponent(a, profile, lens),
    practicality: practicalityComponent(a, ctx.today, ctx.period, lens),
    quality: qualityComponent(a, ctx.today),
  };
  const wSum = w.age + w.distance + w.interest + w.practicality + w.quality || 1;
  const total =
    (100 *
      (components.age * w.age +
        components.distance * w.distance +
        components.interest * w.interest +
        components.practicality * w.practicality +
        components.quality * w.quality)) /
    wSum;

  return { total: Math.round(total * 10) / 10, components, lens, reasons: explain(a, fits, km, lens), fits, km };
}

/** Korte, menselijke uitleg bij een aanbeveling. */
export function explain(a: Activity, fits: ChildFit[], km: number | undefined, lens: ScoreBreakdown['lens']): string[] {
  const r: string[] = [];
  if (lens === 'gezin') {
    const good = fits.filter((f) => f.fit === 'geschikt');
    if (good.length === fits.length && fits.length > 1) r.push('Goed passend voor beide kinderen');
    else if (good.length === 1) r.push(`Past bij ${good[0].childName}`);
    else if (fits.some((f) => f.fit === 'mogelijk')) r.push('Misschien net wat jong — kijk even naar de leeftijd');
  } else {
    r.push('Interessant voor volwassenen');
  }
  if (a.zone === 'leidsche-rijn') r.push('Dichtbij in Leidsche Rijn');
  else if (km !== undefined && km < 6) r.push('Op korte afstand van Leidsche Rijn');
  if (a.special) r.push('Bijzonder of seizoensgebonden');
  if (a.price.kind === 'gratis') r.push('Gratis');
  if (a.indoor === 'binnen' && lens === 'gezin') r.push('Ideaal voor een regenachtige middag');
  if (a.age.fitReasons?.length && lens === 'gezin') r.push(a.age.fitReasons[0]);
  return r.slice(0, 4);
}

/**
 * Aanbevelingen met variatie: kies greedy de hoogste score, maar straf herhaling
 * van dezelfde reeks, categorie, locatie en prijsklasse af.
 */
export function diversify<T extends { activity: Activity; score: ScoreBreakdown }>(items: T[], n: number): T[] {
  const sorted = [...items].sort((x, y) => y.score.total - x.score.total);
  const picked: T[] = [];
  const seen = { series: new Map<string, number>(), cat: new Map<string, number>(), venue: new Map<string, number>(), free: 0 };
  while (picked.length < n && sorted.length) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const { activity: a, score } = sorted[i];
      let pen = 0;
      const sk = a.seriesKey ?? a.id;
      pen += (seen.series.get(sk) ?? 0) * 25;
      pen += (seen.venue.get(a.venue.name) ?? 0) * 6;
      for (const c of a.categories) pen += (seen.cat.get(c) ?? 0) * 4;
      if (a.price.kind === 'gratis') pen += seen.free * 2;
      const val = score.total - pen;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = i;
      }
    }
    const [chosen] = sorted.splice(bestIdx, 1);
    picked.push(chosen);
    const a = chosen.activity;
    const sk = a.seriesKey ?? a.id;
    seen.series.set(sk, (seen.series.get(sk) ?? 0) + 1);
    seen.venue.set(a.venue.name, (seen.venue.get(a.venue.name) ?? 0) + 1);
    for (const c of a.categories) seen.cat.set(c, (seen.cat.get(c) ?? 0) + 1);
    if (a.price.kind === 'gratis') seen.free++;
  }
  return picked;
}
