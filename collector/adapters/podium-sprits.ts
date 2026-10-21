/**
 * Podium Sprits — jeugdtheater in ZIMIHC theater Zuilen, veel voorstellingen voor 0–6 jaar.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Programma: /programma. Per voorstelling een blok met titel, gezelschap, leeftijd "(2+)",
 *    korte datums zonder jaar ("WO 4 NOV | 10:00 & 11:30") en een link "INFO & TICKETS"
 *    naar /<slug>.
 *  - Productiepagina /<slug>: "Woensdag 4 november 2026", "Aanvang 10:00", duur, prijzen
 *    ("€9 / €11 / €13"), ticketlink (weticket.io).
 *  - Op productiepagina's staan soms ook datums van andere voorstellingen. Daarom tellen
 *    alleen datums die ook in het blok van die voorstelling op /programma staan.
 *  - Geen iCal, RSS of API gevonden. robots.txt staat alles toe.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cleanText, inferYear, priceTextFrom, spacedText } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://podiumsprits.nl';
const ID = 'podium-sprits';
const NAME = 'Podium Sprits';
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mrt: 3, apr: 4, mei: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12 };
const SHORT_DATE = /\b(?:MA|DI|WO|DO|VR|ZA|ZO)\s+(\d{1,2})\s+(JAN|FEB|MRT|APR|MEI|JUN|JUL|AUG|SEP|OKT|NOV|DEC)\b\s*\|?\s*((?:\d{1,2}[:.]\d{2}(?:\s*(?:&|,|en)\s*)?)+)/gi;

export interface SpritsShow {
  slug: string;
  url: string;
  title: string;
  /** Sessies volgens het programmablok: datum + tijden. */
  sessions: { date: string; time?: string }[];
}

/** Voorstellingen van /programma: elk blok met een "INFO & TICKETS"-link. */
export function parseSpritsProgram(html: string, today: string): SpritsShow[] {
  const $ = cheerio.load(html);
  const shows: SpritsShow[] = [];
  $('a[href]').each((_, el) => {
    if (!/info\s*&(?:amp;)?\s*tickets/i.test(cleanText($(el).text()))) return;
    const href = $(el).attr('href') ?? '';
    const url = new URL(href, BASE);
    if (url.host.replace(/^www\./, '') !== 'podiumsprits.nl') return;
    const slug = url.pathname.replace(/^\/|\/$/g, '');
    if (!slug || slug.includes('/')) return;
    // Het blok: klim tot er een titel én een datum in staat, maar niet meer dan één ticketlink.
    let node = $(el);
    for (let i = 0; i < 6; i++) {
      const parent = node.parent();
      if (!parent.length || parent.is('body, main')) break;
      const links = parent.find('a').filter((_, a) => /info\s*&(?:amp;)?\s*tickets/i.test($(a).text())).length;
      if (links > 1) break;
      node = parent;
    }
    const text = spacedText($, node);
    const title = cleanText(node.find('h1, h2, h3').first().text()) || slug.replace(/-/g, ' ');
    const sessions: SpritsShow['sessions'] = [];
    for (const m of text.matchAll(SHORT_DATE)) {
      const date = inferYear(Number(m[1]), MONTHS[m[2].toLowerCase()], today);
      const times = [...m[3].matchAll(/(\d{1,2})[:.](\d{2})/g)].map((t) => `${t[1].padStart(2, '0')}:${t[2]}`);
      if (!times.length) sessions.push({ date });
      times.forEach((time) => sessions.push({ date, time }));
    }
    shows.push({ slug, url: url.toString().replace(/\/$/, ''), title, sessions });
  });
  return shows;
}

const LONG_DATE = /\b(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi;
const LONG_MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Volledige datums, duur, prijs en ticketlink van een productiepagina. */
export function parseSpritsDetail(html: string): { dates: string[]; durationMinutes?: number; priceText?: string; bookingUrl?: string; company?: string } {
  const $ = cheerio.load(html);
  const bookingUrl = $('a[href*="weticket"], a[href*="tickets"]').first().attr('href');
  $('script, style, nav, header, footer').remove();
  const text = spacedText($, $('main').length ? $('main') : $('body'));
  const dates = [...text.matchAll(LONG_DATE)].map(
    (m) => `${m[3]}-${String(LONG_MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`,
  );
  const dur = text.match(/(\d{2,3})\s*minuten/i);
  const priceZone = text.match(/€\s*\d[^]{0,60}/)?.[0] ?? '';
  return { dates: [...new Set(dates)], durationMinutes: dur ? Number(dur[1]) : undefined, priceText: priceTextFrom(priceZone), bookingUrl };
}

/** Combineer: alleen sessies waarvan de datum óók op de productiepagina staat (als die er is). */
export function spritsToRaw(show: SpritsShow, detail: ReturnType<typeof parseSpritsDetail> | undefined, nowIso: string): RawEvent[] {
  const confirmed = detail && detail.dates.length ? show.sessions.filter((s) => detail.dates.includes(s.date)) : show.sessions;
  return confirmed.map((s) => ({
    sourceId: ID,
    sourceName: NAME,
    sourceEventId: `${show.slug}|${s.date}|${s.time ?? ''}`,
    url: show.url,
    title: show.title,
    start: s.time ? `${s.date}T${s.time}` : s.date,
    venueName: 'ZIMIHC theater Zuilen',
    address: 'Prinses Christinalaan 1, 3554 JL Utrecht',
    locality: 'Zuilen',
    priceText: detail?.priceText,
    bookingText: 'tickets',
    bookingUrl: detail?.bookingUrl,
    durationMinutes: detail?.durationMinutes,
    hints: ['Jeugd'],
    kind: /concert/i.test(show.title) ? 'Kinderconcert' : 'Jeugdtheater',
    categories: ['theater'],
    audiences: ['kinderen', 'gezin'],
    indoor: 'binnen',
    checkedAt: nowIso,
  }));
}

export const podiumSprits: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/programma`,
  method: 'html',
  description: 'Jeugdtheater in ZIMIHC theater Zuilen; datums uit het programma, bevestigd op de productiepagina.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const shows = parseSpritsProgram(await fetchText(`${BASE}/programma`), ctx.today);
    const events: RawEvent[] = [];
    let n = 0;
    for (const show of shows) {
      const inWindow = show.sessions.some((s) => s.date >= ctx.today && s.date <= ctx.until);
      if (!inWindow) continue;
      let detail: ReturnType<typeof parseSpritsDetail> | undefined;
      if (n++ < ctx.maxDetailPages) {
        try {
          detail = parseSpritsDetail(await fetchText(show.url));
        } catch (e) {
          ctx.log(`  detail mislukt (${show.url}): ${(e as Error).message}`);
        }
      }
      events.push(...spritsToRaw(show, detail, ctx.nowIso).filter((e) => e.start.slice(0, 10) >= ctx.today && e.start.slice(0, 10) <= ctx.until));
    }
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${shows.length} producties in het programma` };
  },
};
