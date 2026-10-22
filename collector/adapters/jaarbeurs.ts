/**
 * Jaarbeurs — alleen publieksevenementen voor kinderen en gezinnen (LEGO World, Disney On Ice, Winterspektakel …).
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Agenda: /agenda, items linken naar /agenda-item/<slug>, met datum(bereik) en labels
 *    ("Publieksevenement", "Gastevenement", "Zakelijk evenement").
 *  - Er is geen kinderfilter; we houden alleen publieksevenementen over waarvan titel of kaart
 *    op kinderen/gezin wijst (trefwoorden in sources.config.json).
 *  - De robots.txt van de Jaarbeurs weerde op 21-10-2026 in elk geval sommige crawlers voor de
 *    detailpagina's. De HTTP-client respecteert robots.txt; wordt de agenda geweigerd, dan meldt
 *    de update dat en blijven eerder verzamelde gegevens staan.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cardTextAround, cleanText, parseDutchDate } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.jaarbeurs.nl';
const ID = 'jaarbeurs';
const NAME = 'Jaarbeurs';
export const JB_LINK = /\/agenda-item\/([a-z0-9-]+)\/?$/;
const MONTH = '(?:jan|feb|mrt|maart|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*';
export const DEFAULT_FAMILY_KEYWORDS = ['kind', 'kinderen', 'kids', 'familie', 'gezin', 'lego', 'disney', 'winterspektakel', 'circus', 'speelgoed', 'sinterklaas', 'kerst'];

export interface JbItem {
  slug: string;
  url: string;
  title: string;
  start?: string;
  end?: string;
  isPublic: boolean;
  text: string;
}

export function parseJbList(html: string, today: string): JbItem[] {
  const $ = cheerio.load(html);
  const out = new Map<string, JbItem>();
  $('a[href*="/agenda-item/"]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').replace(/[?#].*$/, '');
    const m = href.match(JB_LINK);
    if (!m || out.has(m[1])) return;
    const text = cardTextAround($, el, JB_LINK, /(?!)/g);
    const title = cleanText($(el).find('h2, h3, h4').first().text()) || cleanText($(el).closest('article, li, div').find('h2, h3, h4').first().text()) || cleanText($(el).text());
    // "18 – 30 dec 2026", "26 okt 2026 – 3 jan 2027", "24 okt 2026"
    const range = text.match(new RegExp(`(\\d{1,2})(?:\\s+(${MONTH}))?(?:\\s+(\\d{4}))?\\s*[–-]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(\\d{4})`, 'i'));
    let start: string | undefined;
    let end: string | undefined;
    if (range) {
      end = parseDutchDate(`${range[4]} ${range[5]} ${range[6]}`, today);
      start = parseDutchDate(`${range[1]} ${range[2] ?? range[5]} ${range[3] ?? range[6]}`, today);
      if (start && end && start > end) start = parseDutchDate(`${range[1]} ${range[2] ?? range[5]} ${Number(range[6]) - 1}`, today);
    } else {
      const single = text.match(new RegExp(`\\b\\d{1,2}\\s+${MONTH}\\s+\\d{4}`, 'i'));
      if (single) start = parseDutchDate(single[0], today);
    }
    out.set(m[1], { slug: m[1], url: new URL(href, BASE).toString(), title, start, end, isPublic: /publieksevenement/i.test(text), text });
  });
  return [...out.values()];
}

export function isFamilyEvent(i: Pick<JbItem, 'title' | 'text' | 'isPublic'>, keywords = DEFAULT_FAMILY_KEYWORDS): boolean {
  if (!i.isPublic) return false;
  const hay = `${i.title} ${i.text}`.toLowerCase();
  if (/18\+|kamasutra|erotiek/.test(hay)) return false;
  return keywords.some((k) => new RegExp(`\\b${k}`, 'i').test(hay));
}

export function jbToRaw(i: JbItem, nowIso: string): RawEvent | undefined {
  if (!i.start) return undefined;
  return {
    sourceId: ID,
    sourceName: NAME,
    sourceEventId: i.slug,
    url: i.url,
    title: i.title,
    start: i.start,
    end: i.end && i.end > i.start ? i.end : undefined,
    allDay: true,
    venueName: 'Jaarbeurs',
    address: 'Jaarbeursplein 6, 3521 AL Utrecht',
    locality: 'Jaarbeurs',
    audiences: ['gezin', 'kinderen'],
    kind: 'Beurs & evenement',
    indoor: 'binnen',
    bookingText: 'tickets',
    extraUncertainties: ['Tijden, prijs en leeftijd staan op de bronpagina'],
    checkedAt: nowIso,
  };
}

export const jaarbeurs: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/agenda`,
  method: 'html',
  description: 'Publieksevenementen in de Jaarbeurs die op kinderen of gezinnen gericht zijn.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const keywords = (ctx.options.familyKeywords as string[] | undefined) ?? DEFAULT_FAMILY_KEYWORDS;
    const items = parseJbList(await fetchText(`${BASE}/agenda`), ctx.today);
    const events = items
      .filter((i) => isFamilyEvent(i, keywords))
      .map((i) => jbToRaw(i, ctx.nowIso))
      .filter((e): e is RawEvent => !!e && (e.end ?? e.start) >= ctx.today && e.start <= ctx.until);
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${events.length} gezinsevenementen van ${items.length}` };
  },
};
