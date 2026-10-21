/**
 * UITagenda Utrecht — de stadsbrede cultuuragenda (uitagendautrecht.nl).
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Lijstpagina's zijn server-gerenderd en filterbaar:
 *      /agenda/?vanaf=DD-MM-YYYY&tot=DD-MM-YYYY&genres=<slug>&wijk=<slug,slug>&page=N
 *  - Evenementpagina's: /evenement/<id>/<slug>
 *  - Elke evenementpagina bevat een iCal- en Google Agenda-link met exacte
 *    tijden en locatie; die gebruiken we als primaire bron voor datum/tijd.
 *  - Geen publieke API of feed gevonden.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cleanText, combine, parseDutchDateRange, parseGoogleCalendarLink, parseTimes } from '../lib/parse.ts';
import { parseIcs } from '../lib/ics.ts';
import { dateOf } from '../../src/domain/dates.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.uitagendautrecht.nl';
const ID = 'uitagenda-utrecht';
const NAME = 'UITagenda Utrecht';

const dmy = (key: string) => `${key.slice(8, 10)}-${key.slice(5, 7)}-${key.slice(0, 4)}`;

export function extractEventLinks(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  const out = new Map<string, string>();
  $('a[href*="/evenement/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/\/evenement\/(\d+)\/([^/?#"]+)/);
    if (m && !out.has(m[1])) out.set(m[1], new URL(`/evenement/${m[1]}/${m[2]}`, BASE).toString());
  });
  return out;
}

export function parseEventPage(html: string, url: string, sourceEventId: string, ctx: Pick<AdapterContext, 'today' | 'nowIso'>): RawEvent | undefined {
  const $ = cheerio.load(html);
  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content')).replace(/\s*[|–-]\s*UITagenda.*$/i, '');
  if (!title) return undefined;
  const bodyText = cleanText($('main').text() || $('body').text());

  // 1. Google Agenda-link (meest betrouwbaar), 2. iCal-link wordt door de aanroeper opgehaald, 3. tekst
  let start: string | undefined;
  let end: string | undefined;
  let allDay = false;
  let location: string | undefined;
  $('a[href*="calendar.google."]').each((_, el) => {
    if (start) return;
    const g = parseGoogleCalendarLink($(el).attr('href') ?? '');
    if (g) {
      start = g.start;
      end = g.end;
      allDay = g.allDay;
      location = g.location;
    }
  });
  const extra: string[] = [];
  if (!start) {
    const dateLine = bodyText.match(/((?:ma|di|wo|do|vr|za|zo)\s+\d{1,2}\s+[a-z]{3,9}(?:\s+(?:t\/m|-)\s+(?:ma|di|wo|do|vr|za|zo)\s+\d{1,2}\s+[a-z]{3,9})?)/i);
    if (dateLine) {
      const range = parseDutchDateRange(dateLine[1], ctx.today);
      if (range) {
        const times = parseTimes(bodyText.slice(bodyText.indexOf(dateLine[1]), bodyText.indexOf(dateLine[1]) + 120));
        start = combine(range.start, times.start);
        end = range.end ?? (times.end ? combine(range.start, times.end) : undefined);
        allDay = !times.start;
        extra.push('Datum/tijd uit paginatekst gehaald; controleer bij de bron');
      }
    }
  }
  if (!start) return undefined;

  const venueLink = $('a[href*="/locatie/"]').first();
  const venueName = cleanText(venueLink.text()) || location?.split(',')[0];

  const entree = bodyText.match(/Entree\s*:?\s*(gratis|€\s*[\d.,]+(?:\s*[-/–]\s*€?\s*[\d.,]+)?[^.#]{0,40})/i);
  const hints = [
    ...new Set(
      [
        ...(bodyText.match(/#[a-z][\w-]*(?:\s\d{1,2}\s\d{1,2})?/gi) ?? []),
        ...(bodyText.match(/\b(Gezinnen|Kinderen|Jeugdtheater|Jeugd|Familie|Regulier \/ volwassenen)\b/g) ?? []),
      ].map((h) => h.trim()),
    ),
  ];
  // "#0 10" = leeftijd 0 t/m 10 jaar volgens de agenda
  const ageTag = bodyText.match(/#0?(\d{1,2})\s(\d{1,2})\b/);
  const statusText = /\bGeannuleerd\b/i.test(bodyText) ? 'Geannuleerd' : /\bUitverkocht\b/i.test(bodyText) ? 'Uitverkocht' : undefined;
  const ticketHref = $('a')
    .filter((_, el) => /tickets?|reserveren|bestellen/i.test($(el).text()))
    .first()
    .attr('href');
  const isRange = end !== undefined && dateOf(end) !== dateOf(start);

  return {
    sourceId: ID,
    sourceName: NAME,
    sourceEventId,
    url,
    title,
    start,
    end,
    allDay,
    ongoing: isRange && allDay,
    venueName,
    locality: /diverse locaties/i.test(venueName ?? '') ? 'Utrecht' : undefined,
    priceText: entree?.[1],
    bookingText: /reserveren (is )?(verplicht|noodzakelijk)|aanmelden verplicht/i.test(bodyText) ? 'reserveren verplicht' : undefined,
    bookingUrl: ticketHref && /^https?:/.test(ticketHref) ? ticketHref : undefined,
    hints,
    estimatedMinMonths: ageTag ? Number(ageTag[1]) * 12 : undefined,
    estimatedMaxMonths: ageTag ? Number(ageTag[2]) * 12 : undefined,
    descriptionForClassification: cleanText($('meta[name="description"]').attr('content')),
    statusText,
    checkedAt: ctx.nowIso,
    extraUncertainties: extra.length ? extra : undefined,
  };
}

export const uitagendaUtrecht: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: BASE,
  method: 'html',
  description:
    'Stadsbrede cultuuragenda. Lijstpagina’s per genre en wijk; datum en tijd uit de agendalink op elke evenementpagina.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const genres = (ctx.options.genres as string[] | undefined) ?? ['jeugdtheater', 'festivals', 'musea'];
    const wijken = (ctx.options.wijken as string[] | undefined) ?? ['leidsche-rijn,vleuten-de-meern'];
    const maxPages = (ctx.options.maxPagesPerQuery as number | undefined) ?? 10;
    const queries = [
      ...genres.map((g) => `genres=${encodeURIComponent(g)}`),
      ...wijken.map((w) => `wijk=${w}`),
    ];

    const links = new Map<string, string>();
    // Alleen als alles volledig is opgehaald, mogen ontbrekende items als "verdwenen" gelden.
    let complete = true;
    for (const q of queries) {
      for (let page = 1; page <= maxPages; page++) {
        const url = `${BASE}/agenda/?vanaf=${dmy(ctx.today)}&tot=${dmy(ctx.until)}&${q}${page > 1 ? `&page=${page}` : ''}`;
        const html = await fetchText(url);
        const found = extractEventLinks(html);
        let added = 0;
        for (const [id, href] of found) {
          if (!links.has(id)) {
            links.set(id, href);
            added++;
          }
        }
        ctx.log(`  ${q} p${page}: ${found.size} links, ${added} nieuw`);
        if (added === 0) break;
        if (page === maxPages) complete = false;
      }
    }

    const events: RawEvent[] = [];
    let n = 0;
    for (const [id, url] of links) {
      if (n++ >= ctx.maxDetailPages) {
        ctx.log(`  limiet van ${ctx.maxDetailPages} detailpagina's bereikt`);
        complete = false;
        break;
      }
      try {
        const html = await fetchText(url);
        let ev = parseEventPage(html, url, id, ctx);
        if (!ev) {
          // Laatste redmiddel: iCal-bestand van de pagina
          const $ = cheerio.load(html);
          const ics = $('a[href*=".ics"], a[href*="ical"]').first().attr('href');
          if (ics) {
            const parsed = parseIcs(await fetchText(new URL(ics, BASE).toString()))[0];
            if (parsed) {
              ev = {
                sourceId: ID, sourceName: NAME, sourceEventId: id, url,
                title: parsed.summary ?? 'Onbekende titel', start: parsed.start, end: parsed.end,
                allDay: parsed.allDay, venueName: parsed.location?.split(',')[0], checkedAt: ctx.nowIso,
              };
            }
          }
        }
        if (!ev) {
          ctx.log(`  kon ${url} niet lezen`);
          complete = false;
          continue;
        }
        const last = dateOf(ev.end ?? ev.start);
        if (last < ctx.today || dateOf(ev.start) > ctx.until) continue;
        events.push(ev);
      } catch (e) {
        ctx.log(`  fout bij ${url}: ${(e as Error).message}`);
        complete = false;
      }
    }
    if (links.size > 0 && events.length === 0) {
      throw new Error('Wel links gevonden maar geen enkele evenementpagina kunnen lezen — is de opmaak van de site veranderd?');
    }
    return {
      events,
      coverage: complete ? { from: ctx.today, to: ctx.until } : undefined,
      notes: complete ? undefined : 'Niet volledig opgehaald; verdwenen items worden deze run niet gemarkeerd',
    };
  },
};
