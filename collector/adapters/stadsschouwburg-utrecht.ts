/**
 * Stadsschouwburg Utrecht — toneel, dans, cabaret, muziektheater en jeugdvoorstellingen.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Lijst: /agenda?page=N (ca. 30 kaarten per pagina, chronologisch, ca. 19 pagina's per seizoen).
 *  - Elke kaart is één voorstelling: "wo 21 okt 2026", aanvangstijd ("15:00") of
 *    "meerdere speeltijden", titel (met leeftijd, bv. "Dag Poes 4+"), gezelschap en genrelabels.
 *    Status "uitverkocht" of "geannuleerd" staat op de kaart.
 *  - Productiepagina: /agenda/seizoen-<jaar>/<slug>; meerdere voorstellingen delen die URL.
 *  - Geen iCal, RSS of API gevonden; kaartverkoop via Ticketmatic. robots.txt staat /agenda toe.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cardTextAround, cleanText, parseDutchDate, priceTextFrom, spacedText } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://stadsschouwburg-utrecht.nl';
const ID = 'stadsschouwburg-utrecht';
const NAME = 'Stadsschouwburg Utrecht';
export const SSU_LINK = /\/agenda\/seizoen-[\d-]+\/([a-z0-9-]+)\/?$/;
const CARD_DATE = /\b(?:ma|di|wo|do|vr|za|zo)\s+\d{1,2}\s+(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)\s+\d{4}\b/i;
const GENRES = ['Toneel', 'Dans', 'Cabaret', 'Muziektheater', 'Muziek', 'Opera', 'Musical', 'Show', 'Theatercollege', 'Spoken word', 'Verdieping', 'Foodprogramma', 'Jeugd', 'Familie'];

export interface SsuCard {
  slug: string;
  url: string;
  date: string;
  time?: string;
  multipleTimes: boolean;
  title: string;
  company?: string;
  genres: string[];
  soldOut: boolean;
  cancelled: boolean;
  freeEntry: boolean;
}

/** Kaarten uit een agendapagina. Elke kaart = één voorstelling. */
export function parseSsuList(html: string, today: string): SsuCard[] {
  const $ = cheerio.load(html);
  const cards: SsuCard[] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').replace(/[?#].*$/, '');
    const m = href.match(SSU_LINK);
    if (!m) return;
    const text = cardTextAround($, el, SSU_LINK, CARD_DATE);
    const dm = text.match(CARD_DATE);
    if (!dm) return;
    const date = parseDutchDate(dm[0], today);
    if (!date) return;
    const after = text.slice(text.indexOf(dm[0]) + dm[0].length);
    const tm = after.match(/^\s*(?:[|·-]\s*)?(\d{1,2})[:.](\d{2})/);
    const time = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : undefined;
    const key = `${m[1]}|${date}|${time ?? 'x'}`;
    if (seen.has(key)) return;
    seen.add(key);
    const heading = $(el).find('h2, h3, h4').first();
    const container = $(el).closest('article, li, div');
    const title = cleanText(heading.text()) || cleanText(container.find('h2, h3, h4').first().text()) || cleanText($(el).text());
    const company = cleanText(container.find('h3 + p, h4, .company, .subtitle, [class*="company"], [class*="subtitle"]').first().text()) || undefined;
    cards.push({
      slug: m[1],
      url: new URL(href, BASE).toString().replace(/\/$/, ''),
      date,
      time,
      multipleTimes: /meerdere speeltijden/i.test(text),
      title: title.replace(/\s*\(geannuleerd\)\s*$/i, ''),
      company: company && company !== title ? company : undefined,
      genres: GENRES.filter((g) => new RegExp(`\\b${g}\\b`, 'i').test(text)),
      soldOut: /\buitverkocht\b/i.test(text),
      cancelled: /\bgeannuleerd\b|\bafgelast\b/i.test(text),
      freeEntry: /vrije inloop|\bgratis\b/i.test(text),
    });
  });
  return cards;
}

const SSU_KIND_PRIORITY = ['Cabaret', 'Musical', 'Opera', 'Dans', 'Muziektheater', 'Toneel', 'Theatercollege', 'Muziek', 'Show'];

/** Kort soortlabel; jeugdvoorstellingen (titel met "4+") krijgen "Jeugdtheater". */
export function ssuKind(c: Pick<SsuCard, 'genres' | 'title'>): string | undefined {
  if (/\b\d{1,2}\s*\+/.test(c.title) && !/\b1[2-8]\s*\+/.test(c.title)) return 'Jeugdtheater';
  const k = SSU_KIND_PRIORITY.find((g) => c.genres.includes(g));
  if (k) return k === 'Muziek' ? 'Concert' : k;
  return c.genres.includes('Verdieping') ? 'Gesprek & workshop' : undefined;
}

