/**
 * TivoliVredenburg — concerten, clubavonden, lezingen en familievoorstellingen.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Lijst: /agenda/ en /agenda/page/N/ (ca. 20 per pagina, chronologisch).
 *  - Familieaanbod: /agenda/?sf_genre=familie (zelfde paginering, /agenda/page/N/?sf_genre=familie).
 *  - Evenementpagina: /agenda/<id>/<slug>-<dd>-<mm>-<yyyy>. De datum staat dus in de URL;
 *    die gebruiken we als betrouwbare basis.
 *  - Detailpagina's tonen (niet altijd) "Aanvang 10.00 uur", "Verwachte eindtijd", zaal en prijzen.
 *    Soms twee voorstellingen op één dag ("Concert 1", "Concert 2").
 *  - Geen iCal, RSS of API gevonden. robots.txt staat /agenda toe.
 *  - Genres: /agenda/?sf_genre=<slug>. Met de optie `genres` haalt de adapter alleen die
 *    genres op (plus altijd "familie"); zonder die optie de complete agenda.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cardTextAround, cleanText, priceTextFrom, spacedText } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.tivolivredenburg.nl';
const ID = 'tivolivredenburg';
const NAME = 'TivoliVredenburg';
export const TIVOLI_LINK = /\/agenda\/(\d+)\/([a-z0-9-]+?)-(\d{2})-(\d{2})-(\d{4})\/?$/;

/** Tivoli-genres → kort label in de app. Club-genres samengevoegd tot "Club". */
export const TIVOLI_GENRE_LABEL: Record<string, string> = {
  comedy: 'Comedy', familie: 'Familievoorstelling', pop: 'Pop', rock: 'Rock', indie: 'Indie',
  'singer-songwriter': 'Singer-songwriter', 'roots-blues-americana': 'Roots & americana', 'metal-punk-heavy': 'Metal & punk',
  'classic-pop-60s-90s': 'Classic pop', nederlands: 'Nederlandstalig', 'classics-80s-90s-00s': 'Club', 'indie-pop-alternative': 'Club',
  'hiphop-rb-soul': 'Club', 'global-1': 'Club', 'house-techno': 'Club', 'drum-n-bass-trap': 'Club', electronic: 'Club',
  'electronic-1': 'Elektronisch', 'kennis-debat': 'Lezing', jazz: 'Jazz', 'soul-funk-jazz': 'Soul & funk', symfonisch: 'Klassiek',
};
/** Bij meerdere genres wint het meest zeggende label. */
const KIND_PRIORITY = ['Familievoorstelling', 'Comedy', 'Club', 'Singer-songwriter', 'Roots & americana', 'Indie', 'Metal & punk', 'Rock', 'Nederlandstalig', 'Classic pop', 'Elektronisch', 'Pop'];
export function pickKind(labels: string[]): string | undefined {
  return [...labels].sort((a, b) => (KIND_PRIORITY.indexOf(a) + 99) % 99 - (KIND_PRIORITY.indexOf(b) + 99) % 99)[0];
}

export interface TivoliListItem {
  id: string;
  /** Labels van de genrelijsten waarin dit evenement voorkomt. */
  kinds?: string[];
  url: string;
  date: string;
  title: string;
  cancelled: boolean;
  free: boolean;
}

function titleFromSlug(slug: string): string {
  const t = slug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Evenementen uit een lijstpagina. */
export function parseTivoliList(html: string): TivoliListItem[] {
  const $ = cheerio.load(html);
  const out = new Map<string, TivoliListItem>();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').replace(/[?#].*$/, '');
    const m = href.match(TIVOLI_LINK);
    if (!m) return;
    const url = new URL(href, BASE).toString().replace(/\/$/, '');
    const card = cardTextAround($, el, TIVOLI_LINK);
    const linkText = cleanText($(el).text());
    const heading = cleanText($(el).find('h2, h3, h4').first().text()) || cleanText($(el).closest('article, li').find('h2, h3, h4').first().text());
    const title = heading || (linkText.length > 2 && linkText.length < 120 && !/bestel|tickets|meer info/i.test(linkText) ? linkText : '');
    const prev = out.get(m[1]);
    const item: TivoliListItem = {
      id: m[1],
      url,
      date: `${m[5]}-${m[4]}-${m[3]}`,
      title: title || prev?.title || titleFromSlug(m[2]),
      cancelled: /\bafgelast\b|\bgeannuleerd\b/i.test(card) || !!prev?.cancelled,
      free: /\bgratis\b/i.test(card) || !!prev?.free,
    };
    if (!prev || (!prev.title && item.title)) out.set(m[1], item);
    else out.set(m[1], { ...prev, cancelled: item.cancelled, free: item.free });
  });
  return [...out.values()];
}

export interface TivoliDetail {
  times: { start: string; end?: string }[];
  room?: string;
  priceText?: string;
  soldOut: boolean;
  cancelled: boolean;
  ageNote?: string;
}

const pad = (n: string) => n.padStart(2, '0');

