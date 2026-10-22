/**
 * Gedeeld datamodel voor app én verzamellaag.
 *
 * Tijden zijn altijd lokale tijd in Europe/Amsterdam, als string:
 *  - 'YYYY-MM-DD'          voor hele dagen / doorlopende activiteiten
 *  - 'YYYY-MM-DDTHH:mm'    voor activiteiten met een begintijd
 */

export type Zone = 'leidsche-rijn' | 'utrecht' | 'omgeving';

export type Audience = 'kinderen' | 'gezin' | 'volwassenen';

export type Category =
  | 'theater'
  | 'voorlezen'
  | 'muziek'
  | 'museum'
  | 'expositie'
  | 'workshop'
  | 'festival'
  | 'markt'
  | 'natuur'
  | 'sport'
  | 'film'
  | 'lezing'
  | 'rondleiding'
  | 'feest'
  | 'spel'
  | 'overig';

export type PriceKind = 'gratis' | 'betaald' | 'onbekend';
export type IndoorKind = 'binnen' | 'buiten' | 'beide' | 'onbekend';
export type BookingStatus = 'verplicht' | 'aanbevolen' | 'niet-nodig' | 'onbekend';
export type EventStatus = 'gepland' | 'geannuleerd' | 'uitverkocht' | 'verlopen';
export type Confidence = 'hoog' | 'middel' | 'laag';

/** Leeftijden in maanden, zodat 3,5 jaar exact uit te drukken is. */
export interface AgeInfo {
  /** Officiële leeftijdsgrens zoals de bron die noemt (bv. "4+" of "2-4 jaar"). */
  officialMinMonths?: number;
  officialMaxMonths?: number;
  /** Onze inschatting als de bron niets zegt (of als aanvulling). */
  estimatedMinMonths?: number;
  estimatedMaxMonths?: number;
  /** Waarom we deze leeftijd schatten, bv. "speurtocht" of "peuters en kleuters". */
  estimateReason?: string;
  /** Hoe zeker de schatting is: 'middel' (levensfase-woord) of 'laag' (soort activiteit). */
  estimateConfidence?: 'middel' | 'laag';
  /** De bronleeftijd komt uit de omschrijving, niet uit een vast veld of de titel. */
  officialFromText?: boolean;
  /** Twijfelgeval om na te kijken (bv. bron en soort activiteit spreken elkaar tegen). */
  needsReview?: string;
  /** Letterlijke leeftijdsaanduiding uit de bron, bv. "4+". */
  label?: string;
  /** Waarom deze activiteit bij jonge kinderen past (korte duur, vrij spelen, …). */
  fitReasons?: string[];
  /** Aandachtspunten (lang, prikkelrijk, laat op de dag, …). */
  cautions?: string[];
}

export interface Venue {
  name: string;
  address?: string;
  /** Wijk of plaats, zoals getoond aan de gebruiker. */
  locality?: string;
  lat?: number;
  lon?: number;
  /** Hoe nauwkeurig de coördinaten zijn. 'approx' = locatietabel, ca. 0,5 km. */
  geoPrecision: 'exact' | 'approx' | 'unknown';
}

export interface Price {
  kind: PriceKind;
  /** Bronweergave, bv. "€ 10 kind / € 13 volwassene". */
  text?: string;
  minEur?: number;
  maxEur?: number;
}

export interface Booking {
  status: BookingStatus;
  url?: string;
  /** Alleen gevuld als de beschikbaarheid echt in de bron is gecontroleerd. */
  availability?: { label: string; checkedAt: string };
}

export interface SourceRef {
  sourceId: string;
  sourceName: string;
  sourceEventId?: string;
  url: string;
  firstSeen: string;
  lastChecked: string;
}

