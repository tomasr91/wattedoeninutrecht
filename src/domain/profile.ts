import type { Category, Profile } from './types';
import { birthDateFromAge } from './age';
import { DEFAULT_WEIGHTS } from './scoring';
import { DEFAULT_HIDDEN_ADULT_KINDS } from './kind';

export const ALL_CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'theater', label: 'Theater', emoji: '🎭' },
  { id: 'voorlezen', label: 'Voorlezen', emoji: '📚' },
  { id: 'muziek', label: 'Muziek', emoji: '🎵' },
  { id: 'museum', label: 'Museum', emoji: '🏛️' },
  { id: 'expositie', label: 'Expositie', emoji: '🖼️' },
  { id: 'workshop', label: 'Workshop', emoji: '✂️' },
  { id: 'festival', label: 'Festival', emoji: '🎪' },
  { id: 'markt', label: 'Markt', emoji: '🧺' },
  { id: 'feest', label: 'Feest & seizoen', emoji: '🏮' },
  { id: 'natuur', label: 'Natuur & dieren', emoji: '🌳' },
  { id: 'spel', label: 'Spel & speurtocht', emoji: '🧩' },
  { id: 'rondleiding', label: 'Rondleiding', emoji: '🚶' },
  { id: 'sport', label: 'Sport', emoji: '⚽' },
  { id: 'film', label: 'Film', emoji: '🎬' },
  { id: 'lezing', label: 'Lezing', emoji: '🎤' },
  { id: 'overig', label: 'Overig', emoji: '✨' },
];

export function categoryLabel(c: Category): string {
  return ALL_CATEGORIES.find((x) => x.id === c)?.label ?? c;
}

/**
 * Startprofiel uit de opdracht: kind 1 is 2 jaar, kind 2 is 3,5 jaar.
 * Zonder exacte geboortedatum leiden we die af van de leeftijd op de eerste
 * dag van gebruik; de app vraagt om dit te verfijnen.
 */
export function defaultProfile(today: string): Profile {
  return {
    children: [
      { id: 'kind1', name: 'Kind 1', birthDate: birthDateFromAge(24, today), birthDateEstimated: true },
      { id: 'kind2', name: 'Kind 2', birthDate: birthDateFromAge(42, today), birthDateEstimated: true },
    ],
    maxDistanceKm: 30,
    leidscheRijnPreference: 1,
    interests: ['theater', 'voorlezen', 'muziek', 'museum', 'natuur', 'feest', 'festival', 'markt', 'spel', 'expositie', 'workshop'],
    includeAdults: true,
    defaultPeriod: 'komende-maand',
    weights: { ...DEFAULT_WEIGHTS },
    hiddenKinds: { kinderen: [], volwassenen: [...DEFAULT_HIDDEN_ADULT_KINDS] },
  };
}
