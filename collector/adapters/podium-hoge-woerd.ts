/**
 * Podium Hoge Woerd (De Meern) — theater in Leidsche Rijn met veel jeugdvoorstellingen.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Programma: /agenda, voorstellingen op /agenda/<slug>
 *  - Kaartverkoop via Ticketmatic (/agenda/koop-ticket?programId=…)
 *  - Lijstkaarten tonen dag + datum zonder jaartal, aanvangstijd, genre (o.a. "Jeugd"),
 *    leeftijd in de titel en status (Geannuleerd / Uitverkocht / Laatste tickets).
 *  - Detailpagina's worden eerst op JSON-LD gecontroleerd; anders tekstextractie.
 *
 * Dezelfde voorstellingen staan ook in de UITagenda; dubbele vermeldingen worden
 * samengevoegd. Deze adapter levert de status (uitverkocht/geannuleerd) direct van het theater.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cleanText, combine, extractJsonLdEvents, isoToLocal, parseDutchDate, parseTimes } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.podiumhogewoerd.nl';
const ID = 'podium-hoge-woerd';
const NAME = 'Podium Hoge Woerd';

export function parseDetail(html: string, url: string, slug: string, ctx: Pick<AdapterContext, 'today' | 'nowIso'>): RawEvent[] {
  const $ = cheerio.load(html);
  const base = {
    sourceId: ID,
    sourceName: NAME,
    url,
    venueName: NAME,
    address: 'Hoge Woerdplein 1, 3454 PB Utrecht',
    locality: 'De Meern',
    checkedAt: ctx.nowIso,
    bookingText: 'tickets',
    bookingUrl: $('a[href*="koop-ticket"]').first().attr('href')
      ? new URL($('a[href*="koop-ticket"]').first().attr('href')!, BASE).toString()
      : undefined,
  };
  const text = cleanText($('main').text() || $('body').text());
  const hints = (text.match(/\b(Jeugd|Familie|Cabaret|Dans|Muziek|Theater|Muziektheater|Kleinkunst|Circustheater|Sinterklaasvoorstelling|Herfststukjes|Winterkost)\b/g) ?? []).filter(
    (v, i, a) => a.indexOf(v) === i,
  );
  const statusText = /\bgeannuleerd\b/i.test(text) ? 'geannuleerd' : /\buitverkocht\b/i.test(text) ? 'uitverkocht' : /laatste tickets/i.test(text) ? 'laatste tickets' : undefined;

  const ld = extractJsonLdEvents(html);
  if (ld.length) {
    return ld
      .filter((e) => typeof e.startDate === 'string')
      .map((e) => {
        const offers = (Array.isArray(e.offers) ? e.offers[0] : e.offers) as Record<string, unknown> | undefined;
        const price = offers?.price !== undefined ? `€ ${String(offers.price).replace('.', ',')}` : undefined;
        return {
          ...base,
          sourceEventId: `${slug}#${String(e.startDate)}`,
          title: cleanText(String(e.name ?? $('h1').first().text())),
          start: isoToLocal(String(e.startDate)),
          end: typeof e.endDate === 'string' ? isoToLocal(e.endDate) : undefined,
          priceText: price,
          hints,
          statusText: /Cancelled/i.test(String(e.eventStatus ?? '')) ? 'geannuleerd' : statusText,
          seriesKey: `${ID}|${slug}`,
        } satisfies RawEvent;
      });
  }

  const title = cleanText($('h1').first().text());
  const date = parseDutchDate(text.match(/(?:ma|di|wo|do|vr|za|zo)\w*\s+\d{1,2}\s+[a-z]+(?:\s+\d{4})?/i)?.[0] ?? '', ctx.today);
  if (!title || !date) return [];
  const t = parseTimes(text.match(/aanvang[^.]{0,20}|\b\d{1,2}[:.]\d{2}\b/i)?.[0] ?? '');
  const price = text.match(/€\s*[\d.,]+(?:[^.]{0,40})/)?.[0];
  return [
    {
      ...base,
      sourceEventId: `${slug}#${date}`,
      title,
      start: combine(date, t.start),
      priceText: price,
      hints,
      statusText,
      seriesKey: `${ID}|${slug}`,
    },
  ];
}

export const podiumHogeWoerd: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: BASE,
  method: 'html',
  description: 'Theater in De Meern (Leidsche Rijn) met jeugd- en familievoorstellingen; levert ook status (uitverkocht/geannuleerd).',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const $ = cheerio.load(await fetchText(`${BASE}/agenda`));
    const slugs = new Set<string>();
    $('a[href*="/agenda/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const m = href.match(/\/agenda\/([a-z0-9-]+)\/?$/);
      if (m && m[1] !== 'koop-ticket') slugs.add(m[1]);
    });
    ctx.log(`  ${slugs.size} voorstellingen gevonden`);
    const events: RawEvent[] = [];
    let n = 0;
    for (const slug of slugs) {
      if (n++ >= ctx.maxDetailPages) break;
      const url = `${BASE}/agenda/${slug}`;
      try {
        events.push(...parseDetail(await fetchText(url), url, slug, ctx));
      } catch (e) {
        ctx.log(`  fout bij ${url}: ${(e as Error).message}`);
      }
    }
    if (slugs.size > 0 && events.length === 0) throw new Error('Geen voorstellingen kunnen uitlezen — opmaak veranderd?');
    // Het theater toont maar een deel van het seizoen op /agenda; daarom geen coverage-claim.
    return { events: events.filter((e) => e.start.slice(0, 10) >= ctx.today && e.start.slice(0, 10) <= ctx.until) };
  },
};
