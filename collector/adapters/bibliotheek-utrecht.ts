/**
 * Bibliotheek Utrecht — activiteitenagenda op OP-shop (bibliotheekutrecht.op-shop.nl).
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Lijst: /?page=N, ca. 20 activiteiten per pagina, chronologisch.
 *  - Enkele activiteit: /<id>/<slug>/<DD-MM-YYYY>
 *  - Reeks op meerdere vestigingen: /<id>/<slug>/vanaf/<DD-MM-YYYY> (met eigen paginering);
 *    elke sessie per vestiging heeft daar weer een eigen /<id>/<slug>/<datum>-link.
 *  - Geen JSON-LD of feed; de kaarten bevatten datum, tijd, vestiging, doelgroep en prijs.
 *  - Vestigingen in Leidsche Rijn e.o.: Leidsche Rijn Centrum, Vleuterweide, Vleuten, De Meern.
 */
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { fetchText } from '../lib/http.ts';
import { cleanText, dedupeRepeated, introFrom, parseTimes } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://bibliotheekutrecht.op-shop.nl';
const ID = 'bibliotheek-utrecht';
const NAME = 'Bibliotheek Utrecht';

export const BRANCHES = [
  'Leidsche Rijn Centrum', 'Vleuterweide', 'Vleuten', 'De Meern', 'Neude', 'Kanaleneiland', 'Overvecht',
  'Zuilen', 'Oog in Al', 'Hoograven', 'Tuinwijk', 'Lunetten',
];

const LINK_RE = /\/(\d+)\/([a-z0-9-]+)\/(vanaf\/)?(\d{2})-(\d{2})-(\d{4})/;

interface Link {
  id: string;
  slug: string;
  series: boolean;
  date: string;
  url: string;
}

function toLink(href: string): Link | undefined {
  const m = href.match(LINK_RE);
  if (!m) return undefined;
  const path = m[0];
  return { id: m[1], slug: m[2], series: !!m[3], date: `${m[6]}-${m[5]}-${m[4]}`, url: new URL(path, BASE).toString() };
}

/** Vind het kleinste omringende element dat één activiteit beschrijft. */
function cardOf($: cheerio.CheerioAPI, el: AnyNode): string {
  let node = $(el);
  for (let i = 0; i < 6; i++) {
    const parent = node.parent();
    if (!parent.length) break;
    const text = cleanText(parent.text());
    const linkCount = parent.find('a').filter((_, a) => LINK_RE.test($(a).attr('href') ?? '')).length;
    if (linkCount > 1 && i > 0) break; // te ver omhoog: meerdere activiteiten
    node = parent;
    if (/\d{1,2}[:.]\d{2}/.test(text) && text.length > 30) break;
  }
  return cleanText(node.text());
}

export function branchesIn(text: string): string[] {
  const found: string[] = [];
  let rest = text;
  for (const b of BRANCHES) {
    const re = new RegExp(`(?:Bibliotheek\\s+)?${b}\\b`, 'i');
    if (re.test(rest)) {
      found.push(b);
      rest = rest.replace(new RegExp(re.source, 'gi'), ' ');
    }
  }
  return found;
}

export function parseCard(text: string, link: Link, title: string, nowIso: string): RawEvent | undefined {
  const branches = branchesIn(text);
  if (branches.length !== 1) return undefined;
  const times = parseTimes(text);
  const price = text.match(/gratis[^|]{0,40}|€\s*[\d.,]+[^|]{0,60}/i)?.[0];
  const hints = [/\bjeugd\b/i.test(text) ? 'Jeugd' : '', /\bvolwassenen\b/i.test(text) ? 'Volwassenen' : ''].filter(Boolean);
  return {
    sourceId: ID,
    sourceName: NAME,
    sourceEventId: `${link.id}/${link.date}`,
    url: link.url,
    title,
    start: times.start ? `${link.date}T${times.start}` : link.date,
    end: times.end ? `${link.date}T${times.end}` : undefined,
    venueName: `Bibliotheek ${branches[0]}`,
    priceText: price ? cleanText(price) : undefined,
    bookingText: /wel reserveren|reserveren verplicht|aanmelden/i.test(text) ? 'wel reserveren' : /inloop/i.test(text) ? 'inloop' : undefined,
    hints,
    statusText: /geannuleerd/i.test(text) ? 'geannuleerd' : /\bvol\b|volgeboekt|uitverkocht/i.test(text) ? 'vol' : undefined,
    seriesKey: `${ID}|${link.slug}`,
    checkedAt: nowIso,
  };
}

