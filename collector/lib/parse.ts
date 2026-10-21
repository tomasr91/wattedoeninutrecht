/**
 * Parsers voor Nederlandstalige datum- en tijdnotaties zoals ze in
 * evenementenlijsten staan, plus generieke extractie van gestructureerde
 * data (JSON-LD, Google Agenda-links).
 */
import { addDays, diffDays, utcToLocal } from '../../src/domain/dates.ts';

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mrt: 3, maart: 3, apr: 4, april: 4, mei: 5,
  jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, augustus: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Datum zonder jaartal ("wo 21 okt") → eerstvolgende passende datum,
 * met een marge van een week terug voor lopende activiteiten.
 */
export function inferYear(day: number, month: number, today: string): string {
  const y = Number(today.slice(0, 4));
  for (const year of [y - 1, y, y + 1]) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    const d = diffDays(today, key);
    if (d >= -7 && d < 358) return key;
  }
  return `${y}-${pad(month)}-${pad(day)}`;
}

/** Eén datum: "wo 21 okt", "21 oktober 2026", "21-10-2026", "2026-10-21". */
export function parseDutchDate(text: string, today: string): string | undefined {
  const t = text.toLowerCase();
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  m = t.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?/);
  if (m && MONTHS[m[2]]) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (m[3]) return `${m[3]}-${pad(month)}-${pad(day)}`;
    return inferYear(day, month, today);
  }
  return undefined;
}

/** Datumbereik: "wo 7 okt t/m zo 3 jan", "do 15 okt - wo 21 okt". */
export function parseDutchDateRange(text: string, today: string): { start: string; end?: string } | undefined {
  const parts = text.split(/\s+(?:t\/m|tot en met|–|-)\s+/i);
  let start = parseDutchDate(parts[0], today);
  if (!start) return undefined;
  if (parts.length < 2) return { start };
  // Bij een bereik bepaalt de einddatum het jaartal: een lopende expositie kan lang geleden zijn begonnen.
  const end = parseDutchDate(parts[1], today);
  if (!end) return { start };
  const startHasYear = /\d{4}/.test(parts[0]);
  while (!startHasYear && start > end) start = `${Number(start.slice(0, 4)) - 1}${start.slice(4)}`;
  return start <= end ? { start, end } : { start };
}

/** Eerste tijdstip en eventueel eindtijd: "10:30-11:00", "15.00 uur", "10:00, 11:30". */
export function parseTimes(text: string): { start?: string; end?: string; all: string[] } {
  const all = [...text.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)].map((m) => `${pad(Number(m[1]))}:${m[2]}`);
  const range = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:-|–|tot)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (range) {
    return { start: `${pad(Number(range[1]))}:${range[2]}`, end: `${pad(Number(range[3]))}:${range[4]}`, all };
  }
  return { start: all[0], all };
}

export function combine(date: string, time?: string): string {
  return time ? `${date}T${time}` : date;
}

