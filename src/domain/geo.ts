import type { Home, Venue, Zone } from './types';

/** Standaard thuisbasis: Leidsche Rijn Centrum (Berlijnplein). Instelbaar in het profiel. */
export const DEFAULT_HOME: Home = { label: 'Leidsche Rijn Centrum', lat: 52.0946, lon: 5.0604 };

/** Wijken en kernen die samen "Leidsche Rijn en directe omgeving" vormen. */
export const LEIDSCHE_RIJN_LOCALITIES = [
  'leidsche rijn',
  'leidsche rijn centrum',
  'vleuterweide',
  'vleuten',
  'de meern',
  'terwijde',
  'parkwijk',
  'langerak',
  'het lageland',
  'veldhuizen',
  'haarzuilens',
  'hoge woerd',
  'máximapark',
  'maximapark',
  'leeuwesteyn',
  'rijnvliet',
  'the wonderwoods',
];

/** Plaatsen binnen de gemeente Utrecht (buiten Leidsche Rijn). */
const UTRECHT_LOCALITIES = [
  'utrecht', 'binnenstad', 'centrum', 'oost', 'west', 'zuid', 'noordoost', 'noordwest', 'zuidwest',
  'overvecht', 'kanaleneiland', 'lombok', 'zuilen', 'hoograven', 'lunetten', 'oog in al',
  'tuinwijk', 'wittevrouwen', 'wilhelminapark', 'rivierenwijk', 'transwijk', 'dichterswijk',
  'ondiep', 'tuindorp', 'voordorp', 'merwede', 'jaarbeurs', 'rijnsweerd', 'science park',
];

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function distanceFromHome(venue: Venue, home?: Home): number | undefined {
  if (!home || venue.lat === undefined || venue.lon === undefined) return undefined;
  return haversineKm(home.lat, home.lon, venue.lat, venue.lon);
}

/**
 * Indicatieve reistijd. Hemelsbreed × omrijfactor; fiets 15 km/u, auto 35 km/u
 * gemiddeld in en rond de stad. Bewust grof — getoond als "ca.".
 */
export function travelEstimate(km: number): { mode: 'fiets' | 'auto'; minutes: number } {
  const road = km * 1.3;
  if (km <= 7) return { mode: 'fiets', minutes: Math.max(5, Math.round((road / 15) * 60 / 5) * 5) };
  return { mode: 'auto', minutes: Math.max(10, Math.round(((road / 35) * 60 + 5) / 5) * 5) };
}

export function classifyZone(venue: Venue, home: Home = DEFAULT_HOME): Zone {
  const loc = `${venue.locality ?? ''} ${venue.address ?? ''} ${venue.name}`.toLowerCase();
  if (LEIDSCHE_RIJN_LOCALITIES.some((l) => loc.includes(l))) return 'leidsche-rijn';
  if (UTRECHT_LOCALITIES.some((l) => new RegExp(`\\b${l}\\b`).test(loc))) return 'utrecht';
  // Een expliciet genoemde plaats buiten de gemeente (Bunnik, Houten, Amersfoort…) is "omgeving".
  if (venue.locality && venue.locality.trim()) return 'omgeving';
  const km = distanceFromHome(venue, home);
  if (km !== undefined) {
    // West van het Amsterdam-Rijnkanaal en dichtbij: Leidsche Rijn
    if (km < 3.5 && venue.lon !== undefined && venue.lon < 5.085) return 'leidsche-rijn';
    // Ruwe begrenzing van de gemeente Utrecht
    const kmFromCenter = haversineKm(52.0907, 5.1214, venue.lat!, venue.lon!);
    if (kmFromCenter < 6.5) return 'utrecht';
  }
  return 'omgeving';
}

export const ZONE_LABEL: Record<Zone, string> = {
  'leidsche-rijn': 'Utrecht',
  utrecht: 'Utrecht',
  omgeving: 'Omgeving',
};
