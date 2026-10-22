import type { Activity, Category } from './types';

const CATEGORY_KIND: Partial<Record<Category, string>> = {
  theater: 'Theater', muziek: 'Concert', museum: 'Museum', expositie: 'Expositie', workshop: 'Workshop',
  festival: 'Festival', markt: 'Markt', feest: 'Feest', natuur: 'Natuur & dieren', spel: 'Speurtocht & spel',
  rondleiding: 'Rondleiding', sport: 'Sport', film: 'Film', lezing: 'Lezing', voorlezen: 'Voorlezen',
};

/** Label voor activiteiten zonder duidelijke soort. */
export const NO_KIND = 'Overig';

/**
 * Laatste redmiddel op de titel, voor aanbod dat de bron als "Diversen" of zonder
 * soort aanlevert. Specifiek vóór generiek; de eerste treffer telt.
 */
const TITLE_KIND: [RegExp, string][] = [
  [/nightlife|clubnacht|\bdj\b|dj-set|all night long|\bhouse\b|techno|silent disco|\bparty\b|fiesta|karaoke|dansavond|danceparty|\brave\b/, 'Uitgaan'],
  [/pub ?quiz|\bquiz\b|bingo|spelletjes|game night|bordspel|escape/, 'Speurtocht & spel'],
  [/cursus|\bles\b|lessen|masterclass|coderdojo|programmeer/, 'Workshop'],
  [/ukkie|peuter(uur|ochtend)|speelochtend|speelmiddag/, 'Spelen'],
  [/herfstvakantie|kerstvakantie|meivakantie|zomervakantie|voorjaarsvakantie/, 'Feest & festival'],
  [/erfgoed|openstelling|open huis|open dag/, 'Rondleiding'],
  [/gast van de raad|u-caf|swap ?shop/, 'Ontmoeting'],
  [/\bsalons?\b/, 'Lezing'],
  [/\bcrew\b|breakdance|hip ?hop/, 'Dans'],
  [/taalcaf|scheidingscaf|rouw|lotgenot|praatgroep|mannentafel|vrouwentafel|burn-?out|spreekuur|inloop|troost|alle talen/, 'Ontmoeting'],
  [/studium generale|podcast/, 'Lezing'],
  [/diner|proeverij|proeven|wijn|\bbier|beaujolais|tap ?takeover|voorproevers|food|brunch|high tea|spijs/, 'Eten & drinken'],
  [/kitsch of kunst|wintermarkt|winter market|feestmarkt|kerstmarkt|vlooienmarkt|rommelmarkt/, 'Markt'],
  [/pechakucha|\btalk\b|lezing|debat|gesprek|mannentafel|vrouwentafel|filosof|boekpresentatie|presentatie|signeer|schrijver|auteur|interview/, 'Lezing'],
  [/open mic|open podium|poetry|spoken word|storytelling|voordracht/, 'Voorstelling'],
  [/workshop|collage|craft|knutsel|schrijfcaf|schrijf|yoga|maak je|atelier|cursus|masterclass/, 'Workshop'],
  [/wandeling|wandelroute|tour\b|route\b|rondleiding|kijken\b|by night|fietstocht|muurschildering/, 'Rondleiding'],
  [/run\b|loop\b|hardloop|marathon|fietsen|sport|zwem/, 'Sport'],
  [/slaapfeest|feestje|is jarig|verjaardag|feest\b|kermis/, 'Feest'],
  [/markt|braderie|fair\b/, 'Markt'],
];

/**
 * Labels die verschillende bronnen anders noemen maar hetzelfde bedoelen, samengevoegd tot één label.
 * Zo kun je bij Interesses één keer kiezen.
 */
