/**
 * Stadsprofiel: alles wat deze app tot "Uit in 030" maakt.
 *
 * De rest van de code (app, domeinlogica, verzamellaag) leest stad-specifieke
 * waarden alleen hier. Een andere stad = dit bestand, city/venues.ts,
 * city/Landmark.tsx, collector/sources.config.json en de eigen adapters.
 *
 * Dit bestand bevat alleen gegevens (geen React, geen Node), zodat app,
 * verzamellaag, tests én vite.config.ts het kunnen importeren.
 */
import type { CityConfig } from '../src/domain/city-types';

export const CITY: CityConfig = {
  id: 'utrecht',

  app: {
    name: 'Uit in 030',
    tagline: 'Ontdek. Kies. Ga.',
    description: 'Persoonlijke gezinsagenda voor Leidsche Rijn, Utrecht en omgeving.',
    manifestDescription: 'Wat te doen in Utrecht en omgeving, voor kinderen en volwassenen.',
    url: 'https://tomasr91.github.io/wattedoeninutrecht/',
    repository: 'tomasr91/wattedoeninutrecht',
  },

  /** Kleuren van de kopbalk en de merkkleur; de rest van het thema staat in src/app/styles.css. */
  theme: {
    brand: '#24506e',
    brandInk: '#1f4864',
    brandSoft: '#e4edf4',
    headBg: '#1f3a4d',
    headMuted: '#c3d3df',
    headLandmark: '#cfe0ec',
    dayInk: '#1f3a4d',
  },

  /** Naam van de plaats, voor routes en adreszoekopdrachten zonder plaatsnaam. */
  cityName: 'Utrecht',
  /** Middelpunt van de stad en een ruwe straal van de gemeente. */
  center: { lat: 52.0907, lon: 5.1214 },
  cityRadiusKm: 6.5,

  /**
   * Thuiswijk: krijgt voorrang bij kinderactiviteiten en is het standaard
   * vertrekpunt voor afstanden (instelbaar in de app).
   */
  home: {
    zoneId: 'leidsche-rijn',
    name: 'Leidsche Rijn',
    label: 'Leidsche Rijn Centrum',
    lat: 52.0946,
    lon: 5.0604,
    localities: [
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
    ],
    /** Zonder plaatsnaam: binnen deze straal van het thuispunt telt een locatie als thuiswijk… */
    radiusKm: 3.5,
    /** …mits ook dit klopt: west van het Amsterdam-Rijnkanaal. */
    maxLon: 5.085,
  },

  /** De rest van de gemeente. */
  city: {
    zoneId: 'utrecht',
    localities: [
      'utrecht', 'binnenstad', 'centrum', 'oost', 'west', 'zuid', 'noordoost', 'noordwest', 'zuidwest',
      'overvecht', 'kanaleneiland', 'lombok', 'zuilen', 'hoograven', 'lunetten', 'oog in al',
      'tuinwijk', 'wittevrouwen', 'wilhelminapark', 'rivierenwijk', 'transwijk', 'dichterswijk',
      'ondiep', 'tuindorp', 'voordorp', 'merwede', 'jaarbeurs', 'rijnsweerd', 'science park',
    ],
  },

  /** Label per zone in de app. De thuiswijk heet in de lijst gewoon naar de stad. */
  zoneLabels: { 'leidsche-rijn': 'Utrecht', utrecht: 'Utrecht', omgeving: 'Omgeving' },

  /** Fietsafstand: binnen zoveel km van thuis, of in de gemeente zelf. */
  bikeMaxKm: 8,

  /** Voorbeeld in het adresveld van de instellingen. */
  addressPlaceholder: 'Straat 1, Utrecht of 3541 AA',

  /** Tekst bij "Alternatief verzameld" in de bronnenlijst. */
  curatedNote: 'Tivoli en Leidsche Rijn Centrum worden elke dinsdag opnieuw opgehaald.',

  /** Woorden die op dezelfde avond in één zaal vaak in verschillende titels staan (ontdubbelen). */
  dedupeGenericWords: ['utrecht', 'tivolivredenburg', 'stadsschouwburg'],

  /** Naam van de verzamelbot in de User-Agent en in robots.txt. */
  bot: { name: 'UtrechtFamilyAgendaBot', project: 'utrecht-family-agenda' },
};