/** Google Agenda-sjabloonlink → start/einde/titel/locatie. */
export function parseGoogleCalendarLink(href: string):
  | { title?: string; start: string; end?: string; allDay: boolean; location?: string }
  | undefined {
  let u: URL;
  try {
    u = new URL(href.replace(/&amp;/g, '&'));
  } catch {
    return undefined;
  }
  if (!/calendar\.google\./.test(u.host)) return undefined;
  const dates = u.searchParams.get('dates');
  if (!dates) return undefined;
  const [a, b] = dates.split('/');
  const conv = (s: string): { v: string; allDay: boolean } | undefined => {
    if (/^\d{8}$/.test(s)) return { v: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, allDay: true };
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return undefined;
    if (m[7] === 'Z') {
      return { v: utcToLocal(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))), allDay: false };
    }
    return { v: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`, allDay: false };
  };
  const s = conv(a);
  if (!s) return undefined;
  let e = b ? conv(b) : undefined;
  // Google gebruikt een exclusieve einddatum voor hele dagen
  if (e && e.allDay) e = { ...e, v: addDays(e.v, -1) };
  // Middernacht-starttijd in een sjabloonlink betekent in de praktijk "geen tijd bekend"
  const start = !s.allDay && s.v.endsWith('T00:00') ? s.v.slice(0, 10) : s.v;
  return {
    title: u.searchParams.get('text') ?? undefined,
    start,
    end: e?.v,
    allDay: s.allDay || start.length === 10,
    location: u.searchParams.get('location') ?? undefined,
  };
}

/** Alle schema.org Event-objecten uit JSON-LD-blokken in een HTML-pagina. */
export function extractJsonLdEvents(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const data = JSON.parse(m[1].trim());
      const visit = (node: unknown) => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== 'object') return;
        const obj = node as Record<string, unknown>;
        const type = obj['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === 'string' && /Event$/.test(t))) out.push(obj);
        if (obj['@graph']) visit(obj['@graph']);
      };
      visit(data);
    } catch {
      // Ongeldige JSON-LD negeren
    }
  }
  return out;
}

/** ISO-datum uit JSON-LD → lokale Amsterdamse tijd of datum. */
export function isoToLocal(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const hasZone = /([+-]\d{2}:?\d{2}|Z)$/.test(value);
  if (hasZone) return utcToLocal(new Date(value));
  return value.slice(0, 16);
}

export function cleanText(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** Zichtbare tekst met een spatie tussen elementen (cheerio's .text() plakt "Titel" en "AFGELAST" aan elkaar). */
export function spacedText($: import('cheerio').CheerioAPI, node: import('cheerio').Cheerio<import('domhandler').AnyNode>): string {
  const parts: string[] = [];
  const walk = (n: import('domhandler').AnyNode) => {
    if (n.type === 'text') parts.push((n as unknown as { data: string }).data);
    else if (n.type === 'tag' || n.type === 'root') {
      const name = (n as unknown as { name?: string }).name;
      if (name === 'script' || name === 'style') return;
      for (const c of (n as unknown as { children: import('domhandler').AnyNode[] }).children ?? []) walk(c);
      parts.push(' ');
    }
  };
  node.each((_, el) => walk(el));
  return cleanText(parts.join(' ').replace(/&amp;/g, '&'));
}

/**
 * Tekst van het kleinste blok rond een link dat precies één activiteit beschrijft.
 * Klimt omhoog in de DOM zolang het ouderblok niet meer dan één activiteit bevat
 * (gemeten aan het aantal verschillende eventlinks én het aantal datums).
 */
export function cardTextAround(
  $: import('cheerio').CheerioAPI,
  el: import('domhandler').AnyNode,
  linkRe: RegExp,
  dateRe: RegExp = /\b\d{1,2}\s+(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\b/gi,
  maxLevels = 7,
): string {
  let node = $(el);
  for (let i = 0; i < maxLevels; i++) {
    const parent = node.parent();
    if (!parent.length || parent.is('body, main, html')) break;
    const hrefs = new Set(
      parent
        .find('a[href]')
        .toArray()
        .map((a) => $(a).attr('href') ?? '')
        .filter((h) => linkRe.test(h))
        .map((h) => h.replace(/[?#].*$/, '').replace(/\/$/, '')),
    );
    const dates = spacedText($, parent).match(new RegExp(dateRe.source, 'gi')) ?? [];
    if (hrefs.size > 1 || dates.length > 1) break;
    node = parent;
  }
  return spacedText($, node);
}

/** Alle bedragen in een tekst: "€ 16,-", "€9 / €11", "€ 12,50". */
export function pricesIn(text: string): number[] {
  return [...text.matchAll(/€\s*(\d{1,3})(?:[,.](\d{2}|-))?/g)].map((m) => Number(m[1]) + (m[2] && m[2] !== '-' ? Number(m[2]) / 100 : 0));
}

export function priceTextFrom(text: string): string | undefined {
  if (/\bgratis\b|vrije inloop|vrij toegankelijk/i.test(text) && pricesIn(text).length === 0) return 'Gratis';
  const p = [...new Set(pricesIn(text))].sort((a, b) => a - b);
  if (!p.length) return undefined;
  const fmt = (n: number) => `€ ${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')}`;
  return p.length === 1 ? fmt(p[0]) : `${fmt(p[0])} – ${fmt(p[p.length - 1])}`;
}