/** Uitsluiten als álle genres van een kaart in de uitsluitlijst staan (bv. alleen "Verdieping"). */
export function ssuExcluded(c: Pick<SsuCard, 'genres'>, exclude: string[]): boolean {
  return c.genres.length > 0 && c.genres.every((g) => exclude.includes(g));
}

export function ssuCardToRaw(c: SsuCard, nowIso: string, priceText?: string): RawEvent {
  const showCompany = c.company && c.company !== NAME && !c.title.toLowerCase().includes(c.company.toLowerCase());
  return {
    sourceId: ID,
    sourceName: NAME,
    sourceEventId: `${c.slug}|${c.date}|${c.time ?? ''}`,
    url: c.url,
    title: showCompany ? `${c.title} – ${c.company}` : c.title,
    start: c.time ? `${c.date}T${c.time}` : c.date,
    venueName: NAME,
    address: 'Lucasbolwerk 24, 3512 EH Utrecht',
    locality: 'Binnenstad',
    priceText: c.freeEntry ? 'Gratis' : priceText,
    bookingText: c.freeEntry ? 'vrije inloop' : 'kaarten',
    // "Jeugd"/"Familie" komen soms uit de filtertekst rond een kaart; alleen geloven bij een kinderleeftijd in de titel ("4+").
    hints: /\b\d{1,2}(?:,\d)?\s*\+/.test(c.title) && !/\b1[2-8]\s*\+/.test(c.title) ? c.genres : c.genres.filter((g) => g !== 'Jeugd' && g !== 'Familie'),
    kind: ssuKind(c),
    statusText: c.cancelled ? 'geannuleerd' : c.soldOut ? 'uitverkocht' : undefined,
    extraUncertainties: c.multipleTimes ? ['Meerdere speeltijden; kies je tijd op de bronpagina'] : undefined,
    checkedAt: nowIso,
  };
}

/** Prijs en zaal van een productiepagina ("€ 15,00 / t/m 18 jaar € 12,00"). */
export function parseSsuDetail(html: string): { priceText?: string; room?: string } {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer').remove();
  const text = spacedText($, $('main').length ? $('main') : $('body'));
  const zone = text.match(/€\s*\d[^]{0,120}/)?.[0] ?? '';
  return {
    priceText: priceTextFrom(zone),
    room: text.match(/\b(Grote Zaal|Blauwe Zaal|Douwe Egberts Zaal|Theaterzaal|Foyer)\b/i)?.[1],
  };
}

export const stadsschouwburgUtrecht: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/agenda`,
  method: 'html',
  description: 'Agenda van de Stadsschouwburg; elke kaart is één voorstelling met datum en aanvangstijd.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const maxPages = (ctx.options.maxPages as number | undefined) ?? 25;
    const cards: SsuCard[] = [];
    let complete = false;
    for (let page = 1; page <= maxPages; page++) {
      const list = parseSsuList(await fetchText(page === 1 ? `${BASE}/agenda` : `${BASE}/agenda?page=${page}`), ctx.today);
      if (!list.length) {
        complete = true;
        break;
      }
      cards.push(...list);
      if (list.every((c) => c.date > ctx.until)) {
        complete = true;
        break;
      }
    }
    const exclude = (ctx.options.excludeGenres as string[] | undefined) ?? [];
    const inWindow = cards.filter((c) => c.date >= ctx.today && c.date <= ctx.until && !ssuExcluded(c, exclude));
    // Prijs per productie (niet per voorstelling): één detailpagina per slug.
    const prices = new Map<string, string | undefined>();
    for (const slug of [...new Set(inWindow.map((c) => c.slug))].slice(0, ctx.maxDetailPages)) {
      const url = inWindow.find((c) => c.slug === slug)!.url;
      try {
        prices.set(slug, parseSsuDetail(await fetchText(url)).priceText);
      } catch (e) {
        ctx.log(`  detail mislukt (${url}): ${(e as Error).message}`);
      }
    }
    return {
      events: inWindow.map((c) => ssuCardToRaw(c, ctx.nowIso, prices.get(c.slug))),
      coverage: complete ? { from: ctx.today, to: ctx.until } : undefined,
      notes: `${inWindow.length} voorstellingen, ${prices.size} productiepagina's`,
    };
  },
};
