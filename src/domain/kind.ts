import type { Activity, Category } from './types';

const CATEGORY_KIND: Partial<Record<Category, string>> = {
  theater: 'Voorstelling', muziek: 'Concert', museum: 'Museum', expositie: 'Expositie', workshop: 'Workshop',
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
  [/pechakucha|\btalk\b|lezing|debat|gesprek|mannentafel|vrouwentafel|filosof/, 'Lezing'],
  [/open mic|open podium|poetry|spoken word|storytelling|voordracht/, 'Voorstelling'],
  [/workshop|collage|craft|knutsel|schrijfcaf|schrijf|yoga|maak je|atelier|cursus|masterclass/, 'Workshop'],
  [/wandeling|wandelroute|tour\b|route\b|rondleiding|kijken\b|by night|fietstocht|muurschildering/, 'Rondleiding'],
  [/\brun\b|loop\b|hardloop|marathon|fietsen|sport|zwem/, 'Sport'],
  [/slaapfeest|feestje|is jarig|verjaardag|feest\b|kermis/, 'Feest'],
  [/markt|braderie|fair\b/, 'Markt'],
];

/** Wat is het? Eerst het label van de bron, dan de categorie, dan woorden in de titel. */
export function kindLabel(a: Pick<Activity, 'kind' | 'categories'> & { title?: string }): string {
  if (a.kind) return a.kind;
  for (const c of a.categories) if (CATEGORY_KIND[c]) return CATEGORY_KIND[c]!;
  const t = a.title?.toLowerCase();
  if (t) for (const [re, k] of TITLE_KIND) if (re.test(t)) return k;
  return NO_KIND;
}

/** Standaard verborgen soorten bij Volwassenen (keuze van de gebruiker, 21-10-2026). */
export const DEFAULT_HIDDEN_ADULT_KINDS = ['Indie', 'Metal & punk', 'Expositie', 'Dans', 'Roots & americana', 'Opera', 'Musical', 'Podcast', 'Cursus & ontmoeting'];

/** Soorten die later standaard verborgen werden; bestaande profielen krijgen ze één keer mee. */
export const HIDDEN_KIND_MIGRATIONS: { version: number; volwassenen: string[] }[] = [{ version: 2, volwassenen: ['Cursus & ontmoeting'] }];
