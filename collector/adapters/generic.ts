/**
 * Generieke adapters die je zonder code kunt inzetten via sources.config.json:
 *
 *  - type "ical":   één of meer .ics-feeds (bv. een WordPress "The Events Calendar"-site: /?ical=1)
 *  - type "jsonld": pagina's met schema.org Event JSON-LD (lijst- of detailpagina's)
 *
 * Voorbeeld in sources.config.json:
 *   { "id": "kinderboerderij-x", "type": "ical", "name": "Kinderboerderij X",
 *     "enabled": true, "options": { "urls": ["https://…/?ical=1"], "venueName": "…", "locality": "Vleuten" } }
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { parseIcs } from '../lib/ics.ts';
import { cleanText, extractJsonLdEvents, isoToLocal } from '../lib/parse.ts';
import { dateOf } from '../../src/domain/dates.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

interface GenericConfig {
  id: string;
  name: string;
  homepage?: string;
  options?: Record<string, unknown>;
}

const inWindow = (e: RawEvent, ctx: AdapterContext) =>
  dateOf(e.end ?? e.start) >= ctx.today && dateOf(e.start) <= ctx.until;

export function icalAdapter(cfg: GenericConfig): SourceAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    homepage: cfg.homepage ?? '',
    method: 'ical',
    description: `iCal-feed van ${cfg.name}`,
    async run(ctx: AdapterContext): Promise<AdapterResult> {
      const urls = (ctx.options.urls as string[]) ?? [];
      const events: RawEvent[] = [];
      for (const url of urls) {
        for (const ev of parseIcs(await fetchText(url))) {
          events.push({
            sourceId: cfg.id,
            sourceName: cfg.name,
            sourceEventId: ev.uid ?? `${ev.summary}|${ev.start}`,
            url: ev.url ?? cfg.homepage ?? url,
            title: ev.summary ?? 'Zonder titel',
            start: ev.start,
            end: ev.end,
            allDay: ev.allDay,
            venueName: (ctx.options.venueName as string) ?? ev.location?.split(',')[0],
            address: ev.location,
            locality: ctx.options.locality as string | undefined,
            hints: [...(ev.categories ?? []), ...((ctx.options.hints as string[]) ?? [])],
            descriptionForClassification: ev.description,
            statusText: ev.status === 'CANCELLED' ? 'geannuleerd' : undefined,
            checkedAt: ctx.nowIso,
          });
        }
      }
      return { events: events.filter((e) => inWindow(e, ctx)), coverage: { from: ctx.today, to: ctx.until } };
    },
  };
}

export function jsonLdToRaw(obj: Record<string, unknown>, cfg: GenericConfig, pageUrl: string, ctx: AdapterContext): RawEvent | undefined {
  if (typeof obj.startDate !== 'string' || typeof obj.name !== 'string') return undefined;
  const loc = (Array.isArray(obj.location) ? obj.location[0] : obj.location) as Record<string, unknown> | undefined;
  const addr = loc?.address as Record<string, unknown> | string | undefined;
  const geo = loc?.geo as Record<string, unknown> | undefined;
  const offers = (Array.isArray(obj.offers) ? obj.offers[0] : obj.offers) as Record<string, unknown> | undefined;
  const price =
    offers?.price !== undefined
      ? Number(offers.price) === 0
        ? 'Gratis'
        : `€ ${String(offers.price).replace('.', ',')}`
      : undefined;
  const url = typeof obj.url === 'string' ? new URL(obj.url, pageUrl).toString() : pageUrl;
  return {
    sourceId: cfg.id,
    sourceName: cfg.name,
    sourceEventId: `${url}#${obj.startDate}`,
    url,
    title: cleanText(obj.name),
    start: isoToLocal(obj.startDate),
    end: typeof obj.endDate === 'string' ? isoToLocal(obj.endDate) : undefined,
    venueName: typeof loc?.name === 'string' ? loc.name : (ctx.options.venueName as string | undefined),
    address: typeof addr === 'string' ? addr : addr ? cleanText([addr.streetAddress, addr.postalCode, addr.addressLocality].filter(Boolean).join(', ')) : undefined,
    locality: (typeof addr === 'object' && typeof addr?.addressLocality === 'string' ? addr.addressLocality : undefined) ?? (ctx.options.locality as string | undefined),
    lat: geo?.latitude !== undefined ? Number(geo.latitude) : undefined,
    lon: geo?.longitude !== undefined ? Number(geo.longitude) : undefined,
    priceText: price,
    bookingUrl: typeof offers?.url === 'string' ? offers.url : undefined,
    hints: [typeof obj.typicalAgeRange === 'string' ? obj.typicalAgeRange : '', ...((ctx.options.hints as string[]) ?? [])].filter(Boolean),
    descriptionForClassification: typeof obj.description === 'string' ? obj.description : undefined,
    statusText: /Cancelled/i.test(String(obj.eventStatus ?? '')) ? 'geannuleerd' : undefined,
    checkedAt: ctx.nowIso,
  };
}

export function jsonLdAdapter(cfg: GenericConfig): SourceAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    homepage: cfg.homepage ?? '',
    method: 'jsonld',
    description: `schema.org-evenementen van ${cfg.name}`,
    async run(ctx: AdapterContext): Promise<AdapterResult> {
      const listUrls = (ctx.options.listUrls as string[]) ?? [];
      const linkPattern = ctx.options.detailLinkPattern ? new RegExp(String(ctx.options.detailLinkPattern)) : undefined;
      const events: RawEvent[] = [];
      const detail = new Set<string>();
      for (const url of listUrls) {
        const html = await fetchText(url);
        for (const obj of extractJsonLdEvents(html)) {
          const ev = jsonLdToRaw(obj, cfg, url, ctx);
          if (ev) events.push(ev);
        }
        if (linkPattern) {
          const $ = cheerio.load(html);
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href') ?? '';
            if (linkPattern.test(href)) detail.add(new URL(href, url).toString());
          });
        }
      }
      let n = 0;
      for (const url of detail) {
        if (n++ >= ctx.maxDetailPages) break;
        try {
          for (const obj of extractJsonLdEvents(await fetchText(url))) {
            const ev = jsonLdToRaw(obj, cfg, url, ctx);
            if (ev) events.push(ev);
          }
        } catch (e) {
          ctx.log(`  fout bij ${url}: ${(e as Error).message}`);
        }
      }
      const seen = new Set<string>();
      const unique = events.filter((e) => (seen.has(e.sourceEventId!) ? false : (seen.add(e.sourceEventId!), true)));
      return { events: unique.filter((e) => inWindow(e, ctx)) };
    },
  };
}