export interface Activity {
  /** Stabiele interne ID (hash van bron + bron-ID, of van titel/datum/locatie). */
  id: string;
  title: string;
  /** Korte, zelfgeschreven samenvatting — nooit gekopieerde brontekst. */
  summary?: string;
  start: string;
  end?: string;
  allDay: boolean;
  /** Doorlopend aanbod (expositie, speurtocht) met beperkte openingstijden. */
  ongoing?: boolean;
  /** True als de bron geen einddatum noemt; `end` is dan alleen het zoekvenster. */
  endUnknown?: boolean;
  openingNote?: string;
  /** De bron noemt dit een vaste reeks: "Elke vr en za", "doorlopend", "wekelijks". */
  recurrenceNote?: string;
  /** Bij een reeks: de bekende data. */
  occurrences?: string[];
  /** De bron noemt het "doorlopend" zonder einddatum; `end` is de eerstvolgende keer en schuift elke nacht op. */
  rolling?: boolean;
  /** Sleutel waarmee herhalende sessies van dezelfde reeks herkend worden. */
  seriesKey?: string;
  venue: Venue;
  zone: Zone;
  audiences: Audience[];
  age: AgeInfo;
  durationMinutes?: number;
  durationIsEstimate?: boolean;
  price: Price;
  indoor: IndoorKind;
  categories: Category[];
  /** Kort soortlabel zoals de bron het indeelt, bv. "Comedy", "Pop", "Toneel". */
  kind?: string;
  booking: Booking;
  /** Primaire officiële link. */
  url: string;
  sources: SourceRef[];
  status: EventStatus;
  confidence: Confidence;
  /** Ontbrekende of onzekere informatie, zichtbaar in de app. */
  uncertainties: string[];
  lastChecked: string;
  /** Feestelijk/seizoensgebonden of anderszins bijzonder. */
  special?: boolean;
  /** Alleen voor geautomatiseerde tests. Wordt nooit in de app getoond. */
  isTestData?: boolean;
}

export interface Child {
  id: string;
  name: string;
  /** 'YYYY-MM-DD' */
  birthDate: string;
  /** True als de geboortedatum is afgeleid van een opgegeven leeftijd. */
  birthDateEstimated?: boolean;
}

export interface Home {
  label: string;
  lat: number;
  lon: number;
}

export interface ScoreWeights {
  age: number;
  distance: number;
  interest: number;
  practicality: number;
  quality: number;
}

export type PeriodPreset = 'deze-week' | 'komende-maand' | 'drie-maanden' | 'week' | 'bereik';

export interface Profile {
  children: Child[];
  /** Thuisadres voor afstanden; leeg = geen afstanden tonen. */
  home?: Home;
  /** Activiteiten tot deze afstand (km) krijgen een markering op de kaart; 0 = uit. Standaard 5. */
  nearbyKm?: number;
  /** Maximale afstand in km voor de standaardweergave. */
  maxDistanceKm: number;
  /** 0 = geen voorkeur, 1 = normaal, 2 = sterk. */
  leidscheRijnPreference: number;
  interests: Category[];
  includeAdults: boolean;
  defaultPeriod: PeriodPreset;
  weights: ScoreWeights;
  /** Soorten (labels) die je niet wilt zien, per lijst. */
  hiddenKinds?: { kinderen: string[]; volwassenen: string[] };
  /** Welke standaard-verborgen soorten dit profiel al heeft meegekregen (zie HIDDEN_KIND_MIGRATIONS). */
  hiddenKindsVersion?: number;
}

export interface UpdateStatus {
  /** ISO timestamp van de laatste volledig of gedeeltelijk geslaagde run. */
  lastSuccessfulRun?: string;
  lastRun?: string;
  sources: SourceRunStatus[];
  totals: { active: number; added: number; updated: number; cancelled: number; expired: number; merged: number };
}

export interface SourceRunStatus {
  sourceId: string;
  sourceName: string;
  enabled: boolean;
  ok: boolean;
  lastAttempt?: string;
  lastSuccess?: string;
  /** Sinds wanneer de bron onafgebroken mislukt. */
  failingSince?: string;
  fetched: number;
  error?: string;
  notes?: string;
}

export interface Dataset {
  generatedAt: string;
  activities: Activity[];
  status: UpdateStatus;
  /** Jaarlijkse momenten die eraan komen maar nog niet in de agenda staan. */
  expected?: import('./expected').ExpectedMoment[];
}
