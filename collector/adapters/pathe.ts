/**
 * Pathé — kinderfilms en Kleuterbios in Pathé Utrecht Leidsche Rijn (optioneel ook Rembrandt Utrecht).
 *
 * Werkwijze (vastgesteld 21-10-2026, vanaf een GitHub-server):
 *  - De bioscooppagina /nl/bioscopen/<slug> bevat in <script id="ng-state"> de data die de site
 *    zelf ook gebruikt: /api/cinema/<slug>/shows (per film de speeldagen met labels zoals
 *    "Kleuterbios"), /api/shows en /api/show/<film> (titel, genres, keuring, duur) en /api/cinemas (adres).
 *  - De losse API (pathe.nl/api/...) weigert servers, en robots.txt verbiedt URL's met "language=";
 *    daarom alleen de gewone bioscooppagina, één keer per bioscoop.
 *  - Aanvangstijden staan niet in die data (alleen speeldagen). In de app: "Tijd: zie bron".
 *  - Gewone kinderfilms worden één regel per film (draait van … t/m …, onder Doorlopend);
 *    Kleuterbios-voorstellingen (speciale korte voorstellingen voor de kleinsten) per dag in de agenda.
 */
import { fetchText } from '../lib/http.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.pathe.nl';
const ID = 'pathe';
const NAME = 'Pathé';
export const DEFAULT_CINEMAS = ['pathe-utrecht-leidsche-rijn'];
/** Keuringen die we ophalen; de app bepaalt per kind (op de dag zelf) of een film past. */
export const DEFAULT_RATINGS = ['al', '-6ans', '-9ans', '-12ans'];
/**
 * Geschatte minimumleeftijd per Kijkwijzer-keuring (samen met een volwassene).
 * 6 → vanaf 4 jaar, 9 → vanaf 6, 12 → vanaf 9. "Alle leeftijden" krijgt geen grens.
 * Zo groeit het aanbod vanzelf mee met de leeftijd van de kinderen.
 */
export const MIN_YEARS_BY_RATING: Record<string, number> = { '-6ans': 4, '-9ans': 6, '-12ans': 9, '-14ans': 11, '-16ans': 13 };
export function estimatedMinFromRating(ref?: string): number | undefined {
  const y = ref ? MIN_YEARS_BY_RATING[ref] : undefined;
  return y !== undefined ? y * 12 : undefined;
}

interface DayInfo {
  tags?: string[];
  flag?: string | null;
  versions?: string[];
}
interface CinemaShow {
  days: Record<string, DayInfo>;
  isKids?: boolean;
}
interface ShowMeta {
  slug: string;
  title: string;
  genresSlug?: string[];
  duration?: number;
  contentRating?: { ref?: string; description?: string } | [];
}
interface Theater {
  name: string;
  addressLine1?: string;
  addressZip?: string;
  addressCity?: string;
  gpsPosition?: { x: number; y: number };
}

export interface PatheData {
  cinema: string;
  shows: Record<string, CinemaShow>;
  meta: Map<string, ShowMeta>;
  theater?: Theater;
}

export function parsePathePage(html: string, cinema: string): PatheData {
  const m = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('Pathé: ng-state niet gevonden; opbouw van de pagina is veranderd');
  const state = JSON.parse(m[1]) as Record<string, { u?: string; b?: unknown }>;
  const data: PatheData = { cinema, shows: {}, meta: new Map() };
  for (const entry of Object.values(state)) {
    const u = entry?.u ?? '';
    if (u.endsWith(`/api/cinema/${cinema}/shows`)) {
      data.shows = ((entry.b as { shows?: Record<string, CinemaShow> })?.shows ?? {}) as Record<string, CinemaShow>;
    } else if (/\/api\/shows$/.test(u)) {
      for (const s of ((entry.b as { shows?: ShowMeta[] })?.shows ?? [])) data.meta.set(s.slug, { ...data.meta.get(s.slug), ...s });
    } else if (/\/api\/show\/[^/]+$/.test(u) && entry.b && typeof entry.b === 'object') {
      const s = entry.b as ShowMeta;
      data.meta.set(s.slug, { ...data.meta.get(s.slug), ...s });
    } else if (/\/api\/cinemas$/.test(u)) {
      const c = (entry.b as { slug: string; theaters?: Theater[] }[]).find((x) => x.slug === cinema);
      data.theater = c?.theaters?.[0];
    }
  }
  if (!Object.keys(data.shows).length) throw new Error('Pathé: geen voorstellingen in de paginadata gevonden');
  return data;
}

function rating(meta?: ShowMeta): { ref?: string; description?: string } {
  const r = meta?.contentRating;
  return r && !Array.isArray(r) ? r : {};
}