export const KIND_ALIASES: Record<string, string> = {
  Cabaret: 'Comedy',
  'Stand-up': 'Comedy',
  'Comedy & cabaret': 'Comedy',
  Toneel: 'Theater',
  Voorstelling: 'Theater',
  Show: 'Theater',
  Muziektheater: 'Theater',
  Jeugdtheater: 'Kindertheater',
  Familievoorstelling: 'Kindertheater',
  Kinderconcert: 'Kindertheater',
  Kinderfilm: 'Film',
  Kleuterbios: 'Film',
  Kinderboerderij: 'Natuur & dieren',
  Natuur: 'Natuur & dieren',
  Speurtocht: 'Speurtocht & spel',
  Lichtkunst: 'Lichtroute',
  Feest: 'Feest & seizoen',
  Halloween: 'Feest & seizoen',
  Sinterklaas: 'Feest & seizoen',
  Kerst: 'Feest & seizoen',
  Theatercollege: 'Lezing',
  'Gesprek & workshop': 'Lezing',
  Jaarbeurs: 'Beurs & evenement',
  Club: 'Uitgaan',
};

/**
 * Muziek: altijd "Concert · <genre>", zodat duidelijk is dát het een concert is en daarna welk genre.
 * Bronnen noemen genres net anders; deze lijst trekt ze gelijk.
 */
const MUSIC_GENRES: Record<string, string> = {
  Pop: 'Pop & rock',
  Rock: 'Pop & rock',
  'Pop & rock': 'Pop & rock',
  Indie: 'Indie',
  'Singer-songwriter': 'Singer-songwriter',
  'Roots & americana': 'Roots & americana',
  'Metal & punk': 'Metal & punk',
  Metal: 'Metal & punk',
  Punk: 'Metal & punk',
  'Classic pop': 'Classic pop',
  Nederlandstalig: 'Nederlandstalig',
  Elektronisch: 'Elektronisch',
  Jazz: 'Jazz',
  'Soul & funk': 'Soul & funk',
  Klassiek: 'Klassiek',
  'Klassieke muziek': 'Klassiek',
  Wereld: 'Wereldmuziek',
  Wereldmuziek: 'Wereldmuziek',
  Opera: 'Opera',
};

const NOT_MUSIC: Record<string, string> = { Jeugdtheater: 'Kindertheater', Culinair: 'Eten & drinken', Theater: 'Theater', Comedy: 'Comedy' };

/**
 * De vaste lijst: elk item krijgt precies één van deze labels (plus Concert · genre).
 * Doel: in één oogopslag zien wat het is, en per soort kunnen uitzetten. Geen overlap.
 */
export const KINDS = [
  'Kindervoorstelling', 'Theater', 'Dans', 'Comedy', 'Concert', 'Film', 'Lezing', 'Workshop', 'Speurtocht & spel',
  'Rondleiding', 'Sport & zwemmen', 'Spelen', 'Natuur & dieren', 'Museum', 'Expositie', 'Feest & festival', 'Markt',
  'Uitgaan', 'Eten & drinken', 'Ontmoeting',
] as const;

/** Oude en fijnere labels → het label uit KINDS. */
const TO_FINAL: Record<string, string> = {
  Kindertheater: 'Kindervoorstelling',
  Musical: 'Theater',
  Voorstelling: 'Theater',
  Podcast: 'Lezing',
  'Doe-activiteit': 'Workshop',
  'Cursus & ontmoeting': 'Ontmoeting',
  Sport: 'Sport & zwemmen',
  Zwemmen: 'Sport & zwemmen',
  'Spelen binnen': 'Spelen',
  'Spelen buiten': 'Spelen',
  Sterrenkijken: 'Museum',
  Belevenis: 'Expositie',
  Festival: 'Feest & festival',
  'Feest & seizoen': 'Feest & festival',
  Lichtroute: 'Feest & festival',
  'Beurs & evenement': 'Feest & festival',
};

function aliasKind(k: string): string {
  if (k.startsWith('Concert · ')) {
    const g = k.slice('Concert · '.length);
    // Subgenres van UITagenda die geen muziekgenre zijn.
    if (NOT_MUSIC[g]) return NOT_MUSIC[g];
    if (/^overige/i.test(g)) return 'Concert';
    return `Concert · ${MUSIC_GENRES[g] ?? g}`;
  }
  if (MUSIC_GENRES[k]) return `Concert · ${MUSIC_GENRES[k]}`;
  return KIND_ALIASES[k] ?? k;
}

