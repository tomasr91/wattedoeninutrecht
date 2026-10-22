/**
 * Zet ruwe brongegevens om naar het interne datamodel. Alleen wat de bron
 * zegt, wordt als feit opgenomen; afgeleide velden (leeftijdsschatting,
 * categorie, binnen/buiten) zijn als schatting herkenbaar.
 */
import { dedupeRepeated } from './lib/parse.ts';
import type { Activity, Audience, BookingStatus, Category, Confidence, EventStatus, IndoorKind } from '../src/domain/types.ts';
import { enrich, parsePrice } from '../src/domain/enrich.ts';
import { ageConflict } from '../src/domain/ageEstimate.ts';
import { classifyZone } from '../src/domain/geo.ts';
import { stableHash, normalizeText } from '../src/domain/dedupe.ts';
import { dateOf, formatShortDate, timeOf } from '../src/domain/dates.ts';
import { lookupVenue } from './venues.ts';

export interface RawEvent {
  sourceId: string;
  sourceName: string;
  sourceEventId?: string;
  url: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  ongoing?: boolean;
  openingNote?: string;
  venueName?: string;
  address?: string;
  locality?: string;
  lat?: number;
  lon?: number;
  /** Standaard 'exact' als lat/lon zijn meegegeven; 'approx' voor bv. het midden van een route. */
  geoPrecision?: 'exact' | 'approx';
  priceText?: string;
  bookingText?: string;
  bookingUrl?: string;
  /** Doelgroep-/genrelabels van de bron (bv. "Jeugd", "Gezinnen", "#0 10"). */
  hints?: string[];
  /** Alleen voor classificatie; wordt NIET opgeslagen of getoond (auteursrecht). */
  descriptionForClassification?: string;
  statusText?: string;
  /** Zelfgeschreven samenvatting (alleen handmatig gecureerde bronnen). */
  summary?: string;
  seriesKey?: string;
  extraUncertainties?: string[];
  confidence?: Confidence;
  checkedAt: string;
  // Expliciete overrides (handmatig gecontroleerd)
  categories?: Category[];
  audiences?: Audience[];
  indoor?: IndoorKind;
  durationMinutes?: number;
  officialMinMonths?: number;
  officialMaxMonths?: number;
  estimatedMinMonths?: number;
  estimatedMaxMonths?: number;
  /** Reden bij een schatting van de adapter, bv. "Kijkwijzer". */
  estimateReason?: string;
  ageLabel?: string;
  fitReasons?: string[];
  cautions?: string[];
  special?: boolean;
  bookingStatus?: BookingStatus;
  /** Soortlabel van de bron ("Comedy", "Toneel"). */
  kind?: string;
}

function bookingFrom(text: string | undefined): BookingStatus {
  if (!text) return 'onbekend';
  const t = text.toLowerCase();
  if (/geen reservering|niet nodig|vrije inloop|inloop|zonder reserver|vrij toegankelijk/.test(t)) return 'niet-nodig';
  if (/wel reserveren|reserveren verplicht|aanmelden verplicht|kaarten|tickets?\b|ticket kopen|bestellen|aanmelden|inschrijven/.test(t)) return 'verplicht';
  if (/reserveren aanbevolen|vol=vol|vol is vol|beperkt aantal/.test(t)) return 'aanbevolen';
  return 'onbekend';
}

function statusFrom(text: string | undefined): { status: EventStatus; availability?: string } {
  if (!text) return { status: 'gepland' };
  const t = text.toLowerCase();
  if (/geannuleerd|afgelast|gaat niet door|vervalt/.test(t)) return { status: 'geannuleerd' };
  if (/uitverkocht|vol\b|volgeboekt/.test(t)) return { status: 'uitverkocht', availability: 'Uitverkocht' };
  if (/laatste (tickets|kaarten|plaatsen)/.test(t)) return { status: 'gepland', availability: 'Laatste tickets' };
  return { status: 'gepland' };
}