export function isKidsFilm(show: CinemaShow, meta?: ShowMeta): boolean {
  const genres = meta?.genresSlug ?? [];
  return !!show.isKids || genres.includes('kinderfilm') || Object.values(show.days).some((d) => d.tags?.includes('kleuter'));
}

const isKleuter = (d: DayInfo) => !!d.tags?.includes('kleuter') || /kleuterbios/i.test(d.flag ?? '');

export function patheToRaw(data: PatheData, today: string, until: string, nowIso: string, ratings = DEFAULT_RATINGS): RawEvent[] {
  const t = data.theater;
  const venue = {
    venueName: t?.name ?? 'Pathé',
    address: t?.addressLine1 ? `${t.addressLine1}, ${(t.addressZip ?? '').trim()} ${t.addressCity ?? ''}`.trim() : undefined,
    locality: data.cinema.includes('leidsche-rijn') ? 'Leidsche Rijn Centrum' : 'Binnenstad',
    lat: t?.gpsPosition?.x,
    lon: t?.gpsPosition?.y,
  };
  const out: RawEvent[] = [];
  for (const [slug, show] of Object.entries(data.shows)) {
    const meta = data.meta.get(slug);
    if (!meta?.title || !isKidsFilm(show, meta)) continue;
    const r = rating(meta);
    if (!ratings.includes(r.ref ?? '')) continue;
    const days = Object.keys(show.days).filter((d) => d >= today && d <= until).sort();
    if (!days.length) continue;
    const base = {
      sourceId: ID,
      sourceName: NAME,
      url: `${BASE}/nl/films/${slug}`,
      ...venue,
      audiences: ['kinderen', 'gezin'] as RawEvent['audiences'],
      categories: ['film'] as RawEvent['categories'],
      indoor: 'binnen' as const,
      bookingText: 'tickets',
      durationMinutes: meta.duration || undefined,
      ageLabel: r.ref === 'al' ? 'Alle leeftijden' : r.ref ? `Kijkwijzer ${r.ref.replace(/\D/g, '')} (jonger met begeleiding)` : undefined,
      estimatedMinMonths: estimatedMinFromRating(r.ref),
      estimateReason: 'Kijkwijzer',
      checkedAt: nowIso,
    };
    const dutch = (d: string) => (show.days[d].versions ?? []).includes('nlnl');
    const kleuterDays = days.filter((d) => isKleuter(show.days[d]));
    for (const d of kleuterDays) {
      out.push({
        ...base,
        sourceEventId: `${data.cinema}|${slug}|${d}`,
        title: `Kleuterbios: ${meta.title}`,
        start: d,
        allDay: false,
        kind: 'Kleuterbios',
        hints: ['Kleuterbios'],
        extraUncertainties: ['Aanvangstijd staat op pathe.nl'],
        confidence: 'middel',
      });
    }
    const regular = days.filter((d) => !isKleuter(show.days[d]));
    if (!regular.length) continue;
    const first = regular[0];
    const last = regular[regular.length - 1];
    out.push({
      ...base,
      sourceEventId: `${data.cinema}|${slug}`,
      title: meta.title,
      start: first,
      end: last > first ? last : undefined,
      allDay: last === first ? false : true,
      ongoing: last > first,
      kind: 'Kinderfilm',
      openingNote: `Draait op ${regular.length} ${regular.length === 1 ? 'dag' : 'dagen'} in deze periode${regular.some(dutch) ? ', Nederlands gesproken' : ''}. Tijden op pathe.nl.`,
      extraUncertainties: ['Aanvangstijden staan op pathe.nl; het programma wordt per week bekendgemaakt'],
      confidence: 'middel',
    });
  }
  return out;
}

export const pathe: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/nl/bioscopen/pathe-utrecht-leidsche-rijn`,
  method: 'html',
  description: 'Kinderfilms (keuring t/m 12, gefilterd op de leeftijd van de kinderen) en Kleuterbios in Pathé Utrecht Leidsche Rijn.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const cinemas = (ctx.options.cinemas as string[] | undefined) ?? DEFAULT_CINEMAS;
    const ratings = (ctx.options.ratings as string[] | undefined) ?? DEFAULT_RATINGS;
    const events: RawEvent[] = [];
    for (const c of cinemas) {
      const data = parsePathePage(await fetchText(`${BASE}/nl/bioscopen/${c}`), c);
      events.push(...patheToRaw(data, ctx.today, ctx.until, ctx.nowIso, ratings));
    }
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${events.length} kinderfilms en Kleuterbios-dagen` };
  },
};
