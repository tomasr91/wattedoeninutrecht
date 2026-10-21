import type { AgeInfo, Audience, Category, IndoorKind, Price } from './types';

/**
 * Afleidingsregels die ruwe brongegevens verrijken. Alles wat hier wordt
 * afgeleid, is een *schatting* en wordt zo ook gelabeld in de app; officiële
 * gegevens uit de bron gaan altijd voor.
 */

const Y = 12;

/** Haal een officiële leeftijdsaanduiding uit een titel of tekst. */
export function parseAgeLabel(text: string): Pick<AgeInfo, 'officialMinMonths' | 'officialMaxMonths' | 'label'> | null {
  const t = text.toLowerCase();

  // Maanden: "(6-18 mnd)", "6-18 maanden"
  const mnd = t.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:mnd|maanden)\b/);
  if (mnd) {
    const a = Number(mnd[1]);
    const b = Number(mnd[2]);
    if (a <= b && b <= 36) return { officialMinMonths: a, officialMaxMonths: b, label: `${a}-${b} mnd` };
  }
  // Halve jaren: "(0,5+)", "1,5+", "2.5+"
  const half = t.match(/(?:^|[\s(])(\d{1,2})[,.](\d)\s*\+/);
  if (half) {
    const months = Math.round((Number(half[1]) + Number(half[2]) / 10) * Y);
    return { officialMinMonths: months, label: `${half[1]},${half[2]}+` };
  }
  // "0+/2+" → laagste ondergrens
  const multi = t.match(/\((\d{1,2})\+\s*\/\s*(\d{1,2})\+\)/);
  if (multi) {
    const a = Number(multi[1]);
    return { officialMinMonths: a * Y, label: `${multi[1]}+` };
  }
  // "(2-4 jaar)", "2 - 4 jaar", "4-8 jr", "8-13 jaar"
  const range = t.match(/(?:^|[\s(])(\d{1,2})\s*[-–t/m]+\s*(\d{1,2})\s*(?:jaar|jr)\b/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (a <= b && b <= 18) return { officialMinMonths: a * Y, officialMaxMonths: b * Y, label: `${a}-${b} jaar` };
  }
  // "(6-12 jaar)" zonder spatie al gedekt; "(4+)", "4+", "vanaf 4 jaar"
  const plus = t.match(/(?:^|[\s(])(\d{1,2})\s*\+(?!\d)/);
  if (plus) {
    const a = Number(plus[1]);
    if (a <= 18) return { officialMinMonths: a * Y, label: `${a}+` };
  }
  const vanaf = t.match(/vanaf\s+(\d{1,2})\s*(?:jaar|jr)/);
  if (vanaf) {
    const a = Number(vanaf[1]);
    if (a <= 18) return { officialMinMonths: a * Y, label: `${a}+` };
  }
  // "55-plussers" etc. zijn volwassenen — bewust niet als kinderleeftijd.
  return null;
}

interface Rule {
  test: RegExp;
  categories?: Category[];
  audiences?: Audience[];
  estMin?: number;
  estMax?: number;
  fit?: string[];
  cautions?: string[];
  indoor?: IndoorKind;
  durationMinutes?: number;
  special?: boolean;
}

/** Volgorde is van belang: specifiek vóór generiek. */
const RULES: Rule[] = [
  { test: /babyconcert|baby\s*concert|muziek op schoot|krulmuziek/, categories: ['muziek'], audiences: ['kinderen', 'gezin'], estMin: 0, estMax: 3 * Y, fit: ['Kort concert voor de allerkleinsten', 'Ouder blijft erbij'], indoor: 'binnen', durationMinutes: 30 },
  { test: /voorlez|voorleesochtend|leesfeest|prentenboek/, categories: ['voorlezen'], audiences: ['kinderen'], estMin: 2 * Y, estMax: 6 * Y, fit: ['Korte duur (circa 30 min)', 'Rustig en interactief'], indoor: 'binnen', durationMinutes: 30 },
  { test: /knutsel|kleuren|maak je eigen|creatief/, categories: ['workshop'], audiences: ['kinderen'], estMin: 3 * Y, fit: ['Zelf iets maken (met hulp van een ouder)'], indoor: 'binnen' },
  { test: /peuter|dreumes|kleuter/, audiences: ['kinderen'], estMin: 18, estMax: 6 * Y, fit: ['Speciaal voor jonge kinderen'] },
  { test: /sint[\s-]?maarten|lampion/, categories: ['feest'], audiences: ['gezin', 'kinderen'], estMin: 0, fit: ['Lichtjes en muziek, zelf tempo bepalen'], cautions: ['Begint na het avondeten'], indoor: 'buiten', special: true },
  { test: /sinterklaas|intocht|pietenhuis|huis van sinterklaas/, categories: ['feest'], audiences: ['gezin', 'kinderen'], estMin: 18, estMax: 9 * Y, fit: ['Sinterklaasfeest voor jonge kinderen'], cautions: ['Kan druk zijn'], special: true },
  { test: /kerst|winter\s?kost|lichtjes|lumineu|kerstmarkt|winterfair/, categories: ['feest'], special: true },
  { test: /speurtocht|zoektocht|ontdekkingstocht/, categories: ['spel'], audiences: ['gezin', 'kinderen'], estMin: 4 * Y, fit: ['Eigen tempo, vrij in te delen'] },
  { test: /spelletjes|bordspel|lego|destiny|game/, categories: ['spel'], audiences: ['kinderen'], estMin: 5 * Y, indoor: 'binnen' },
  { test: /kinderboerderij|stadsboerderij|dieren|huisdier|pony|paard/, categories: ['natuur'], audiences: ['gezin', 'kinderen'], estMin: 1 * Y, fit: ['Dieren kijken en aaien'], indoor: 'buiten' },
  { test: /herfststukjes|jeugdtheater|familievoorstelling|poppenkast|poppenspel|figurentheater/, categories: ['theater'], audiences: ['kinderen', 'gezin'] },
  { test: /concert|muziek|orkest|band|festival.*muziek/, categories: ['muziek'] },
  { test: /festival|parade|fair\b|fest\b/, categories: ['festival'], special: true },
  { test: /markt|braderie|winterwinkelen/, categories: ['markt'], audiences: ['volwassenen', 'gezin'] },
  { test: /tentoonstelling|expositie|expo\b|installatie/, categories: ['expositie'] },
  { test: /museum/, categories: ['museum'], indoor: 'binnen' },
  { test: /rondleiding|rondvaart|wandeling|fietstocht/, categories: ['rondleiding'] },
  { test: /workshop|cursus|les\b|lab\b/, categories: ['workshop'] },
  { test: /lezing|talk|symposium|boekenclub|debat|studium generale/, categories: ['lezing'], audiences: ['volwassenen'] },
  { test: /film|bioscoop/, categories: ['film'] },
  { test: /cabaret|comedy|stand-up|stand up|dans|ballet|toneel|theater|musical|show/, categories: ['theater'] },
  { test: /bos|park|natuur|tuin|moestuin|buiten/, categories: ['natuur'] },
];

const ADULT_HINTS = /(55-?plus|spreekuur|digicaf|workshop digitaal|samen nederlands|taalcaf|nightlife|wijn|bier|borrel|comedy|cabaret|stand-up|lezing|symposium|boekenclub|cursus|studium generale|dyslexiecaf|handwerkclub|breiclub|meet-?up|inloopspreekuur|scheidingscaf|voorouder)/;

export interface Enrichment {
  categories: Category[];
  audiences: Audience[];
  age: AgeInfo;
  indoor: IndoorKind;
  durationMinutes?: number;
  special: boolean;
}

/**
 * Verrijk op basis van titel, bronlabels en (optioneel) omschrijving.
 * `sourceHints` mag doelgroeplabels van de bron bevatten (bv. "Jeugd", "Gezinnen").
 */
export function enrich(input: {
  title: string;
  description?: string;
  sourceHints?: string[];
  startTime?: string;
}): Enrichment {
  const text = `${input.title} ${(input.sourceHints ?? []).join(' ')}`.toLowerCase();
  const full = `${text} ${(input.description ?? '').toLowerCase()}`;

  const categories = new Set<Category>();
  const audiences = new Set<Audience>();
  const fit: string[] = [];
  const cautions: string[] = [];
  let estMin: number | undefined;
  let estMax: number | undefined;
  let indoor: IndoorKind = 'onbekend';
  let durationMinutes: number | undefined;
  let special = false;

  for (const r of RULES) {
    if (!r.test.test(text)) continue;
    r.categories?.forEach((c) => categories.add(c));
    r.audiences?.forEach((a) => audiences.add(a));
    if (estMin === undefined && r.estMin !== undefined) estMin = r.estMin;
    if (estMax === undefined && r.estMax !== undefined) estMax = r.estMax;
    r.fit?.forEach((f) => fit.includes(f) || fit.push(f));
    r.cautions?.forEach((c) => cautions.includes(c) || cautions.push(c));
    if (indoor === 'onbekend' && r.indoor) indoor = r.indoor;
    if (durationMinutes === undefined && r.durationMinutes) durationMinutes = r.durationMinutes;
    if (r.special) special = true;
  }

  // Bronlabels voor doelgroep
  const hints = (input.sourceHints ?? []).map((h) => h.toLowerCase());
  if (hints.some((h) => /jeugd|kinderen|kids|jeugdtheater/.test(h))) audiences.add('kinderen');
  if (hints.some((h) => /gezin|familie/.test(h))) audiences.add('gezin');
  if (hints.some((h) => /volwassen|regulier/.test(h))) audiences.add('volwassenen');

  const official = parseAgeLabel(input.title) ?? parseAgeLabel(hints.join(' '));
  if (official) {
    audiences.add('kinderen');
    // Theater met alleen een ondergrens: gezinsvoorstelling
    if (categories.has('theater')) audiences.add('gezin');
  }

  if (audiences.size === 0) {
    audiences.add(ADULT_HINTS.test(text) ? 'volwassenen' : 'volwassenen');
  }
  if (ADULT_HINTS.test(text) && !official) {
    audiences.delete('kinderen');
    audiences.delete('gezin');
    audiences.add('volwassenen');
  }

  if (categories.size === 0) categories.add('overig');

  // Algemene aandachtspunten voor jonge kinderen
  const t = input.startTime;
  if (t && Number(t.slice(0, 2)) >= 19 && (audiences.has('kinderen') || audiences.has('gezin'))) {
    cautions.push('Laat op de dag voor peuters');
  }
  if (categories.has('theater') && (audiences.has('kinderen') || audiences.has('gezin'))) {
    if (official?.officialMinMonths !== undefined && official.officialMinMonths <= 3 * Y) {
      fit.push('Voorstelling gemaakt voor peuters');
    } else {
      cautions.push('Zitvoorstelling: vraagt concentratie');
    }
  }
  if (/prikkel|luid|harde muziek|donker/.test(full)) cautions.push('Mogelijk prikkelrijk');

  const age: AgeInfo = {
    ...(official ?? {}),
    estimatedMinMonths: estMin,
    estimatedMaxMonths: estMax,
    fitReasons: fit.length ? fit : undefined,
    cautions: cautions.length ? cautions : undefined,
  };

  // Theater zonder officiële leeftijd: geschat vanaf 4 jaar
  if (!official && categories.has('theater') && audiences.has('kinderen') && estMin === undefined) {
    age.estimatedMinMonths = 4 * Y;
  }

  return { categories: [...categories], audiences: [...audiences], age, indoor, durationMinutes, special };
}

/** Prijs uit vrije tekst: "Gratis", "€ 7 lid / € 10 niet-lid", "€ 12,50". */
export function parsePrice(text?: string): Price {
  if (!text) return { kind: 'onbekend' };
  const t = text.trim();
  if (/gratis|vrij entree|vrije toegang|free\b/i.test(t) && !/€\s*\d/.test(t)) {
    return { kind: 'gratis', text: t };
  }
  const amounts = [...t.matchAll(/€\s*(\d+(?:[.,]\d{1,2})?)/g)].map((m) => Number(m[1].replace(',', '.')));
  if (amounts.length) {
    return { kind: 'betaald', text: t, minEur: Math.min(...amounts), maxEur: Math.max(...amounts) };
  }
  return { kind: 'onbekend', text: t };
}