/** Label na samenvoegen: altijd een label uit KINDS (of Concert · genre). Ook voor eerder verborgen labels. */
export function canonicalKind(k: string): string {
  const a = aliasKind(k);
  return TO_FINAL[a] ?? a;
}

/**
 * Bijstellen van een te grof bronlabel aan de hand van de titel. UITagenda zet bv. alles van musea onder
 * "Musea & exposities", ook een doolhof, een sterrenkijkavond of een rondleiding.
 */
const REFINE: { from: RegExp; test: RegExp; to: string }[] = [
  { from: /^(expositie|museum|lezing|festival|theater)$/i, test: /rondleiding|\btour\b|podwalk|stadswandeling|wandelroute|puzzeltocht|speurtocht/, to: 'Rondleiding' },
  { from: /^(expositie|museum)$/i, test: /familiespel|doe-expo|archeolab|weekendactiviteit|kunstlokaal|verjaardagsfeest|mysterybox|voetzoekertjes|spoordieren|kinderactiviteit|workshop/, to: 'Doe-activiteit' },
  { from: /^(expositie|museum)$/i, test: /kijkavond|sterrenkijk|zon op zondag|sonnenborgh by night/, to: 'Sterrenkijken' },
  { from: /^(expositie)$/i, test: /museum\b|museum$|^domunder$|^dom ?under/, to: 'Museum' },
  { from: /^(expositie|museum)$/i, test: /doolhof|\bmaze\b|immersive|beleving/, to: 'Belevenis' },
];

type KindInput = Pick<Activity, 'kind' | 'categories'> & {
  title?: string;
  start?: string;
  audiences?: Activity['audiences'];
  age?: Pick<Activity['age'], 'officialMaxMonths'>;
  summary?: string;
};

/** Wat is het? Precies één label uit KINDS (of Concert · genre). */
export function kindLabel(a: KindInput): string {
  let k = canonicalKind(fineKindLabel(a));
  if (k === 'Feest & festival') k = festivalKind(a) ?? k;
  // Voorstelling of concert voor kinderen: Kindervoorstelling, zodat je Theater bij volwassenen los kunt uitzetten.
  if ((k === 'Theater' || k === 'Dans' || k.startsWith('Concert')) && forKids(a)) return 'Kindervoorstelling';
  return k;
}

/**
 * "Festival" zegt weinig over wat je gaat doen: een wijnfestival is eten en drinken, een poëziefestival een lezing,
 * Le Guess Who? een concert. Feest & festival blijft voor feestdagen (Halloween, Sint, kerst, Sint-Maarten),
 * lichtroutes en brede stadsfestivals.
 */
const FESTIVAL_KIND: [RegExp, string][] = [
  [/voorlees|voorlez/, 'Voorlezen'],
  [/workshop|knutsel|maak je/, 'Workshop'],
  [/grief|rouw|verlies/, 'Ontmoeting'],
  [/wijn|borrel|bier|food|proef|culinair|diner/, 'Eten & drinken'],
  [/winterwinkel|markt|fair\b|braderie/, 'Markt'],
  [/po[eë]zie|literatuur|boeken|lezing|debat/, 'Lezing'],
  [/comic ?con|beurs|challenge|spektakel/, 'Feest & festival'],
  [/smartlap|guess who|no man.s land|jazz|muziekfestival|concert|\bdj\b|music/, 'Concert'],
];

function festivalKind(a: KindInput): string | undefined {
  const t = a.title?.toLowerCase() ?? '';
  // Voorstellingen en workshops in een feestreeks (Winterkost, Herfststukjes, Sint Maarten) zijn gewoon voorstellingen en workshops.
  if (/workshop|knutsel|maak je/.test(t) || (a.categories.includes('workshop') && !a.categories.includes('theater'))) return 'Workshop';
  if (a.categories.includes('theater') && /\(\d{1,2}\s*\+\)|\b\d\+\s*[–-]|voorstelling|theater/.test(t + ' ' + (a.kind ?? '').toLowerCase())) return forKids(a) ? 'Kindervoorstelling' : 'Theater';
  if (/sint|piet|halloween|kerst|lampion|maarten|licht|lumen|lumine|oud ?en ?nieuw|carnaval|koningsdag/.test(t)) return undefined;
  for (const [re, k] of FESTIVAL_KIND) if (re.test(t)) return k === 'Concert' && forKids(a) ? 'Kindervoorstelling' : k;
  if (a.categories.includes('theater')) return forKids(a) ? 'Kindervoorstelling' : 'Theater';
  return undefined;
}

