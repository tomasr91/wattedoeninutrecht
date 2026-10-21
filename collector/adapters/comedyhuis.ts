/**
 * Comedyhuis Utrecht — stand-upcomedy, Nederlands- en Engelstalig.
 *
 * Werkwijze (vastgesteld 21-10-2026, vanaf een GitHub-server):
 *  - /agenda-en-tickets/ toont de hele agenda (tot enkele maanden vooruit) als lijst van
 *    .fwpl-result-blokken: titel met link naar /shows/<slug>/, line-up, korte omschrijving,
 *    taal ("Nederlands"/"Engels"), adres, datum ("vr 23 okt", zonder jaar), tijd en status.
 *  - We tonen de echte shows; open mics, talentwedstrijden, cursussen en masterclasses niet.
 *    Shows in TivoliVredenburg (komen al via Tivoli) en buiten Utrecht (Houten) worden overgeslagen.
 *  - robots.txt staat alles toe.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cleanText, parseDutchDate } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://comedyhuis.nl';
const ID = 'comedyhuis';
const NAME = 'Comedyhuis';
export const DEFAULT_EXCLUDE = ['open mic', 'talent', 'masterclass', 'cursus', 'eindshow', 'workshop'];
const SKIP_PLACES = /tivolivredenburg|aan de slinger|houten/i;

/** Bekende plekken van het Comedyhuis (coördinaten bij benadering). */
const PLACES: { re: RegExp; name: string; address: string; lat: number; lon: number }[] = [
  { re: /catharijnepoort\s*6/i, name: 'Comedyhuis', address: 'Catharijnepoort 6, Utrecht', lat: 52.0904, lon: 5.1131 },
  { re: /oudegracht\s*36\b/i, name: 'De Kargadoor', address: 'Oudegracht 36, Utrecht', lat: 52.0932, lon: 5.1187 },
  { re: /oudegracht aan de werf\s*145/i, name: 'Comedyhuis aan de Werf', address: 'Oudegracht aan de Werf 145, Utrecht', lat: 52.0876, lon: 5.1213 },
  { re: /wolvenstraat\s*10/i, name: 'Comedyhuis (Wolvenstraat)', address: 'Wolvenstraat 10, Utrecht', lat: 52.0938, lon: 5.1162 },
];

export interface ComedyItem {
  url: string;
  slug: string;
  title: string;
  lineup?: string;
  description?: string;
  language?: string;
  place?: string;
  date?: string;
  time?: string;
  status?: string;
}

export function parseComedyhuis(html: string, today: string): ComedyItem[] {
  const $ = cheerio.load(html);
  const out: ComedyItem[] = [];
  $('.fwpl-result').each((_, el) => {
    $(el).find('noscript, img').remove();
    const link = $(el).find('a[href*="/shows/"]').filter((_, a) => cleanText($(a).text()).length > 0).first();
    const href = link.attr('href');
    if (!href) return;
    const item: ComedyItem = { url: new URL(href, BASE).toString(), slug: href.replace(/\/$/, '').split('/').pop() ?? href, title: cleanText(link.text()) };
    const texts = $(el)
      .find('.fwpl-item')
      .map((_, it) => ({ cls: $(it).attr('class') ?? '', text: cleanText($(it).text()) }))
      .get();
    // De plek staat direct na de taal.
    const ti = texts.findIndex((t) => /\btaal\b/.test(t.cls));
    if (ti >= 0 && texts[ti + 1] && !/ticketlink|show-status/.test(texts[ti + 1].cls)) item.place = texts[ti + 1].text || undefined;
    for (const [idx, { cls, text }] of texts.entries()) {
      if (!text || text === item.title || idx === ti + 1) continue;
      if (/\btaal\b/.test(cls)) item.language = text;
      else if (/show-status/.test(cls)) item.status = text;
      else if (/ticketlink/.test(cls)) continue;
      else if (/^(ma|di|wo|do|vr|za|zo)\s+\d{1,2}\s+[a-z]{3,}/i.test(text)) item.date = parseDutchDate(text.replace(/^[a-z]{2}\s+/i, ''), today);
      else if (/^\d{1,2}:\d{2}$/.test(text)) item.time = text.padStart(5, '0');
      else if (!item.lineup && $(el).find(`.fwpl-item a[href*="/comedian/"]`).length && text.split(',').length > 1 && text.length < 200) item.lineup = text;
      else if (!item.description && text.length > 8) item.description = text;
    }
    out.push(item);
  });
  return out;
}

export function isRealShow(i: ComedyItem, exclude = DEFAULT_EXCLUDE): boolean {
  const t = i.title.toLowerCase();
  if (exclude.some((x) => t.includes(x))) return false;
  if (i.place && SKIP_PLACES.test(i.place)) return false;
  return !!i.date;
}

export function comedyToRaw(i: ComedyItem, nowIso: string): RawEvent {
  const place = PLACES.find((p) => p.re.test(i.place ?? ''));
  const english = /engels|english/i.test(i.language ?? '') || /\benglish\b/i.test(i.title);
  const price = i.description?.match(/€\s*\d+(?:[.,]\d{2})?/)?.[0];
  const status = i.status?.toLowerCase() ?? '';
  return {
    sourceId: ID,
    sourceName: NAME,
    sourceEventId: `${i.slug}|${i.date}${i.time ? `T${i.time}` : ''}`,
    url: i.url,
    title: english && !/english/i.test(i.title) ? `${i.title} (Engelstalig)` : i.title,
    start: i.time ? `${i.date}T${i.time}` : i.date!,
    allDay: false,
    venueName: place?.name ?? i.place ?? 'Comedyhuis',
    address: place?.address,
    locality: 'Binnenstad',
    lat: place?.lat,
    lon: place?.lon,
    geoPrecision: place ? 'approx' : undefined,
    audiences: ['volwassenen'],
    categories: ['theater'],
    kind: 'Comedy',
    indoor: 'binnen',
    priceText: price,
    bookingText: 'tickets',
    statusText: /uitverkocht/.test(status) ? 'vol' : /geannuleerd|afgelast/.test(status) ? 'geannuleerd' : undefined,
    descriptionForClassification: [i.lineup, i.description].filter(Boolean).join(' '),
    extraUncertainties: i.time ? undefined : ['Aanvangstijd staat op de bronpagina'],
    checkedAt: nowIso,
  };
}

export const comedyhuis: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/agenda-en-tickets/`,
  method: 'html',
  description: 'Stand-upcomedy van het Comedyhuis in Utrecht, Nederlands- en Engelstalig (zonder open mics en talentavonden).',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const exclude = (ctx.options.exclude as string[] | undefined) ?? DEFAULT_EXCLUDE;
    const items = parseComedyhuis(await fetchText(`${BASE}/agenda-en-tickets/`), ctx.today);
    if (!items.length) throw new Error('Comedyhuis: geen shows gevonden; opbouw van de agenda is veranderd');
    const events = items
      .filter((i) => isRealShow(i, exclude))
      .map((i) => comedyToRaw(i, ctx.nowIso))
      .filter((e) => e.start.slice(0, 10) >= ctx.today && e.start.slice(0, 10) <= ctx.until);
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${events.length} shows van ${items.length} in de agenda` };
  },
};
