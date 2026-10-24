import type { Activity, Confidence } from './types';
import { dateOf, timeOf } from './dates';
import { haversineKm } from './geo';

/** Kleine, deterministische hash (FNV-1a, 52 bits) voor stabiele ID's — browser én Node. */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).slice(0, 12);
}

const STOP = new Set(['de', 'het', 'een', 'en', 'in', 'van', 'op', 'met', 'voor', 'the', 'a', 'of', 'bij', 'jaar']);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(\s*\d{1,2}\s*[+\-–][^)]*\)/g, ' ') // (4+), (2-4 jaar)
    .replace(/\b\d{1,2}\s*\+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t)));
}

/** Overlap gemeten aan de kleinste set: "Producent: Titel" ≈ "Titel". */
export function containment(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

function titleSimilar(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return true;
  const minTokens = Math.min(tokens(a).size, tokens(b).size);
  return minTokens >= 2 && containment(a, b) >= 0.8;
}

function venueSimilar(x: Activity, y: Activity): boolean {
  const vx = x.venue;
  const vy = y.venue;
  if (/diverse|meerdere|onbekend/i.test(vx.name) || /diverse|meerdere|onbekend/i.test(vy.name)) return true;
  if (vx.lat !== undefined && vy.lat !== undefined && vx.geoPrecision !== 'unknown' && vy.geoPrecision !== 'unknown') {
    if (haversineKm(vx.lat, vx.lon!, vy.lat, vy.lon!) < 0.35) return true;
  }
  return containment(vx.name, vy.name) >= 0.66;
}

/** Zijn twee records waarschijnlijk hetzelfde evenement? */
export function isDuplicate(x: Activity, y: Activity): boolean {
  // Zelfde bron + bron-ID is per definitie hetzelfde
  for (const sx of x.sources) {
    for (const sy of y.sources) {
      if (sx.sourceId === sy.sourceId && sx.sourceEventId && sx.sourceEventId === sy.sourceEventId) return true;
    }
  }
  if (dateOf(x.start) !== dateOf(y.start)) return false;
  const tx = timeOf(x.start);
  const ty = timeOf(y.start);
  if (tx && ty && tx !== ty) return false;
  if (titleSimilar(x.title, y.title) && venueSimilar(x, y)) return true;
  // Zelfde plek en precies dezelfde begintijd is een sterk signaal. Dan is één gedeeld, onderscheidend woord
  // in de titel genoeg ("Kluizelaar (2+)" ≈ "Simone de Jong Company: Kluizelaar (2+)", ook bij een tikfout).
  return !!tx && tx === ty && venueSimilar(x, y) && sharesDistinctWord(x.title, y.title);
}

/** Woorden die op dezelfde avond in één zaal vaak in verschillende titels staan. */
const GENERIC = new Set([
  'utrecht', 'tivolivredenburg', 'live', 'night', 'nacht', 'show', 'orkest', 'concert', 'theater', 'voorstelling', 'festival',
  'halloween', 'edition', 'special', 'presents', 'tour', 'workshop', 'rondleiding', 'opening', 'tentoonstelling', 'muziek',
  'with', 'feat', 'and', 'from', 'jubileum', 'kerst', 'sint', 'club', 'party', 'comedy', 'stadsschouwburg',
]);

function sharesDistinctWord(a: string, b: string): boolean {
  // Zelfde reeksnaam vóór de dubbele punt ("Cinekid: …") zegt niets: haal die weg.
  const pa = a.split(':');
  const pb = b.split(':');
  if (pa.length > 1 && pb.length > 1 && normalizeText(pa[0]) === normalizeText(pb[0])) {
    a = pa.slice(1).join(':');
    b = pb.slice(1).join(':');
  }
  const A = [...tokens(a)].filter((t) => t.length >= 4 && !GENERIC.has(t) && !/^\d+$/.test(t));
  const B = [...tokens(b)].filter((t) => t.length >= 4 && !GENERIC.has(t) && !/^\d+$/.test(t));
  return A.some((t) => B.some((u) => t === u || (t.length >= 5 && u.length >= 5 && editDistanceAtMostOne(t, u))));
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const CONF_RANK: Record<Confidence, number> = { hoog: 3, middel: 2, laag: 1 };

function completeness(a: Activity): number {
  let n = 0;
  if (timeOf(a.start)) n++;
  if (a.end) n++;
  if (a.price.kind !== 'onbekend') n++;
  if (a.booking.status !== 'onbekend') n++;
  if (a.venue.geoPrecision !== 'unknown') n++;
  if (a.age.officialMinMonths !== undefined) n++;
  if (a.summary) n++;
  return n;
}

/** Voeg twee records samen. Het rijkste/betrouwbaarste record is leidend; bronnen worden gebundeld. */
export function mergeActivities(x: Activity, y: Activity): Activity {
  const [p, s] =
    CONF_RANK[x.confidence] * 10 + completeness(x) >= CONF_RANK[y.confidence] * 10 + completeness(y) ? [x, y] : [y, x];
  const sources = [...p.sources];
  for (const src of s.sources) {
    if (!sources.some((q) => q.sourceId === src.sourceId && q.url === src.url)) sources.push(src);
  }
  const lastChecked = [p.lastChecked, s.lastChecked].sort().at(-1)!;
  // Een bron die bewust geen begintijd geeft omdat de tijden per dag verschillen (met openingstijden erbij),
  // gaat voor: anders zou de tijd van dag 1 op de kaart staan alsof die elke dag geldt.
  const varies = [p, s].find((x) => x.openingNote && !timeOf(x.start) && x.end && dateOf(x.end) !== dateOf(x.start));
  const start = varies ? varies.start : timeOf(p.start) ? p.start : timeOf(s.start) ? s.start : p.start;
  const priceKnown = p.price.kind !== 'onbekend' || s.price.kind !== 'onbekend';
  return {
    ...p,
    start,
    end: p.end ?? s.end,
    summary: p.summary ?? s.summary,
    openingNote: p.openingNote ?? s.openingNote,
    venue: p.venue.geoPrecision === 'unknown' && s.venue.geoPrecision !== 'unknown' ? s.venue : p.venue,
    age: {
      ...s.age,
      ...Object.fromEntries(Object.entries(p.age).filter(([, v]) => v !== undefined)),
    },
    price: p.price.kind === 'onbekend' ? s.price : p.price,
    booking: p.booking.status === 'onbekend' ? s.booking : p.booking,
    indoor: p.indoor === 'onbekend' ? s.indoor : p.indoor,
    categories: [...new Set([...p.categories, ...s.categories])],
    audiences: [...new Set([...p.audiences, ...s.audiences])],
    // Een annulering in één bron is belangrijk genoeg om over te nemen
    status: p.status === 'geannuleerd' || s.status === 'geannuleerd' ? 'geannuleerd' : p.status,
    special: p.special || s.special,
    // Onzekerheid die door de andere bron is opgelost, vervalt
    uncertainties: [...new Set([...p.uncertainties, ...s.uncertainties])].filter(
      (u) => !(/begintijd/i.test(u) && timeOf(start)) && !(/prijs/i.test(u) && priceKnown),
    ),
    sources,
    lastChecked,
  };
}

/** Ontdubbel een lijst; geeft het resultaat en het aantal samenvoegingen terug. */
export function dedupe(list: Activity[]): { activities: Activity[]; merged: number } {
  const out: Activity[] = [];
  let merged = 0;
  // Groeperen op datum houdt dit O(n·k) in plaats van O(n²)
  const byDate = new Map<string, number[]>();
  for (const a of list) {
    const key = dateOf(a.start);
    const idxs = byDate.get(key) ?? [];
    let hit = -1;
    for (const i of idxs) {
      if (isDuplicate(out[i], a)) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) {
      out[hit] = mergeActivities(out[hit], a);
      merged++;
    } else {
      idxs.push(out.length);
      byDate.set(key, idxs);
      out.push(a);
    }
  }
  return { activities: out, merged };
}
