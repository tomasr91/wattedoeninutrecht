/**
 * Vorm van een stadsprofiel (city/config.ts). Alleen typen: geen gegevens.
 *
 * Er zijn altijd drie zones: de thuiswijk (`home.zoneId`), de rest van de
 * gemeente (`city.zoneId`) en "omgeving". De ID's komen in de data terecht;
 * verander ze dus niet meer als een stad eenmaal draait.
 */
export interface CityConfig {
  /** Korte ID van de stad, bv. "utrecht" of "zwolle". */
  id: string;
  app: {
    /** Naam van de app (titel, kop, icoonlabel). */
    name: string;
    /** Ondertitel in de kop. */
    tagline: string;
    /** Meta-description van de pagina. */
    description: string;
    /** Beschrijving in de webmanifest (installeerbare app). */
    manifestDescription: string;
    /** Openbaar adres van de app (voor de weekendtips). */
    url: string;
    /** GitHub-repository als eigenaar/naam (voor de geplande Claude-taken). */
    repository: string;
  };
  theme: {
    brand: string;
    brandInk: string;
    brandSoft: string;
    /** Achtergrond van de kopbalk; ook theme-color van de app. */
    headBg: string;
    headMuted: string;
    /** Kleur van het herkenningspunt (Landmark) in de kop. */
    headLandmark: string;
    dayInk: string;
  };
  cityName: string;
  center: { lat: number; lon: number };
  cityRadiusKm: number;
  home: {
    zoneId: string;
    /** Naam van de thuiswijk in teksten ("Dichtbij in …"). */
    name: string;
    /** Label van het standaard vertrekpunt. */
    label: string;
    lat: number;
    lon: number;
    localities: string[];
    radiusKm: number;
    /** Optionele grenzen: een locatie zonder plaatsnaam telt alleen als thuiswijk binnen deze lengte-/breedtegraden. */
    minLon?: number;
    maxLon?: number;
    minLat?: number;
    maxLat?: number;
  };
  city: {
    zoneId: string;
    localities: string[];
  };
  zoneLabels: Record<string, string>;
  bikeMaxKm: number;
  addressPlaceholder: string;
  curatedNote: string;
  dedupeGenericWords: string[];
  bot: { name: string; project: string };
}
