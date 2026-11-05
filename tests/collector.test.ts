/**
 * Tests voor de verzamellaag. De HTML-fragmenten hieronder zijn SYNTHETISCH:
 * ze bootsen de structuur na die bij het bronnenonderzoek is waargenomen,
 * maar zijn geen kopie van de echte pagina's en bevatten fictieve gegevens.
 */
import { dedupeRepeated } from '../collector/lib/parse';
import { describe, expect, it } from 'vitest';
import { inferYear, parseDutchDate, parseDutchDateRange, parseGoogleCalendarLink, parseTimes, extractJsonLdEvents } from '../collector/lib/parse';
import { parseIcs } from '../collector/lib/ics';
import { isAllowed, parseRobots } from '../collector/lib/http';
import { normalize, type RawEvent } from '../collector/normalize';
import { buildExport } from '../collector/export';
import { testActivity } from './fixtures';

const TODAY = '2026-10-21';
const NOW = '2026-10-21T07:00:00.000Z';

describe('Nederlandse datums en tijden', () => {
  it('jaartal afleiden', () => {
    expect(inferYear(21, 10, TODAY)).toBe('2026-10-21');
    expect(inferYear(3, 1, TODAY)).toBe('2027-01-03');
    expect(inferYear(17, 10, TODAY)).toBe('2026-10-17'); // lopend (binnen een week terug)
  });
  it('losse datums', () => {
    expect(parseDutchDate('wo 21 okt', TODAY)).toBe('2026-10-21');
    expect(parseDutchDate('zaterdag 14 november 2026', TODAY)).toBe('2026-11-14');
    expect(parseDutchDate('16-12-2026', TODAY)).toBe('2026-12-16');
  });
  it('bereiken over de jaargrens', () => {
    expect(parseDutchDateRange('wo 7 okt t/m zo 3 jan', TODAY)).toEqual({ start: '2026-10-07', end: '2027-01-03' });
  });
  it('tijden', () => {
    expect(parseTimes('10:30-11:00')).toMatchObject({ start: '10:30', end: '11:00' });
    expect(parseTimes('aanvang 15.00 uur')).toMatchObject({ start: '15:00' });
    expect(parseTimes('10:00, 11:30').all).toEqual(['10:00', '11:30']);
  });
});

describe('Google Agenda-link', () => {
  it('lokale tijden', () => {
    const g = parseGoogleCalendarLink(
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Test&dates=20261107T180000/20261107T210000&location=Utrecht',
    );
    expect(g).toMatchObject({ start: '2026-11-07T18:00', end: '2026-11-07T21:00', allDay: false, location: 'Utrecht' });
  });
  it('UTC-tijden worden omgezet naar Amsterdam (wintertijd)', () => {
    const g = parseGoogleCalendarLink('https://calendar.google.com/calendar/render?dates=20261213T140000Z/20261213T150000Z');
    expect(g?.start).toBe('2026-12-13T15:00');
  });
  it('hele dagen met exclusieve einddatum', () => {
    const g = parseGoogleCalendarLink('https://calendar.google.com/calendar/render?dates=20261204/20270104');
    expect(g).toMatchObject({ start: '2026-12-04', end: '2027-01-03', allDay: true });
  });
  it('middernacht betekent geen bekende tijd', () => {
    const g = parseGoogleCalendarLink('https://calendar.google.com/calendar/render?dates=20261107T000000/20261107T235900');
    expect(g?.start).toBe('2026-11-07');
  });
});

describe('iCal', () => {
  it('leest VEVENTs met TZID, UTC en hele dagen', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:a1',
      'SUMMARY:Peuterochtend\\, met liedjes',
      'DTSTART;TZID=Europe/Amsterdam:20261104T100000',
      'DTEND;TZID=Europe/Amsterdam:20261104T103000',
      'LOCATION:Vleuten',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:a2',
      'SUMMARY:Lange',
      '  titel',
      'DTSTART:20261212T130000Z',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:a3',
      'SUMMARY:Expo',
      'DTSTART;VALUE=DATE:20261201',
      'DTEND;VALUE=DATE:20270101',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const ev = parseIcs(ics);
    expect(ev[0]).toMatchObject({ summary: 'Peuterochtend, met liedjes', start: '2026-11-04T10:00', end: '2026-11-04T10:30' });
    expect(ev[1]).toMatchObject({ summary: 'Lange titel', start: '2026-12-12T14:00', status: 'CANCELLED' });
    expect(ev[2]).toMatchObject({ start: '2026-12-01', end: '2026-12-31', allDay: true });
  });
});

