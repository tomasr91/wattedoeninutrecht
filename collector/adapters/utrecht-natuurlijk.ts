/**
 * Utrecht Natuurlijk — stadsboerderijen (Steedes), stadstuinen en natuuractiviteiten van de gemeente.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - Overzicht per type: /activiteit-type/<type>/?view=upcoming (alles op één pagina, maanden vooruit).
 *    Types: onze-activiteiten, exposities (de-groene-uitloper = activiteiten van partners).
 *  - Activiteit: /activiteit/<slug>/?date=YYYY-MM-DD — de datum staat in de URL.
 *  - Kaart: datum of bereik ("21 t/m 23 okt 2026"), tijd ("10.30-11.30 uur"), locatie
 *    (Eilandsteede, Gagelsteede, Griftsteede, Koppelsteede, Steede Hoge Woerd, stadstuinen),
 *    doelgroep (Peuters, Kinderen, Gezinnen, Jongeren, Volwassenen, Alle leeftijden) en kosten.
 *  - Geen iCal of RSS. robots.txt staat alles toe (crawl-delay 5 voor een paar bots).
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cardTextAround, cleanText, detailInfo, parseDutchDate, priceTextFrom } from '../lib/parse.ts';
import type { RawEvent } from '../normalize.ts';
import type { Audience } from '../../src/domain/types.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const BASE = 'https://www.utrechtnatuurlijk.nl';
const ID = 'utrecht-natuurlijk';
const NAME = 'Utrecht Natuurlijk';
export const UN_LINK = /\/activiteit\/([a-z0-9-]+)\/?\?date=(\d{4}-\d{2}-\d{2})/;

/** Locaties met wijk; alleen Steede Hoge Woerd heeft een zeker adres in Leidsche Rijn. */
export const UN_LOCATIONS: { match: RegExp; venueName: string; locality: string; address?: string }[] = [
  { match: /steede hoge woerd/i, venueName: 'Steede Hoge Woerd', locality: 'De Meern', address: 'Hoge Woerdplein 1, 3454 PB Utrecht' },
  { match: /eilandsteede/i, venueName: 'Stadsboerderij Eilandsteede', locality: 'Transwijk' },
  { match: /gagelsteede/i, venueName: 'Stadsboerderij Gagelsteede', locality: 'Overvecht' },
  { match: /griftsteede/i, venueName: 'Stadsboerderij Griftsteede', locality: 'Noordoost' },
  { match: /koppelsteede/i, venueName: 'Stadsboerderij Koppelsteede', locality: 'Lunetten' },
  { match: /stadstuin klopvaart/i, venueName: 'Stadstuin Klopvaart', locality: 'Overvecht' },
  { match: /stadstuin plutodreef/i, venueName: 'Stadstuin Plutodreef', locality: 'Overvecht' },
  { match: /stadstuin zuilen/i, venueName: 'Stadstuin Zuilen', locality: 'Zuilen' },
  { match: /stadstuin kanaalweg/i, venueName: 'Stadstuin Kanaalweg', locality: 'Utrecht' },
];

export interface UnCard {
  slug: string;
  url: string;
  date: string;
  end?: string;
  time?: { start: string; end?: string };
  title: string;
  location?: (typeof UN_LOCATIONS)[number];
  groups: string[];
  priceText?: string;
}

const GROUPS = ['Peuters', 'Kinderen', 'Gezinnen', 'Jongeren', 'Volwassenen', 'Alle leeftijden'];
const pad = (s: string) => s.padStart(2, '0');

export function parseUnList(html: string, today: string): UnCard[] {
  const $ = cheerio.load(html);
  const out = new Map<string, UnCard>();
  $('a[href*="/activiteit/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(UN_LINK);
    if (!m) return;
    const key = `${m[1]}|${m[2]}`;
    if (out.has(key)) return;
    const text = cardTextAround($, el, /\/activiteit\/[a-z0-9-]+\/?\?date=/, /\b\d{4}-\d{2}-\d{2}\b/g);
    const title = cleanText($(el).find('h2, h3, h4').first().text()) || cleanText($(el).closest('article, li, div').find('h2, h3, h4').first().text()) || cleanText($(el).text());
    // Bereik "21 t/m 23 okt 2026" of "dinsdag 20 okt 2026 – zondag 3 jan 2027"
    // Scheidingsteken kan ook ― (U+2015) of — zijn: "donderdag 22 oktober 2026 ― zondag 25 oktober 2026".
    const range = text.match(/\b\d{1,2}(?:\s+[a-z]{3,9})?(?:\s+\d{4})?\s*(?:t\/m|–|—|―|-)\s*(?:[a-z]+dag\s+)?\d{1,2}\s+[a-z]{3,9}\.?\s+\d{4}/i);
    const parts = range ? range[0].split(/\s*(?:t\/m|–|—|―|-)\s*/) : [];
    const endText = parts.at(-1)?.replace(/^[a-z]+dag\s+/i, '');
    const parsed = endText ? { end: parseDutchDate(endText, today) } : undefined;
    // Begin van het bereik (zonder maand/jaar: die van het eind). De URL-datum is bij een lopend bereik
    // de dag van vandaag en verschuift dus; het begin van het bereik is stabiel.
    const startPart = parts.length > 1 ? parts[0] : undefined;
    const rangeStart = startPart
      ? parseDutchDate(/[a-z]/i.test(startPart) ? (/\d{4}/.test(startPart) ? startPart : `${startPart} ${endText!.replace(/^\d{1,2}\s+/, '').replace(/\s+\d{4}$/, '')} ${endText!.match(/\d{4}/)?.[0] ?? ''}`) : `${startPart} ${endText!.replace(/^\d{1,2}\s+/, '')}`, today)
      : undefined;
    const tm = text.match(/(\d{1,2})[.:](\d{2})\s*(?:-|–|tot)\s*(\d{1,2})[.:](\d{2})\s*uur/i) ?? text.match(/(\d{1,2})[.:](\d{2})\s*uur/i);
    const location = UN_LOCATIONS.find((l) => l.match.test(text));
    out.set(key, {
      slug: m[1],
      url: new URL(href, BASE).toString(),
      date: rangeStart && parsed?.end && rangeStart <= m[2] ? rangeStart : m[2],
      end: parsed?.end && parsed.end > m[2] ? parsed.end : undefined,
      time: tm ? { start: `${pad(tm[1])}:${tm[2]}`, end: tm[3] ? `${pad(tm[3])}:${tm[4]}` : undefined } : undefined,
      title,
      location,
      groups: GROUPS.filter((g) => new RegExp(`\\b${g}\\b`, 'i').test(text)),
      priceText: /vrijwillige bijdrage/i.test(text) ? 'Vrijwillige bijdrage' : priceTextFrom(text.replace(/\b(\d+),(\d{2})\b(?!\s*uur)/, '€ $1,$2')),
    });
  });
  return [...out.values()];
}

