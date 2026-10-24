/**
 * Jaarbeurs — alle publieksevenementen. Wat op kinderen of gezinnen wijst (LEGO World, Disney On Ice,
 * Winterspektakel …) staat bij Kinderen, de rest (Vakantiebeurs, Comic Con, hobbybeurzen …) bij Volwassenen.
 * Zakelijke en gastevenementen zonder publieksdeel vallen af.
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
import { cardTextAround, cleanText, combine, introFrom, parseDutchDate } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.jaarbeurs.nl';
const ID = 'jaarbeurs';
const NAME = 'Jaarbeurs';
export const JB_LINK = /\/agenda-item\/([a-z0-9-]+)\/?$/;
const MONTH = '(?:jan|feb|mrt|maart|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*';
export const DEFAULT_FAMILY_KEYWORDS = ['kind', 'kinderen', 'kids', 'familie', 'gezin', 'lego', 'disney', 'winterspektakel', 'circus', 'speelgoed', 'sinterklaas', 'kerst'];

/**
 * "Publieksevenement" betekent bij de Jaarbeurs ook vakcongressen en studiebeurzen. Dat zijn geen uitjes:
 * die laten we weg (getest op de agenda van 24-10-2026).
 */
export const DEFAULT_EXCLUDE = [
  'conference', 'congres', 'summit', 'professionals', 'business', 'marketing', 'scrum', 'techorama', 'esg days',
  'overtuigen', 'studiekeuze', 'master fair', 'buitenlandbeurs', 'go-abroad', 'opleidingen', 'carrière', 'vacature',
  'the send', 'vakdagen', 'gebruikersdagen', 'ondernemersdagen',
];

export function isOuting(i: Pick<JbItem, 'title' | 'text'>, exclude = DEFAULT_EXCLUDE): boolean {
  const hay = `${i.title} ${i.text}`.toLowerCase();
  if (/18\+|kamasutra|erotiek/.test(hay)) return false;
  return !exclude.some((k) => hay.includes(k.toLowerCase()));
}

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

/** Korte tekst op de kaart, zonder titel, datum en labels. */
export function jbSummary(i: Pick<JbItem, 'title' | 'text'>): string | undefined {
  const t = cleanText(
    i.text
      .replace(i.title, ' ')
      .replace(new RegExp(`\\d{1,2}(?:\\s+${MONTH})?(?:\\s+\\d{4})?\\s*[–-]\\s*\\d{1,2}\\s+${MONTH}\\s+\\d{4}`, 'gi'), ' ')
      .replace(new RegExp(`\\b\\d{1,2}\\s+${MONTH}\\s+\\d{4}`, 'gi'), ' ')
      .replace(/publieksevenement|gastevenement|zakelijk evenement|bekijk|meer info|lees meer|tickets/gi, ' '),
  );
  return t.length >= 30 ? t.slice(0, 220) : undefined;
}

export function jbToRaw(i: JbItem, nowIso: string, keywords = DEFAULT_FAMILY_KEYWORDS): RawEvent | undefined {
  if (!i.start) return undefined;
  const family = isFamilyEvent(i, keywords);
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
    audiences: family ? ['gezin', 'kinderen'] : ['volwassenen'],
    // Gezinsevenement (Winterspektakel, Team Challenge): evenement; anders een publieksbeurs.
    kind: family ? 'Beurs & evenement' : /wielren|sport|hardloop|schaats|fiets/i.test(`${i.title} ${i.text}`) ? 'Sport' : 'Beurs',
    summary: jbSummary(i),
    indoor: 'binnen',
    bookingText: 'tickets',
    extraUncertainties: ['Tijden, prijs en leeftijd staan op de bronpagina'],
    checkedAt: nowIso,
  };
}

/** Wat de detailpagina toevoegt: tijden per dag, prijs en een korte beschrijving. */
export interface JbDetail {
  days: { date: string; from: string; to?: string }[];
  price?: string;
  summary?: string;
}

/** Detailpagina: "14 nov 2026 09:00 - 17:00" per dag, "Toegangskaartje v.a. €13,50", eerste alinea. */
export function parseJbDetail(html: string, today: string): JbDetail {
  const $ = cheerio.load(html);
  const meta = $('.agenda__info-box').first();
  const text = cleanText((meta.length ? meta : $('main')).text());
  const days: JbDetail['days'] = [];
  for (const m of text.matchAll(new RegExp(`(\\d{1,2}\\s+${MONTH}\\s+\\d{4})\\s+(\\d{1,2}[:.]\\d{2})\\s*[-–]\\s*(\\d{1,2}[:.]\\d{2})`, 'gi'))) {
    const date = parseDutchDate(m[1], today);
    const from = m[2].replace('.', ':');
    if (date && !days.some((d) => d.date === date && d.from === from)) days.push({ date, from, to: m[3].replace('.', ':') });
  }
  days.sort((a, b) => (a.date + a.from < b.date + b.from ? -1 : 1));
  const price = cleanText($('.agenda__tickets-starting').first().text()) || undefined;
  const h1 = $('main h1').first();
  const summary = introFrom($, h1.closest('.col-md-6').length ? h1.closest('.col-md-6') : undefined);
  return { days, price, summary };
}

