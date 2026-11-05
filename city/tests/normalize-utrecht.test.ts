/**
 * Tests voor de verzamellaag. De HTML-fragmenten hieronder zijn SYNTHETISCH:
 * ze bootsen de structuur na die bij het bronnenonderzoek is waargenomen,
 * maar zijn geen kopie van de echte pagina's en bevatten fictieve gegevens.
 */
import { dedupeRepeated } from '../../collector/lib/parse';
import { describe, expect, it } from 'vitest';
import { inferYear, parseDutchDate, parseDutchDateRange, parseGoogleCalendarLink, parseTimes, extractJsonLdEvents } from '../../collector/lib/parse';
import { parseIcs } from '../../collector/lib/ics';
import { isAllowed, parseRobots } from '../../collector/lib/http';
import { normalize, type RawEvent } from '../../collector/normalize';
import { buildExport } from '../../collector/export';
import { testActivity } from '../../tests/fixtures';

const TODAY = '2026-10-21';
const NOW = '2026-10-21T07:00:00.000Z';

describe('normalisatie (Utrecht)', () => {
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
  it('verrijkt met locatie, zone, leeftijd en eigen samenvatting', () => {
    const a = normalize(raw);
    expect(a.zone).toBe('leidsche-rijn');
    expect(a.venue.geoPrecision).toBe('approx');
    expect(a.age).toMatchObject({ officialMinMonths: 24, officialMaxMonths: 48 });
    expect(a.price.kind).toBe('gratis');
    expect(a.booking.status).toBe('niet-nodig');
    expect(a.summary).toBeUndefined(); // geen automatische samenvatting meer
    expect(a.uncertainties).toEqual([]);
  });
});