function titleFor($: cheerio.CheerioAPI, el: AnyNode, slug: string): string {
  const own = dedupeRepeated(cleanText($(el).text()));
  // Een link met alleen de vestigingsnaam is geen titel.
  const isBranch = /^bibliotheek\s/i.test(own) && branchesIn(own).length === 1 && own.split(' ').length <= 4;
  if (own && !isBranch && !/^(meer informatie|bekijk|bestel|reserveer|meer)$/i.test(own) && own.length > 3) return own;
  const heading = cleanText($(el).closest('div,li,article').find('h2,h3,h4').first().text());
  if (heading) return heading;
  return slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

async function parseListPage(html: string, ctx: AdapterContext, seen: Set<string>, out: RawEvent[], series: Map<string, Link>, detailQueue: { link: Link; title: string }[]) {
  const $ = cheerio.load(html);
  let newCount = 0;
  let maxDate = '';
  $('a[href]').each((_, el) => {
    const link = toLink($(el).attr('href') ?? '');
    if (!link) return;
    if (link.date > maxDate) maxDate = link.date;
    if (link.series) {
      if (!series.has(link.id)) series.set(link.id, link);
      return;
    }
    const key = `${link.id}/${link.date}`;
    if (seen.has(key)) return;
    seen.add(key);
    newCount++;
    const title = titleFor($, el, link.slug);
    const ev = parseCard(cardOf($, el), link, title, ctx.nowIso);
    if (ev) out.push(ev);
    else detailQueue.push({ link, title });
  });
  return { newCount, maxDate };
}

export const bibliotheekUtrecht: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: 'https://www.bibliotheekutrecht.nl',
  method: 'html',
  description:
    'Activiteiten van alle vestigingen (OP-shop). Voorlezen, workshops, theater en exposities; o.a. Leidsche Rijn Centrum, Vleuterweide, Vleuten en De Meern.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const maxPages = (ctx.options.maxPages as number | undefined) ?? 40;
    const seen = new Set<string>();
    const events: RawEvent[] = [];
    const series = new Map<string, Link>();
    const detailQueue: { link: Link; title: string }[] = [];
    let complete = false;

    for (let page = 1; page <= maxPages; page++) {
      const html = await fetchText(`${BASE}/?page=${page}`);
      const { newCount, maxDate } = await parseListPage(html, ctx, seen, events, series, detailQueue);
      ctx.log(`  lijst p${page}: ${newCount} nieuw, t/m ${maxDate || '?'}`);
      if (newCount === 0 && page > 1) {
        complete = true;
        break;
      }
      if (maxDate && maxDate > ctx.until) {
        complete = true;
        break;
      }
    }

    // Reeksen (voorlezen e.d.): per reeks de sessiepagina's doorlopen
    for (const s of series.values()) {
      for (let page = 1; page <= 10; page++) {
        const html = await fetchText(`${s.url}${page > 1 ? `?page=${page}` : ''}`);
        const { newCount, maxDate } = await parseListPage(html, ctx, seen, events, new Map(), detailQueue);
        if (newCount === 0 || (maxDate && maxDate > ctx.until)) break;
      }
    }

    // Kaart onvoldoende duidelijk → detailpagina
    let n = 0;
    for (const { link, title } of detailQueue) {
      if (link.date > ctx.until || link.date < ctx.today) continue;
      if (n++ >= ctx.maxDetailPages) {
        complete = false;
        break;
      }
      try {
        const $ = cheerio.load(await fetchText(link.url));
        const text = cleanText($('main').text() || $('body').text());
        const t = dedupeRepeated(cleanText($('h1').first().text())) || title;
        const ev = parseCard(text, link, t, ctx.nowIso);
        if (ev) events.push({ ...ev, summary: ev.summary ?? introFrom($) });
      } catch (e) {
        ctx.log(`  fout bij ${link.url}: ${(e as Error).message}`);
        complete = false;
      }
    }

    const inWindow = events.filter((e) => e.start.slice(0, 10) >= ctx.today && e.start.slice(0, 10) <= ctx.until);
    if (seen.size > 0 && inWindow.length === 0) {
      throw new Error('Wel activiteiten-links gevonden maar niets kunnen uitlezen — is de opmaak veranderd?');
    }
    return {
      events: inWindow,
      coverage: complete ? { from: ctx.today, to: ctx.until } : undefined,
    };
  },
};