const DAYNAME = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const fmtDay = (d: string) => `${DAYNAME[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${Number(d.slice(8, 10))} ${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(d.slice(5, 7)) - 1]}`;

/** Detailgegevens in een RawEvent verwerken. */
export function withJbDetail(e: RawEvent, d: JbDetail): RawEvent {
  const out: RawEvent = { ...e };
  if (d.price) out.priceText = /^v\.?a\.?/i.test(d.price) ? d.price : `v.a. ${d.price}`;
  if (d.summary) out.summary = d.summary;
  const slots = d.days.filter((x) => x.date >= dateOnly(e.start) && x.date <= dateOnly(e.end ?? e.start));
  if (!slots.length) return out;
  const dates = [...new Set(slots.map((x) => x.date))];
  const first = slots[0];
  const last = slots.at(-1)!;
  out.start = combine(first.date, first.from);
  out.end = dates.length === 1 ? (last.to ? combine(last.date, last.to) : undefined) : last.date;
  out.allDay = false;
  // Meerdere tijden op één dag = voorstellingen (Disney On Ice: 11:00 en 15:00).
  const perDay = dates.map((dt) => slots.filter((x) => x.date === dt));
  const shows = perDay.some((x) => x.length > 1);
  const usual = mostCommon(perDay.map((x) => x.map((y) => (shows ? y.from : `${y.from}–${y.to ?? ''}`)).join(' en ')));
  // Dagen binnen de periode zonder tijden (Disney On Ice: niet op 22 en 23 dec). Een paar: noemen; veel: losse data.
  const missing: string[] = [];
  for (let t = Date.parse(dates[0]) + 864e5; t < Date.parse(dates.at(-1)!); t += 864e5) {
    const dt = new Date(t).toISOString().slice(0, 10);
    if (!dates.includes(dt)) missing.push(dt);
  }
  if (missing.length > 5) out.occurrences = dates;
  const gap = missing.length && missing.length <= 5 ? ` (niet op ${missing.map((m) => fmtDay(m)).join(', ')})` : '';
  const allSame = perDay.every((x) => x.map((y) => `${y.from}–${y.to}`).join() === perDay[0].map((y) => `${y.from}–${y.to}`).join());
  out.openingNote =
    dates.length === 1 && !shows
      ? undefined
      : dates.length <= 4
        ? perDay.map((x) => `${fmtDay(x[0].date)} ${x.map((y) => (shows ? y.from : `${y.from}–${y.to ?? ''}`)).join(' en ')}`).join('; ')
        : shows
          ? `Voorstellingen op ${dates.length} dagen, meestal om ${usual}`
          : allSame
            ? `Elke dag ${usual}`
            : `Open ${dates.length} dagen; tijden verschillen per dag (meestal ${usual})`;
  if (out.openingNote && dates.length > 4) out.openingNote += gap;
  // Verschilt de begintijd per dag, of zijn het voorstellingen: geen begintijd op de kaart (die zou alleen voor dag 1 gelden).
  if (dates.length > 1 && (shows || new Set(slots.map((x) => x.from)).size > 1)) out.start = first.date;
  out.extraUncertainties = undefined;
  return out;
}

const dateOnly = (s: string) => s.slice(0, 10);
function mostCommon(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1])[0][0];
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
    const events: RawEvent[] = items
      .filter((i) => i.isPublic && isOuting(i, (ctx.options.excludeKeywords as string[] | undefined) ?? DEFAULT_EXCLUDE))
      .map((i) => jbToRaw(i, ctx.nowIso, keywords))
      .filter((e): e is RawEvent => !!e && (e.end ?? e.start) >= ctx.today && e.start <= ctx.until);
    // Detailpagina's (toegestaan volgens robots.txt van 24-10-2026): tijden, prijs, beschrijving.
    let detailed = 0;
    for (let k = 0; k < events.length; k++) {
      try {
        events[k] = withJbDetail(events[k], parseJbDetail(await fetchText(events[k].url), ctx.today));
        detailed++;
      } catch {
        // Lukt een detailpagina niet, dan blijven de gegevens van de agendapagina staan.
      }
    }
    const fam = events.filter((e) => e.audiences?.includes('kinderen')).length;
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${events.length} publieksevenementen van ${items.length} (${fam} voor gezinnen), ${detailed} met details` };
  },
};