/** Een korte, feitelijke samenvatting in eigen woorden, opgebouwd uit gestructureerde velden. */
export function autoSummary(a: Pick<Activity, 'categories' | 'age' | 'venue' | 'audiences' | 'start' | 'end' | 'ongoing' | 'endUnknown'>): string {
  const what: Record<string, string> = {
    theater: 'Voorstelling', voorlezen: 'Voorleesmoment', muziek: 'Muziekactiviteit', museum: 'Museumactiviteit',
    expositie: 'Tentoonstelling', workshop: 'Workshop', festival: 'Festival', markt: 'Markt', feest: 'Feestelijke activiteit',
    natuur: 'Activiteit in de natuur', spel: 'Spelactiviteit', rondleiding: 'Rondleiding', film: 'Film', lezing: 'Lezing of talk',
  };
  const kind = a.categories.map((c) => what[c]).find(Boolean) ?? 'Activiteit';
  const who = a.age.label
    ? ` voor ${a.age.label}`
    : a.audiences.includes('gezin')
      ? ' voor het hele gezin'
      : a.audiences.every((x) => x === 'volwassenen')
        ? ' voor volwassenen'
        : '';
  const where = a.venue.name ? ` in ${a.venue.name}` : '';
  const when = a.ongoing && a.end && !a.endUnknown ? `, t/m ${formatShortDate(dateOf(a.end))}` : '';
  return `${kind}${who}${where}${when}.`;
}