export function unAudiences(groups: string[]): Audience[] {
  const a = new Set<Audience>();
  if (groups.some((g) => /peuters|kinderen/i.test(g))) a.add('kinderen');
  if (groups.some((g) => /gezinnen|alle leeftijden/i.test(g))) a.add('gezin');
  if (groups.some((g) => /volwassenen|jongeren|alle leeftijden/i.test(g))) a.add('volwassenen');
  return a.size ? [...a] : ['gezin'];
}

export function unKind(c: Pick<UnCard, 'title' | 'location'>, expo = false): string {
  if (expo) return 'Expositie';
  if (/workshop/i.test(c.title)) return 'Workshop';
  if (/film|green screen/i.test(c.title)) return 'Film';
  if (/natuurcollege|lezing/i.test(c.title)) return 'Lezing';
  return c.location && /steede/i.test(c.location.venueName) ? 'Kinderboerderij' : 'Natuur';
}

export function unCardToRaw(c: UnCard, nowIso: string, expo = false, detail?: ReturnType<typeof detailInfo>): RawEvent {
  const age = detail?.age ?? null;
  const toddlers = c.groups.includes('Peuters') && !age;
  return {
    sourceId: ID,
    sourceName: NAME,
    // Bij een lopend bereik toont de site als begin steeds 'vandaag'; de einddatum is stabiel.
    sourceEventId: c.end ? `${c.slug}|tm-${c.end}` : `${c.slug}|${c.date}`,
    url: c.url,
    title: c.title,
    start: c.time && !c.end ? `${c.date}T${c.time.start}` : c.date,
    end: c.end ?? (c.time?.end ? `${c.date}T${c.time.end}` : undefined),
    allDay: !c.time || !!c.end,
    ongoing: expo || undefined,
    openingNote: c.end && c.time ? `Dagelijks ${c.time.start}–${c.time.end ?? ''}`.replace(/–$/, '') : undefined,
    venueName: c.location?.venueName,
    locality: c.location?.locality ?? 'Utrecht',
    address: c.location?.address,
    priceText: c.priceText,
    audiences: unAudiences(c.groups),
    officialMinMonths: age?.officialMinMonths,
    officialMaxMonths: age?.officialMaxMonths,
    ageLabel: age?.label,
    descriptionForClassification: detail?.text.slice(0, 1500),
    summary: detail?.intro,
    estimatedMinMonths: toddlers ? 18 : undefined,
    estimateReason: toddlers ? 'volgens de bron voor peuters' : undefined,
    fitReasons: toddlers ? ['Volgens de bron geschikt voor peuters'] : undefined,
    categories: expo ? ['expositie', 'natuur'] : ['natuur'],
    kind: unKind(c, expo),
    hints: c.groups,
    checkedAt: nowIso,
  };
}

export const utrechtNatuurlijk: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: `${BASE}/activiteiten/`,
  method: 'html',
  description: 'Activiteiten en exposities op de stadsboerderijen en stadstuinen van Utrecht Natuurlijk.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const types = (ctx.options.types as string[] | undefined) ?? ['onze-activiteiten', 'exposities'];
    const events: RawEvent[] = [];
    // Activiteitspagina's één keer per activiteit (niet per datum): daar staat o.a. de leeftijd.
    const details = new Map<string, ReturnType<typeof detailInfo> | undefined>();
    let fetched = 0;
    for (const t of types) {
      const cards = parseUnList(await fetchText(`${BASE}/activiteit-type/${t}/?view=upcoming`, { minIntervalMs: 5000 }), ctx.today);
      for (const c of cards) {
        if (c.date > ctx.until || (c.end ?? c.date) < ctx.today) continue;
        if (!details.has(c.slug) && fetched < ctx.maxDetailPages) {
          fetched++;
          try {
            details.set(c.slug, detailInfo(await fetchText(`${BASE}/activiteit/${c.slug}/`, { minIntervalMs: 3000 })));
          } catch (e) {
            details.set(c.slug, undefined);
            ctx.log(`  detail mislukt (${c.slug}): ${(e as Error).message}`);
          }
        }
        events.push(unCardToRaw(c, ctx.nowIso, t === 'exposities', details.get(c.slug)));
      }
    }
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${events.length} activiteiten` };
  },
};
