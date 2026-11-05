import type { Home, Venue, Zone } from './types';
import { CITY } from '../../city/config';

/** Standaard thuisbasis uit het stadsprofiel. Instelbaar in het profiel. */
export const DEFAULT_HOME: Home = { label: CITY.home.label, lat: CITY.home.lat, lon: CITY.home.lon };

/** Zone-ID's van dit stadsprofiel. */
export const HOME_ZONE: Zone = CITY.home.zoneId;
export const CITY_ZONE: Zone = CITY.city.zoneId;
export const OUTSIDE_ZONE: Zone = 'omgeving';

/** Wijken en kernen die samen de thuiswijk vormen. */
export const HOME_LOCALITIES = CITY.home.localities;

/** Plaatsen binnen de gemeente (buiten de thuiswijk). */
const CITY_LOCALITIES = CITY.city.localities;

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
  if (HOME_LOCALITIES.some((l) => loc.includes(l))) return HOME_ZONE;
  if (CITY_LOCALITIES.some((l) => new RegExp(`\\b${l}\\b`).test(loc))) return CITY_ZONE;
  // Een expliciet genoemde plaats buiten de gemeente is "omgeving".
  if (venue.locality && venue.locality.trim()) return OUTSIDE_ZONE;
  const km = distanceFromHome(venue, home);
  if (km !== undefined) {
    // Dichtbij het thuispunt (en binnen de eventuele grenzen van het stadsprofiel): thuiswijk
    if (km < CITY.home.radiusKm && withinHomeBounds(venue)) return HOME_ZONE;
    // Ruwe begrenzing van de gemeente
    const kmFromCenter = haversineKm(CITY.center.lat, CITY.center.lon, venue.lat!, venue.lon!);
    if (kmFromCenter < CITY.cityRadiusKm) return CITY_ZONE;
  }
  return OUTSIDE_ZONE;
}

function withinHomeBounds(venue: Venue): boolean {
  const { minLon, maxLon, minLat, maxLat } = CITY.home;
  if (venue.lat === undefined || venue.lon === undefined) return false;
  if (minLon !== undefined && venue.lon < minLon) return false;
  if (maxLon !== undefined && venue.lon >= maxLon) return false;
  if (minLat !== undefined && venue.lat < minLat) return false;
  if (maxLat !== undefined && venue.lat >= maxLat) return false;
  return true;
}

export const ZONE_LABEL: Record<Zone, string> = CITY.zoneLabels;
