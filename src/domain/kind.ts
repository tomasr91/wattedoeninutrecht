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
  [/cursus|\bles\b|lessen|taalcaf|scheidingscaf|rouw|lotgenot|praatgroep|mannentafel|vrouwentafel|burn-?out|spreekuur|inloop|troost|alle talen|studium generale/, 'Cursus & ontmoeting'],
  [/diner|proeverij|proeven|wijn|\bbier|beaujolais|tap ?takeover|voorproevers|food|brunch|high tea|spijs/, 'Eten & drinken'],
  [/kitsch of kunst|wintermarkt|winter market|feestmarkt|kerstmarkt|vlooienmarkt|rommelmarkt/, 'Markt'],
  [/pechakucha|\btalk\b|lezing|debat|gesprek|mannentafel|vrouwentafel|filosof|boekpresentatie|presentatie|signeer|schrijver|auteur|interview/, 'Lezing'],
  [/open mic|open podium|poetry|spoken word|storytelling|voordracht/, 'Voorstelling'],
  [/workshop|collage|craft|knutsel|schrijfcaf|schrijf|yoga|maak je|atelier|cursus|masterclass/, 'Workshop'],
  [/wandeling|wandelroute|tour\b|route\b|rondleiding|kijken\b|by night|fietstocht|muurschildering/, 'Rondleiding'],
  [/\brun\b|loop\b|hardloop|marathon|fietsen|sport|zwem/, 'Sport'],
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
  'Classic pop': 'Classic pop',
  Nederlandstalig: 'Nederlandstalig',
  Elektronisch: 'Elektronisch',
  Jazz: 'Jazz',
  'Soul & funk': 'Soul & funk',
  Klassiek: 'Klassiek',
  'Klassieke muziek': 'Klassiek',
  Wereld: 'Wereldmuziek',
  Wereldmuziek: 'Wereldmuziek',
};

/** Label na samenvoegen (zie KIND_ALIASES en MUSIC_GENRES). */
export function canonicalKind(k: string): string {
  if (k.startsWith('Concert · ')) {
    const g = k.slice('Concert · '.length);
    return `Concert · ${MUSIC_GENRES[g] ?? g}`;
  }
  if (MUSIC_GENRES[k]) return `Concert · ${MUSIC_GENRES[k]}`;
  return KIND_ALIASES[k] ?? k;
}

/**
 * Bijstellen van een te grof bronlabel aan de hand van de titel. UITagenda zet bv. alles van musea onder
 * "Musea & exposities", ook een doolhof, een sterrenkijkavond of een rondleiding.
 */
const REFINE: { from: RegExp; test: RegExp; to: string }[] = [
  { from: /./, test: /voorlez|voorleesuur|prentenboek/, to: 'Voorlezen' },
  { from: /^(expositie|museum|lezing|festival|theater)$/i, test: /rondleiding|\btour\b|podwalk|stadswandeling|wandelroute|puzzeltocht|speurtocht/, to: 'Rondleiding' },
  { from: /^(expositie|museum)$/i, test: /familiespel|doe-expo|archeolab|weekendactiviteit|kunstlokaal|verjaardagsfeest|mysterybox|voetzoekertjes|spoordieren|kinderactiviteit|workshop/, to: 'Doe-activiteit' },
  { from: /^(expositie|museum)$/i, test: /kijkavond|sterrenkijk|zon op zondag|sonnenborgh by night/, to: 'Sterrenkijken' },
  { from: /^(expositie)$/i, test: /museum\b|museum$|^domunder$|^dom ?under/, to: 'Museum' },
  { from: /^(expositie|museum)$/i, test: /doolhof|\bmaze\b|immersive|beleving/, to: 'Belevenis' },
];

/** Wat is het? Eerst het label van de bron, dan de categorie, dan woorden in de titel. */
export function kindLabel(a: Pick<Activity, 'kind' | 'categories'> & { title?: string; start?: string }): string {
  const base = baseKindLabel(a);
  const t = a.title?.toLowerCase() ?? '';
  for (const r of REFINE) if (r.from.test(base) && r.test.test(t)) return r.to;
  // Een "expositie" die pas om 22:00 begint, is een clubavond (bv. Canvas in Tivoli).
  if (base === 'Expositie' && a.start && a.start.slice(11, 13) >= '22') return 'Uitgaan';
  return base;
}

function baseKindLabel(a: Pick<Activity, 'kind' | 'categories'> & { title?: string }): string {
  if (a.kind) return canonicalKind(a.kind);
  for (const c of a.categories) if (CATEGORY_KIND[c]) return canonicalKind(CATEGORY_KIND[c]!);
  const t = a.title?.toLowerCase();
  if (t) for (const [re, k] of TITLE_KIND) if (re.test(t)) return canonicalKind(k);
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