describe('robots.txt', () => {
  const rules = parseRobots('User-agent: *\nDisallow: /zoeken\nDisallow: /*?print\nAllow: /zoeken/agenda\n\nUser-agent: BadBot\nDisallow: /');
  it('respecteert Disallow', () => {
    expect(isAllowed(rules, '/zoeken?q=x')).toBe(false);
    expect(isAllowed(rules, '/agenda?print')).toBe(false);
    expect(isAllowed(rules, '/agenda/?page=2')).toBe(true);
  });
  it('langste Allow wint', () => {
    expect(isAllowed(rules, '/zoeken/agenda')).toBe(true);
  });
});

describe('JSON-LD', () => {
  it('vindt Event-objecten, ook in @graph', () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"TheaterEvent","name":"T","startDate":"2026-11-08T15:00:00+01:00"}]}</script>`;
    expect(extractJsonLdEvents(html)).toHaveLength(1);
  });
});

describe('normalisatie', () => {
  const raw: RawEvent = {
    sourceId: 'test',
    sourceName: 'Testbron',
    sourceEventId: '1',
    url: 'https://example.invalid/1',
    title: '[TESTDATA] Voorlezen (2-4 jaar)',
    start: '2026-10-28T10:30',
    end: '2026-10-28T11:00',
    venueName: 'Bibliotheek Vleuterweide',
    priceText: 'Gratis',
    bookingText: 'inloop',
    hints: ['Jeugd'],
    checkedAt: NOW,
  };
  it('maakt ontbrekende informatie zichtbaar', () => {
    const a = normalize({ ...raw, start: '2026-10-28', priceText: undefined, bookingText: undefined, venueName: 'Onbekende zaal' });
    expect(a.uncertainties).toEqual(
      expect.arrayContaining(['Begintijd niet bekend', 'Prijs niet vermeld', 'Onbekend of reserveren nodig is']),
    );
  });
  it('ID is stabiel tussen runs', () => {
    expect(normalize(raw).id).toBe(normalize({ ...raw, checkedAt: '2026-10-28T07:00:00Z' }).id);
  });
  it('bronomschrijving wordt nooit overgenomen', () => {
    const a = normalize({ ...raw, descriptionForClassification: 'Letterlijke tekst van de bron' });
    expect(JSON.stringify(a)).not.toContain('Letterlijke tekst');
  });
});

describe('export', () => {
  it('laat verlopen, oude en testdata weg', () => {
    const items = [
      testActivity({ isTestData: false, start: '2026-10-28T10:00' }),
      testActivity({ isTestData: false, start: '2026-10-01T10:00', status: 'verlopen' }),
      testActivity({ isTestData: false, start: '2026-10-20T10:00' }),
      testActivity({ start: '2026-10-28T11:00' }),
    ];
    expect(buildExport(items, TODAY).activities).toHaveLength(1);
  });
});

describe('bibliotheek: titels', () => {
  it('haalt een dubbele titel terug naar één keer', () => {
    expect(dedupeRepeated('Boek & Yoga (4-8 jaar) Boek & Yoga (4-8 jaar)')).toBe('Boek & Yoga (4-8 jaar)');
    expect(dedupeRepeated('Feest (4+)')).toBe('Feest (4+)');
  });
});

import { isDuplicate } from '../src/domain/dedupe';
describe('dubbel: zelfde zaal, zelfde begintijd', () => {
  const act = (title: string, start = '2026-11-04T10:00', venue = 'ZIMIHC theater Zuilen') => testActivity({ title, start, venue: { name: venue, geoPrecision: 'unknown' } } as never);
  it.each([
    ['Kluizelaar (2+)', 'Simone de Jong Company: Kluizelaar (2+)'],
    ['PERNILLE HAALAND (Engelstalig)', 'Pernille Haalland'],
    ['Krulmuziek: Kerstconcert (0+/2+)', 'Kerstconcert (0+/2+)'],
  ])('%s ≈ %s', (a, b) => expect(isDuplicate(act(a), act(b))).toBe(true));
  it('verschillende voorstellingen in dezelfde reeks niet', () => {
    expect(isDuplicate(act('Cinekid: MediaLab'), act('Cinekid: Stitch Head (8+)'))).toBe(false);
  });
  it('andere begintijd niet', () => {
    expect(isDuplicate(act('Kluizelaar (2+)'), act('Simone de Jong Company: Kluizelaar (2+)', '2026-11-04T11:30'))).toBe(false);
  });
});