/** Tijden, zaal en prijs van een detailpagina. Alleen wat er letterlijk staat. */
export function parseTivoliDetail(html: string): TivoliDetail {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer').remove();
  const text = spacedText($, $('main').length ? $('main') : $('body'));
  const starts = [...text.matchAll(/Aanvang\s*:?\s*(\d{1,2})[.:](\d{2})/gi)].map((m) => `${pad(m[1])}:${m[2]}`);
  const ends = [...text.matchAll(/(?:Verwachte\s+)?eindtijd\s*:?\s*(\d{1,2})[.:](\d{2})/gi)].map((m) => `${pad(m[1])}:${m[2]}`);
  const times = [...new Set(starts)].map((start, i) => ({ start, end: ends[i] && ends[i] > start ? ends[i] : undefined }));
  const room = text.match(/\b(Grote zaal|Ronda|Pandora|Hertz|Cloud Nine|Club Nine|Park 6|Omloop Grote Zaal|KF Hein Foyer)\b/i)?.[1];
  const priceZone = text.match(/(?:Prijs|Tickets?|Volwassene|Kind)[^]{0,240}/i)?.[0] ?? '';
  return {
    times,
    room,
    priceText: priceTextFrom(priceZone),
    soldOut: /\buitverkocht\b/i.test(text),
    cancelled: /\bafgelast\b|\bgeannuleerd\b/i.test(text),
    ageNote: text.match(/adviesleeftijd[^.]{0,60}/i)?.[0],
  };
}

export function toRawEvents(item: TivoliListItem, detail: TivoliDetail | undefined, family: boolean, nowIso: string): RawEvent[] {
  const base: Omit<RawEvent, 'start' | 'sourceEventId'> = {
    sourceId: ID,
    sourceName: NAME,
    url: item.url,
    title: item.title,
    venueName: 'TivoliVredenburg',
    address: 'Vredenburgkade 11, 3511 WC Utrecht',
    locality: 'Binnenstad',
    priceText: item.free ? 'Gratis' : detail?.priceText,
    bookingText: item.free ? undefined : 'tickets',
    hints: family ? ['Familie'] : [],
    kind: family ? 'Familievoorstelling' : pickKind(item.kinds ?? []),
    statusText: item.cancelled || detail?.cancelled ? 'afgelast' : detail?.soldOut ? 'uitverkocht' : undefined,
    openingNote: detail?.room ? `Zaal: ${detail.room}` : undefined,
    checkedAt: nowIso,
  };
  const times = detail?.times ?? [];
  if (!times.length) return [{ ...base, sourceEventId: item.id, start: item.date, allDay: false }];
  return times.map((t, i) => ({
    ...base,
    sourceEventId: times.length > 1 ? `${item.id}#${i + 1}` : item.id,
    start: `${item.date}T${t.start}`,
    end: t.end ? `${item.date}T${t.end}` : undefined,
  }));
}

export const tivoliVredenburg: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/agenda/`,
  method: 'html',
  description: 'Agenda van TivoliVredenburg, beperkt tot de gekozen genres plus familie. Datum uit de URL, tijden en prijs van de detailpagina.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const maxPages = (ctx.options.maxPages as number | undefined) ?? 60;
    const detailDays = (ctx.options.detailDays as number | undefined) ?? 45;
    const items = new Map<string, TivoliListItem>();
    const family = new Set<string>();

    const crawl = async (query: string, onItem: (i: TivoliListItem) => void) => {
      let complete = false;
      for (let page = 1; page <= maxPages; page++) {
        const url = page === 1 ? `${BASE}/agenda/${query}` : `${BASE}/agenda/page/${page}/${query}`;
        const list = parseTivoliList(await fetchText(url));
        if (!list.length) {
          complete = true;
          break;
        }
        list.forEach(onItem);
        if (list.every((i) => i.date > ctx.until)) {
          complete = true;
          break;
        }
      }
      return complete;
    };

    const tag = (i: TivoliListItem, slug: string) => {
      const prev = items.get(i.id) ?? i;
      const label = TIVOLI_GENRE_LABEL[slug];
      items.set(i.id, { ...prev, kinds: [...new Set([...(prev.kinds ?? []), ...(label ? [label] : [])])] });
    };
    const familyComplete = await crawl('?sf_genre=familie', (i) => {
      family.add(i.id);
      tag(i, 'familie');
    });
    // Alleen gekozen genres (plus familie), of de hele agenda als er geen keuze is.
    const genres = (ctx.options.genres as string[] | undefined) ?? [];
    let allComplete = true;
    if (genres.length) {
      for (const g of genres) {
        const ok = await crawl(`?sf_genre=${encodeURIComponent(g)}`, (i) => tag(i, g));
        allComplete = allComplete && ok;
      }
    } else {
      allComplete = await crawl('', (i) => {
        if (!items.has(i.id)) items.set(i.id, i);
      });
    }

    // Detailpagina's: familie eerst, daarna de eerstvolgende weken; begrensd per run.
    const horizon = new Date(Date.parse(ctx.today) + detailDays * 86_400_000).toISOString().slice(0, 10);
    const inWindow = [...items.values()].filter((i) => i.date >= ctx.today && i.date <= ctx.until);
    const wanted = inWindow
      .filter((i) => !i.cancelled && (family.has(i.id) || i.date <= horizon))
      .sort((a, b) => Number(family.has(b.id)) - Number(family.has(a.id)) || (a.date < b.date ? -1 : 1))
      .slice(0, ctx.maxDetailPages);
    const details = new Map<string, TivoliDetail>();
    for (const i of wanted) {
      try {
        details.set(i.id, parseTivoliDetail(await fetchText(i.url)));
      } catch (e) {
        ctx.log(`  detail mislukt (${i.url}): ${(e as Error).message}`);
      }
    }

    const events = inWindow.flatMap((i) => toRawEvents(i, details.get(i.id), family.has(i.id), ctx.nowIso));
    return {
      events,
      coverage: familyComplete && allComplete ? { from: ctx.today, to: ctx.until } : undefined,
      notes: `${inWindow.length} evenementen, ${family.size} familie, ${details.size} detailpagina's`,
    };
  },
};
