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
 *  - Zonder genres en wijken haalt de adapter de complete agenda van de hele stad op.
 */
import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.ts';
import { cleanText, combine, introFrom, parseDutchDate, parseDutchDateRange, parseGoogleCalendarLink, parseTimes } from '../lib/parse.ts';
import { recurrenceLabel } from '../../src/domain/series.ts';
import { parseIcs } from '../lib/ics.ts';
import { dateOf, diffDays } from '../../src/domain/dates.ts';
import { parseAgeLabel } from '../../src/domain/enrich.ts';
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

function titleFromSlug(slug: string): string {
  const t = slug.replace(/-/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Hoofdgenres, doelgroepen en kortingen van UITagenda: alles wat geen subgenre is. */
const UIT_TOP_LABELS = /^(cabaret & stand-up|dans & ballet|diversen|festivals|film|klassieke muziek|lezingen|literatuur|musea & exposities|musicals & shows|muziek|nightlife|rondleidingen|theater & toneel|tips van de redactie|kinderen|gezinnen|jongeren|regulier \/ volwassenen|.*korting|gratis)$/i;

/** UITagenda-genre (slug in /genre/<slug>/) → soortlabel in de app. */
export const GENRE_KIND: Record<string, string> = {
  musea: 'Expositie',
  exposities: 'Expositie',
  rondleidingen: 'Rondleiding',
  jeugd: 'Jeugdtheater',
  kids: 'Jeugdtheater',
  theater: 'Theater',
  cabaret: 'Cabaret',
  comedy: 'Comedy',
  muziek: 'Concert',
  klassiek: 'Concert',
  'klassieke-muziek': 'Concert',
  show: 'Voorstelling',
  nightlife: 'Uitgaan',
  film: 'Film',
  festivals: 'Festival',
  dans: 'Dans',
  lezingen: 'Lezing',
  literatuur: 'Lezing',
  markten: 'Markt',
  sport: 'Sport',
  workshops: 'Workshop',
};

function jsonLdPlace($: cheerio.CheerioAPI): string | undefined {
  let name: string | undefined;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (name) return;
    try {
      const d = JSON.parse($(el).text());
      if (d?.['@type'] === 'Event' && typeof d.location?.name === 'string') name = cleanText(d.location.name);
    } catch {
      /* ongeldige JSON-LD negeren */
    }
  });
  return name;
}

const WD = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

/**
 * Speeltijden-blok: "Datum doorlopend · Tijd vr t/m za: 20:30" (vaste reeks zonder einddatum)
 * of "Tijd zo 25 okt: 15:00 zo 22 nov: 15:00 …" (losse data binnen een periode).
 */
export function parsePlaytimes(text: string, today: string): { rolling?: boolean; note?: string; occurrences?: string[] } {
  const t = cleanText(text).toLowerCase();
  const datum = t.match(/datum\s+(.*?)(?=\s+tijd\b|$)/)?.[1] ?? '';
  const tijd = t.match(/\btijd\s+(.*?)(?=voeg toe|$)/)?.[1] ?? '';
  if (/doorlopend/.test(datum)) {
    const days = new Set<number>();
    const times = new Set<string>();
    for (const m of tijd.matchAll(/(?<![a-z])(ma|di|wo|do|vr|za|zo)(?:\s*(?:t\/m|-|–)\s*(ma|di|wo|do|vr|za|zo))?(?:\s*(?:,|en)\s*(ma|di|wo|do|vr|za|zo))?\s*:\s*(\d{1,2}[:.]\d{2})/g)) {
      const a = WD.indexOf(m[1]);
      const b = m[2] ? WD.indexOf(m[2]) : a;
      for (let i = a; i <= (b >= a ? b : b + 7); i++) days.add(i % 7);
      if (m[3]) days.add(WD.indexOf(m[3]));
      times.add(m[4].replace('.', ':'));
    }
    if (!days.size) return { rolling: true, note: 'Doorlopend' };
    const order = [...days].sort((x, y) => x - y);
    const dayText = order.length >= 6 ? 'Dagelijks' : order.length === 1 ? `Elke ${['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'][order[0]]}` : `Elke ${order.slice(0, -1).map((d) => WD[d]).join(', ')} en ${WD[order.at(-1)!]}`;
    return { rolling: true, note: times.size === 1 ? `${dayText} · ${[...times][0]}` : dayText };
  }
  const dates: string[] = [];
  const times: string[] = [];
  for (const m of tijd.matchAll(/(?<![a-z])(?:ma|di|wo|do|vr|za|zo)\s+(\d{1,2}\s+[a-z]{3,9})\s*:\s*(\d{1,2}[:.]\d{2})/g)) {
    const d = parseDutchDate(m[1], today);
    if (d) {
      dates.push(d);
      times.push(m[2].replace('.', ':'));
    }
  }
  const uniq = [...new Set(dates)].sort();
  // Een korte reeks aaneengesloten dagen (bv. een festival van do t/m zo) is gewoon meerdaags, geen reeks.
  if (uniq.length >= 2 && diffDays(uniq[0], uniq.at(-1)!) >= 7) return { occurrences: uniq, note: recurrenceLabel(uniq, times) };
  return {};
}