export function normalize(raw: RawEvent): Activity {
  const e = enrich({
    title: raw.title,
    description: raw.descriptionForClassification,
    sourceHints: raw.hints,
    startTime: timeOf(raw.start),
    knownAudiences: raw.audiences,
  });
  const known = lookupVenue(raw.venueName) ?? lookupVenue(raw.locality);
  const venue = {
    name: raw.venueName ?? known?.name ?? 'Locatie onbekend',
    address: raw.address ?? known?.address,
    locality: raw.locality ?? known?.locality,
    lat: raw.lat ?? known?.lat,
    lon: raw.lon ?? known?.lon,
    geoPrecision: (raw.lat !== undefined ? raw.geoPrecision ?? 'exact' : known?.lat !== undefined ? 'approx' : 'unknown') as 'exact' | 'approx' | 'unknown',
  };

  const price = parsePrice(raw.priceText);
  const st = statusFrom(raw.statusText);
  const bookingStatus = raw.bookingStatus ?? bookingFrom(`${raw.bookingText ?? ''} ${raw.priceText ?? ''}`);

  const uncertainties = [...(raw.extraUncertainties ?? [])];
  if (!timeOf(raw.start) && !raw.allDay && !raw.ongoing) uncertainties.push('Begintijd niet bekend');
  if (price.kind === 'onbekend') uncertainties.push('Prijs niet vermeld');
  if (venue.geoPrecision === 'unknown') uncertainties.push('Exacte locatie niet bekend; afstand onzeker');
  if (bookingStatus === 'onbekend') uncertainties.push('Onbekend of reserveren nodig is');

  const audiences = raw.audiences ?? e.audiences;
  const rawOfficial = raw.officialMinMonths !== undefined || raw.officialMaxMonths !== undefined;
  const rawEstimate = raw.estimatedMinMonths !== undefined || raw.estimatedMaxMonths !== undefined;
  const base = { ...e.age };
  if (rawOfficial || rawEstimate) {
    // Gegevens van de adapter gaan voor; een eigen schatting blijft alleen als controle.
    if (rawOfficial && base.estimatedMinMonths !== undefined) {
      const c = ageConflict({ min: raw.officialMinMonths, max: raw.officialMaxMonths }, {
        minMonths: base.estimatedMinMonths,
        maxMonths: base.estimatedMaxMonths,
        reason: base.estimateReason ?? '',
        confidence: base.estimateConfidence ?? 'laag',
      });
      if (c) base.needsReview = c;
    }
    delete base.estimatedMinMonths;
    delete base.estimatedMaxMonths;
    delete base.estimateReason;
    delete base.estimateConfidence;
    if (rawOfficial) delete base.officialFromText;
  }
  const age = {
    ...base,
    ...(raw.officialMinMonths !== undefined ? { officialMinMonths: raw.officialMinMonths } : {}),
    ...(raw.officialMaxMonths !== undefined ? { officialMaxMonths: raw.officialMaxMonths } : {}),
    ...(raw.estimatedMinMonths !== undefined ? { estimatedMinMonths: raw.estimatedMinMonths } : {}),
    ...(raw.estimatedMaxMonths !== undefined ? { estimatedMaxMonths: raw.estimatedMaxMonths } : {}),
    ...(rawEstimate && !rawOfficial ? { estimateReason: raw.estimateReason ?? 'leeftijdslabel van de bron', estimateConfidence: 'middel' as const } : {}),
    ...(raw.ageLabel ? { label: raw.ageLabel } : {}),
    ...(raw.fitReasons ? { fitReasons: raw.fitReasons } : {}),
    ...(raw.cautions ? { cautions: raw.cautions } : {}),
  };
  if (!audiences.every((a) => a === 'volwassenen') && age.officialMinMonths === undefined && age.officialMaxMonths === undefined) {
    if (age.estimatedMinMonths !== undefined || age.estimatedMaxMonths !== undefined) {
      uncertainties.push('Leeftijd is een inschatting; de bron noemt geen leeftijd');
    }
  }

  const categories = raw.categories ?? e.categories;
  const indoor = raw.indoor ?? (e.indoor !== 'onbekend' ? e.indoor : known?.indoor ?? 'onbekend');
  const idBasis = raw.sourceEventId
    ? `${raw.sourceId}|${raw.sourceEventId}`
    : `${raw.sourceId}|${normalizeText(raw.title)}|${raw.start}|${normalizeText(venue.name)}`;

  const activity: Activity = {
    id: stableHash(idBasis),
    title: dedupeRepeated(raw.title),
    start: raw.start,
    end: raw.end && raw.end !== raw.start ? raw.end : undefined,
    allDay: raw.allDay ?? !timeOf(raw.start),
    ongoing: raw.ongoing,
    endUnknown: (raw.extraUncertainties ?? []).some((u) => /einddatum\b.*\bniet\b|einddatum onbekend/i.test(u)) || undefined,
    openingNote: raw.openingNote,
    seriesKey: raw.seriesKey ?? `${raw.sourceId}|${normalizeText(raw.title)}`,
    venue,
    zone: classifyZone(venue),
    audiences,
    age,
    durationMinutes: raw.durationMinutes ?? e.durationMinutes,
    durationIsEstimate: raw.durationMinutes === undefined && e.durationMinutes !== undefined ? true : undefined,
    price,
    indoor,
    categories,
    kind: raw.kind,
    booking: {
      status: bookingStatus,
      url: raw.bookingUrl,
      availability: st.availability ? { label: st.availability, checkedAt: raw.checkedAt } : undefined,
    },
    url: raw.url,
    sources: [
      {
        sourceId: raw.sourceId,
        sourceName: raw.sourceName,
        sourceEventId: raw.sourceEventId,
        url: raw.url,
        firstSeen: raw.checkedAt,
        lastChecked: raw.checkedAt,
      },
    ],
    status: st.status,
    confidence: raw.confidence ?? (timeOf(raw.start) || raw.allDay ? 'hoog' : 'middel'),
    uncertainties: [...new Set(uncertainties)],
    lastChecked: raw.checkedAt,
    special: raw.special ?? e.special,
  };
  // Alleen een echte, zelfgeschreven samenvatting; een automatische herhaalt wat er al staat.
  if (raw.summary) activity.summary = raw.summary;
  return activity;
}
