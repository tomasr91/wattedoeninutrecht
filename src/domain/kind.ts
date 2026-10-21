import type { Activity, Category } from './types';

const CATEGORY_KIND: Partial<Record<Category, string>> = {
  theater: 'Voorstelling', muziek: 'Concert', museum: 'Museum', expositie: 'Expositie', workshop: 'Workshop',
  festival: 'Festival', markt: 'Markt', feest: 'Feest', natuur: 'Natuur & dieren', spel: 'Speurtocht & spel',
  rondleiding: 'Rondleiding', sport: 'Sport', film: 'Film', lezing: 'Lezing', voorlezen: 'Voorlezen',
};

/** Label voor activiteiten zonder duidelijke soort. */
export const NO_KIND = 'Overig';

/** Wat is het? Eerst het label van de bron, anders afgeleid van de categorie. */
export function kindLabel(a: Pick<Activity, 'kind' | 'categories'>): string {
  if (a.kind) return a.kind;
  for (const c of a.categories) if (CATEGORY_KIND[c]) return CATEGORY_KIND[c]!;
  return NO_KIND;
}

/** Standaard verborgen soorten bij Volwassenen (keuze van de gebruiker, 21-10-2026). */
export const DEFAULT_HIDDEN_ADULT_KINDS = ['Indie', 'Metal & punk', 'Expositie', 'Dans', 'Roots & americana', 'Opera', 'Musical', 'Podcast'];