/**
 * Versie van de uitleesregels. Ophogen als parseEventPage iets nieuws of anders uitleest:
 * dan worden alle pagina's de volgende run opnieuw opgehaald.
 */
export const PARSER_VERSION = 'v9';

/**
 * Een opgeslagen detailpagina is 5–9 dagen geldig (verspreid per evenement, zodat niet alles
 * op dezelfde nacht verloopt). Doorlopende reeksen waarvan de eerstvolgende keer voorbij is,
 * worden opnieuw opgehaald.
 */
export function detailStillFresh(hit: { fetchedAt: string; value: RawEvent }, id: string, today: string): boolean {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const maxAge = 5 + (h % 5);
  if (diffDays(dateOf(hit.fetchedAt), today) >= maxAge) return false;
  if (hit.value.rolling && dateOf(hit.value.end ?? hit.value.start) < today) return false;
  return true;
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
  // De eigen datum staat bovenaan voluit ("maandag 2 november 2026 - maandag 30 november 2026").
  // Korte datums ("di 2 jun") kunnen ook bij andere activiteiten op de pagina horen, dus die alleen als laatste redmiddel.
  if (!start) {
    const DAY = '(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)';
    const header = bodyText.match(new RegExp(`(${DAY}\\s+\\d{1,2}\\s+[a-z]+\\s+\\d{4}(?:\\s+(?:-|–|t\\/m)\\s+${DAY}\\s+\\d{1,2}\\s+[a-z]+\\s+\\d{4})?)`, 'i'));
    const range = header ? parseDutchDateRange(header[1], ctx.today) : undefined;
    if (range) {
      // Tijd uit het veld "Tijd" ("ma: 19:30 - 21:00"), anders uit een korte datumregel met dezelfde datum.
      const tijd = bodyText.match(/\bTijd\s+(.{0,200}?)(?:Voeg toe|Locatie|Prijs|$)/);
      let times = tijd ? parseTimes(tijd[1]) : { all: [] as string[] } as ReturnType<typeof parseTimes>;
      if (!times.start) {
        const short = bodyText.match(/((?:ma|di|wo|do|vr|za|zo)\s+\d{1,2}\s+[a-z]{3,9})\b/i);
        if (short && parseDutchDate(short[1], ctx.today) === range.start) {
          const i = bodyText.indexOf(short[1]);
          times = parseTimes(bodyText.slice(i, i + 120));
        }
      }
      start = combine(range.start, times.start);
      end = range.end ?? (times.end ? combine(range.start, times.end) : undefined);
      allDay = !times.start;
      extra.push('Datum/tijd uit paginatekst gehaald; controleer bij de bron');
    }
  }
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
  const play = parsePlaytimes($('.post-playtimes').first().text() || '', ctx.today);
  if (play.occurrences) {
    // Losse data binnen een periode: eerste t/m laatste datum, met de data erbij.
    start = combine(play.occurrences[0], start.length > 10 ? start.slice(11) : undefined);
    end = play.occurrences.at(-1);
  }

  // Plek uit "Praktische informatie": <span>Naam<br>Straat 1<br>1234 AB Plaats <a>Bekijk locatie</a></span>
  const addr = $('address.post-location span').first().clone();
  addr.find('a').remove();
  const addrLines = (addr.html() ?? '')
    .split(/<br\s*\/?>/i)
    .map((l) => cleanText(cheerio.load(`<p>${l}</p>`).text()))
    .filter(Boolean);
  const ld = jsonLdPlace($);
  const GENERIC_LINK = /^(bekijk|toon|naar|meer|route|kaart|locatie\b)/i;
  const venueLinks = $('a[href*="/locatie/"]').toArray();
  const named = venueLinks.map((el) => cleanText($(el).text())).find((t) => t && !GENERIC_LINK.test(t));
  const slug = venueLinks.map((el) => $(el).attr('href')?.match(/\/locatie\/(?:\d+\/)?([a-z0-9-]+)/i)?.[1]).find(Boolean);
  const venueName = addrLines[0] || ld || named || location?.split(',')[0]?.trim() || (slug ? titleFromSlug(slug) : undefined);
  const street = addrLines.length >= 3 ? addrLines[1] : undefined;
  const postcodeCity = addrLines.at(-1)?.match(/^(\d{4}\s?[A-Z]{2})\s+(.+)$/);
  // Adres uit de praktische informatie; anders uit de agendalink (bv. "Domplein, 3512 JC Utrecht").
  const address = street && postcodeCity ? `${street}, ${postcodeCity[1]} ${postcodeCity[2]}` : location && location.includes(',') ? cleanText(location) : undefined;
  const city = postcodeCity?.[2];

  // Genres bovenaan de pagina (links naar /genre/<slug>/) en doelgroeplabels
  const genreSlugs = $('.post-genres a[href*="/genre/"]')
    .map((_, el) => ($(el).attr('href') ?? '').match(/\/genre\/([a-z0-9-]+)/)?.[1] ?? '')
    .get()
    .filter(Boolean);
  const genreLabels = $('.post-genres .genre-label').map((_, el) => cleanText($(el).text())).get().filter(Boolean);
  // Nightlife gaat voor: een clubavond met ook het label Muziek is uitgaan, geen concert.
  // Muziek: "Concert · <subgenre>" (bv. Jazz, Singer-songwriter, Pop & rock); zonder subgenre gewoon "Concert".
  const subgenre = genreLabels.find((g) => !UIT_TOP_LABELS.test(g) && !/€/.test(g));
  const music = genreSlugs.includes('muziek') || genreSlugs.includes('klassieke-muziek');
  const kind =
    (genreSlugs.includes('nightlife') ? 'Uitgaan' : undefined) ??
    (music ? (genreSlugs.includes('klassieke-muziek') ? 'Concert · Klassiek' : subgenre ? `Concert · ${subgenre}` : 'Concert') : undefined) ??
    genreSlugs.map((g) => GENRE_KIND[g]).find(Boolean);

  // Velden in de tekst: "Leeftijd: vanaf 6 jaar", "Duur: ± 40–55 minuten", "Kosten: …"
  const fields = new Map<string, string>();
  $('strong, b').each((_, el) => {
    const key = cleanText($(el).text()).replace(/:$/, '').toLowerCase();
    let val = '';
    for (let n = el.nextSibling; n && !(n.type === 'tag' && /^(br|strong|b|p|div)$/.test((n as { name?: string }).name ?? '')); n = n.nextSibling) {
      val += $(n).text();
    }
    val = cleanText(val.replace(/^\s*:\s*/, ''));
    if (key && val && !fields.has(key)) fields.set(key, val.slice(0, 120));
  });
  const field = (k: string) => fields.get(k.toLowerCase());
  const ageField = field('Leeftijd');
  const age = ageField ? parseAgeLabel(/^\d/.test(ageField) && !/jaar|\+/.test(ageField) ? `${ageField}+` : ageField.replace(/vanaf\s+(\d{1,2})\s*jaar/i, '$1+')) : null;
  const durField = field('Duur');
  const dur = durField?.match(/(\d{1,3})\s*(?:[–-]\s*\d{1,3}\s*)?(min|minuten|uur)/i);
  const durationMinutes = dur ? Number(dur[1]) * (/uur/i.test(dur[2]) ? 60 : 1) : undefined;
  const costField = field('Kosten') ?? field('Prijs');

  const entree = bodyText.match(/Entree\s*:?\s*(gratis|€\s*[\d.,]+(?:\s*[-/–]\s*€?\s*[\d.,]+)?[^.#]{0,40})/i);
  // Alleen labels en tags van dít evenement: onderaan staan "Meer inspiratie"-blokken van andere
  // evenementen met hun eigen labels (Kinderen, Jeugdtheater, 4+), die hier niet mogen meetellen.
  const tags = $('.post-tags-list').first().find('a').map((_, el) => cleanText($(el).text())).get().filter((t) => t.startsWith('#'));
  const hints = [...new Set([...tags, ...genreLabels.filter((g) => !/€/.test(g))].map((h) => h.trim()))];
  const ownText = cleanText([$('.post-header').first().text(), $('.post-playtimes').first().text(), $('.post-content').first().text()].join(' ')) || bodyText;
  // "#0 10" = leeftijd 0 t/m 10 jaar volgens de agenda
  const ageTag = tags.join(' ').match(/#0?(\d{1,2})\s(\d{1,2})\b/);
  const statusText = /\bGeannuleerd\b/i.test(ownText) ? 'Geannuleerd' : /\bUitverkocht\b/i.test(ownText) ? 'Uitverkocht' : undefined;
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
    ongoing: (isRange && allDay) || !!play.rolling || undefined,
    recurrenceNote: play.note,
    rolling: play.rolling,
    occurrences: play.occurrences,
    venueName,
    address,
    locality: /diverse locaties/i.test(venueName ?? '') ? 'Utrecht' : city && !/^utrecht$/i.test(city) ? city : undefined,
    priceText: entree?.[1] ?? (costField && /gratis|€|\d/.test(costField) ? costField : undefined),
    kind,
    durationMinutes,
    officialMinMonths: age?.officialMinMonths,
    officialMaxMonths: age?.officialMaxMonths,
    ageLabel: age?.label,
    bookingText: /reserveren (is )?(verplicht|noodzakelijk)|aanmelden verplicht/i.test(bodyText) ? 'reserveren verplicht' : undefined,
    bookingUrl: ticketHref && /^https?:/.test(ticketHref) ? ticketHref : undefined,
    hints,
    estimatedMinMonths: ageTag ? Number(ageTag[1]) * 12 : undefined,
    estimatedMaxMonths: ageTag ? Number(ageTag[2]) * 12 : undefined,
    estimateReason: ageTag ? 'leeftijdslabel van UITagenda' : undefined,
    summary: introFrom($, $('.post-content').first().length ? $('.post-content').first() : undefined),
    descriptionForClassification: (cleanText($('.post-content').first().text()).slice(0, 1500) || cleanText($('meta[name="description"]').attr('content'))) ?? undefined,
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
    const maxDetail = (ctx.options.maxDetailPages as number | undefined) ?? ctx.maxDetailPages;
    const filtered = [
      ...genres.map((g) => `genres=${encodeURIComponent(g)}`),
      ...wijken.map((w) => `wijk=${w}`),
    ];
    // Geen genres en geen wijken: de complete agenda van de hele stad in één lijst.
    const queries = filtered.length ? filtered : [''];

    const links = new Map<string, string>();
    // Alleen als alles volledig is opgehaald, mogen ontbrekende items als "verdwenen" gelden.
    let complete = true;
    for (const q of queries) {
      for (let page = 1; page <= maxPages; page++) {
        const url = `${BASE}/agenda/?vanaf=${dmy(ctx.today)}&tot=${dmy(ctx.until)}${q ? `&${q}` : ''}${page > 1 ? `&page=${page}` : ''}`;
        const html = await fetchText(url);
        const found = extractEventLinks(html);
        let added = 0;
        for (const [id, href] of found) {
          if (!links.has(id)) {
            links.set(id, href);
            added++;
          }
        }
        ctx.log(`  ${q || 'hele agenda'} p${page}: ${found.size} links, ${added} nieuw`);
        if (added === 0) break;
        if (page === maxPages) complete = false;
      }
    }

    const events: RawEvent[] = [];
    let n = 0;
    let reused = 0;
    for (const [id, url] of links) {
      // Eerder uitgelezen en nog vers genoeg: niet opnieuw ophalen (de lijstpagina bevestigt dat hij er nog is).
      const cacheKey = `${PARSER_VERSION}|${id}`;
      const hit = ctx.cache?.get<RawEvent>(cacheKey);
      if (hit && detailStillFresh(hit, id, ctx.today)) {
        const ev = { ...hit.value, checkedAt: ctx.nowIso };
        if (dateOf(ev.end ?? ev.start) >= ctx.today && dateOf(ev.start) <= ctx.until) events.push(ev);
        reused++;
        continue;
      }
      if (n++ >= maxDetail) {
        ctx.log(`  limiet van ${maxDetail} detailpagina's bereikt`);
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
        ctx.cache?.set(cacheKey, ev);
        const last = dateOf(ev.end ?? ev.start);
        if (last < ctx.today || dateOf(ev.start) > ctx.until) continue;
        events.push(ev);
      } catch (e) {
        ctx.log(`  fout bij ${url}: ${(e as Error).message}`);
        complete = false;
      }
    }
    ctx.log(`  detailpagina's: ${n} opgehaald, ${reused} uit de opslag`);
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
