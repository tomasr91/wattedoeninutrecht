/**
 * Bekende locaties met benaderde coördinaten (precisie ca. 0,3–0,5 km) en
 * wijk/plaats. Bedoeld voor afstandsindicaties; de app toont afstanden
 * daarom altijd als "ca.". Met GEOCODER=nominatim worden adressen tijdens de
 * update preciezer opgezocht (zie geocode.ts).
 *
 * Voeg locaties toe als ze vaak voorkomen; laat coördinaten weg als je ze
 * niet zeker weet — dan valt de app terug op de wijk/plaats.
 */
import { CITY_VENUES } from '../city/venues.ts';

export interface KnownVenue {
  name: string;
  aliases: RegExp;
  locality: string;
  address?: string;
  lat?: number;
  lon?: number;
  indoor?: 'binnen' | 'buiten' | 'beide';
}

/** De lijst zelf hoort bij de stad: city/venues.ts. */
export const VENUES: KnownVenue[] = CITY_VENUES;

export function lookupVenue(name: string | undefined): KnownVenue | undefined {
  if (!name) return undefined;
  const n = name.trim();
  return VENUES.find((v) => v.aliases.test(n) || v.name.toLowerCase() === n.toLowerCase());
}