/**
 * Voorlezen (wil je niet zien). Een voorstelling of tekenworkshop op het Prentenboekenfestival is géén voorlezen.
 */
export function isVoorlezen(a: Pick<Activity, 'kind' | 'categories'> & { title?: string }): boolean {
  const t = a.title?.toLowerCase() ?? '';
  if (/voorlez|voorleesuur|voorleesochtend|voorleesmiddag|voorleesfestival/.test(t)) return true;
  if (!/prentenboek/.test(t) && !a.categories.includes('voorlezen')) return false;
  const show = /theater|voorstelling/i.test(a.kind ?? '') || a.categories.includes('theater') || a.categories.includes('workshop') || /teken|speel|maak/.test(t);
  return !show;
}

function forKids(a: KindInput): boolean {
  const t = a.title?.toLowerCase() ?? '';
  if (/babyconcert|kinderconcert|familieconcert|familievoorstelling|kindervoorstelling|jeugdtheater|poppenkast|poppenspel|\(\d{1,2}\s*\+\)|\b\d\+\s*[–-]|\(\d{1,2}\s*-\s*\d{1,2} jaar\)/.test(t)) return true;
  const max = a.age?.officialMaxMonths;
  if (max !== undefined && max <= 12 * 12) return true;
  return !!a.audiences?.includes('kinderen') && !a.audiences.includes('volwassenen');
}

function fineKindLabel(a: KindInput): string {
  const base = baseKindLabel(a);
  const t = a.title?.toLowerCase() ?? '';
  if (isVoorlezen(a)) return 'Voorlezen';
  for (const r of REFINE) if (r.from.test(base) && r.test.test(t)) return r.to;
  // Een "expositie" die pas om 22:00 begint, is een clubavond (bv. Canvas in Tivoli).
  if (base === 'Expositie' && a.start && a.start.slice(11, 13) >= '22') return 'Uitgaan';
  return base;
}

function baseKindLabel(a: KindInput): string {
  const t = a.title?.toLowerCase();
  if (a.kind && a.kind !== 'Overig' && a.kind !== 'Diversen') return aliasKind(a.kind);
  for (const c of a.categories) if (CATEGORY_KIND[c] && c !== 'voorlezen') return aliasKind(CATEGORY_KIND[c]!);
  if (t) for (const [re, k] of TITLE_KIND) if (re.test(t)) return aliasKind(k);
  // Laatste redmiddel: de korte beschrijving van de bron.
  const s = a.summary?.toLowerCase() ?? '';
  if (/installatie|tentoonstelling|expositie|kunst|beeldend|visue|interactie|bespeelbaar/.test(s)) return 'Expositie';
  if (/evenement|stap .*binnen in|beleef|ontdek de wereld/.test(s)) return 'Feest & festival';
  return NO_KIND;
}

/** Standaard verborgen soorten bij Volwassenen (keuze van de gebruiker, 21-10-2026). */
export const DEFAULT_HIDDEN_ADULT_KINDS: string[] = [];

/** Soorten die later standaard verborgen werden; bestaande profielen krijgen ze één keer mee. */
export const HIDDEN_KIND_MIGRATIONS: { version: number; volwassenen: string[]; remove?: RegExp }[] = [
  { version: 2, volwassenen: ['Cursus & ontmoeting'] },
  { version: 3, volwassenen: [] }, // labels samengevoegd (KIND_ALIASES): verborgen labels omzetten
  { version: 4, volwassenen: [], remove: /^(concert · |indie$|metal & punk$|roots & americana$|pop$|rock$|classic pop$|singer-songwriter$|nederlandstalig$)/i }, // geen muziekgenres verbergen (22-10-2026)
  { version: 5, volwassenen: [], remove: /./ }, // alles zichtbaar; zelf verbergen kan bij Interesses (22-10-2026)
];
