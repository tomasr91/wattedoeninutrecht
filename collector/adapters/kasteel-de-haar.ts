/**
 * Kasteel de Haar (Haarzuilens) — seizoensactiviteiten, rondleidingen, speurtochten, lichtroute.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Agenda: /agenda. Items linken naar WordPress-berichten /YYYY/MM/DD/<slug>/; die datum is de
 *    publicatiedatum, niet de activiteitdatum.
 *  - De activiteitdatum staat in de kaarttekst ("1 november 2026 – 3 januari 2027", "7 & 14 november").
 *    Items zonder datum zijn doorlopend (speurtochten, kindertour).
 *  - Er is een RSS-feed (/feed/), maar die geeft alleen publicatiedata; daarom de agendapagina.
 *  - robots.txt staat /agenda toe.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cardTextAround, cleanText, parseDutchDate, parseDutchDateRange } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.kasteeldehaar.nl';
const ID = 'kasteel-de-haar';
const NAME = 'Kasteel de Haar';
export const HAAR_LINK = /\/\d{4}\/\d{2}\/\d{2}\/([a-z0-9_-]+)\/?$/;
const MONTH = '(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|jan|feb|mrt|apr|jun|jul|aug|sep|okt|nov|dec)';

export interface HaarItem {
  slug: string;
  url: string;
  title: string;
  start?: string;
  end?: string;
  /** Losse dagen ("7 & 14 november"). */
  days?: string[];
  ongoing: boolean;
  kids: boolean;
}

export function parseHaarList(html: string, today: string): HaarItem[] {
  const $ = cheerio.load(html);
  const out = new Map<string, HaarItem>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.replace(/[?#].*$/, '').match(HAAR_LINK);
    if (!m || out.has(m[1])) return;
    const text = cardTextAround($, el, HAAR_LINK, /(?!)/g);
    const title = cleanText($(el).find('h2, h3, h4').first().text()) || cleanText($(el).closest('article, li, div').find('h2, h3, h4').first().text()) || cleanText($(el).text());
    if (!title) return;
    const item: HaarItem = { slug: m[1], url: new URL(href, BASE).toString(), title, ongoing: false, kids: /kind|speurtocht|noet|familie|herfstvakantie|kerstvakantie|meivakantie/i.test(`${title} ${text}`) };
    // "7 & 14 november" → losse dagen
    const multi = text.match(new RegExp(`\\b(\\d{1,2})\\s*(?:&|en)\\s*(\\d{1,2})\\s+(${MONTH})\\b(?:\\s+(\\d{4}))?`, 'i'));
    const range = text.match(new RegExp(`\\b\\d{1,2}(?:\\s+${MONTH})?(?:\\s+\\d{4})?\\s*(?:t\\/m|–|-|tot)\\s*\\d{1,2}\\s+${MONTH}(?:\\s+\\d{4})?`, 'i'));
    if (multi) {
      const suffix = `${multi[3]}${multi[4] ? ` ${multi[4]}` : ''}`;
      item.days = [multi[1], multi[2]].map((d) => parseDutchDate(`${d} ${suffix}`, today)!).filter(Boolean);
    } else if (range) {
      const parts = range[0].split(/\s*(?:t\/m|–|-|tot)\s*/);
      const end = parseDutchDate(parts[1], today);
      // Begin zonder maand ("10 – 25 oktober") krijgt maand/jaar van het eind.
      const startText = /[a-z]/i.test(parts[0]) ? parts[0] : `${parts[0]} ${parts[1].replace(/^\d{1,2}\s+/, '')}`;
      const r = parseDutchDateRange(`${startText} t/m ${parts[1]}`, today);
      item.start = r?.start;
      item.end = r?.end ?? end;
    } else {
      const single = text.match(new RegExp(`\\b\\d{1,2}\\s+${MONTH}(?:\\s+\\d{4})?`, 'i'));
      if (single) item.start = parseDutchDate(single[0], today);
      else item.ongoing = true;
    }
    out.set(m[1], item);
  });
  return [...out.values()];
}

function base(i: HaarItem, nowIso: string): Omit<RawEvent, 'start' | 'sourceEventId'> {
  return {
    sourceId: ID,
    sourceName: NAME,
    url: i.url,
    title: i.title,
    venueName: 'Kasteel de Haar',
    address: 'Kasteellaan 1, 3455 RR Haarzuilens',
    locality: 'Haarzuilens',
    audiences: i.kids ? ['gezin', 'kinderen'] : ['gezin', 'volwassenen'],
    kind: /speurtocht/i.test(i.title) ? 'Speurtocht' : /rondleiding|tour/i.test(i.title) ? 'Rondleiding' : /lumineu|licht/i.test(i.title) ? 'Lichtroute' : 'Kasteel',
    extraUncertainties: ['Tijden en prijs staan op de bronpagina (entree kasteelpark of kasteel)'],
    checkedAt: nowIso,
  };
}

export function haarToRaw(i: HaarItem, today: string, until: string, nowIso: string): RawEvent[] {
  if (i.days?.length) return i.days.map((d) => ({ ...base(i, nowIso), sourceEventId: `${i.slug}|${d}`, start: d, allDay: true }));
  if (i.ongoing) {
    return [{ ...base(i, nowIso), sourceEventId: i.slug, start: today, end: until, allDay: true, ongoing: true, extraUncertainties: ['Doorlopend; einddatum niet vermeld', 'Tijden en prijs staan op de bronpagina'] }];
  }
  if (!i.start) return [];
  return [{ ...base(i, nowIso), sourceEventId: i.slug, start: i.start, end: i.end, allDay: true, ongoing: !!i.end && i.end > i.start }];
}

export const kasteelDeHaar: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/agenda`,
  method: 'html',
  description: 'Agenda van Kasteel de Haar: seizoensactiviteiten, rondleidingen, speurtochten en lichtroute.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const items = parseHaarList(await fetchText(`${BASE}/agenda`), ctx.today);
    const events = items
      .flatMap((i) => haarToRaw(i, ctx.today, ctx.until, ctx.nowIso))
      .filter((e) => (e.end ?? e.start).slice(0, 10) >= ctx.today && e.start.slice(0, 10) <= ctx.until);
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${items.length} agenda-items` };
  },
};
