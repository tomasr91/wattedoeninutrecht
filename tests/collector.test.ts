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
import { branchesIn, parseCard } from '../collector/adapters/bibliotheek-utrecht';
import { extractEventLinks, parseEventPage } from '../collector/adapters/uitagenda-utrecht';
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

describe('Bibliotheek Utrecht (OP-shop) — synthetische kaart', () => {
  const link = { id: '99999', slug: 'testvoorlezen', series: false, date: '2026-10-28', url: 'https://bibliotheekutrecht.op-shop.nl/99999/testvoorlezen/28-10-2026' };
  it('herkent precies één vestiging', () => {
    expect(branchesIn('Bibliotheek Vleuterweide')).toEqual(['Vleuterweide']);
    expect(branchesIn('Bibliotheek Vleuten en Bibliotheek De Meern')).toEqual(['Vleuten', 'De Meern']);
  });
  it('leest datum, tijd, vestiging, prijs en reservering', () => {
    const ev = parseCard('wo 28 okt 2026 10:30 - 11:00 Bibliotheek Leidsche Rijn Centrum Jeugd Gratis, wel reserveren', link, '[TESTDATA] Voorlezen (2-4 jaar)', NOW);
    expect(ev).toMatchObject({
      start: '2026-10-28T10:30',
      end: '2026-10-28T11:00',
      venueName: 'Bibliotheek Leidsche Rijn Centrum',
      priceText: 'Gratis, wel reserveren',
      bookingText: 'wel reserveren',
      hints: ['Jeugd'],
      sourceEventId: '99999/2026-10-28',
    });
  });
  it('kaart met meerdere vestigingen wordt niet geraden', () => {
    expect(parseCard('10:30 Bibliotheek Vleuten Bibliotheek Neude', link, 'x', NOW)).toBeUndefined();
  });
});

describe('UITagenda Utrecht — synthetische pagina', () => {
  const list = `<main><a href="/evenement/90001/test-a">A</a><a href="https://www.uitagendautrecht.nl/evenement/90002/test-b?x=1">B</a><a href="/evenement/90001/test-a">A</a></main>`;
  it('verzamelt unieke evenementlinks', () => {
    const links = extractEventLinks(list);
    expect([...links.keys()]).toEqual(['90001', '90002']);
    expect(links.get('90002')).toBe('https://www.uitagendautrecht.nl/evenement/90002/test-b');
  });

  const detail = `<html><head><meta name="description" content="Fictieve testomschrijving"></head><body><main>
    <h1>[TESTDATA] Lampionnenoptocht</h1>
    <a href="/locatie/testplein/">Testplein</a>
    <p>Datum za 7 nov Tijd 18:00 - 21:00</p><p>Entree gratis</p>
    <div class="post-genres"><span class="genre-label">Gezinnen</span></div>
    <div class="post-tags-list"><a class="tag-label">#kinderen</a> <a class="tag-label">#0 10</a></div>
    <div class="related"><span class="genre-label">Jeugdtheater</span> <a class="tag-label">#4+</a></div>
    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;text=x&amp;dates=20261107T180000/20261107T210000&amp;location=Utrecht">Google</a>
    <a href="https://example.invalid/info">Info &amp; tickets</a>
  </main></body></html>`;
  it('leest titel, tijden, locatie, prijs en doelgroeplabels', () => {
    const ev = parseEventPage(detail, 'https://www.uitagendautrecht.nl/evenement/90003/x', '90003', { today: TODAY, nowIso: NOW });
    expect(ev).toMatchObject({
      title: '[TESTDATA] Lampionnenoptocht',
      start: '2026-11-07T18:00',
      end: '2026-11-07T21:00',
      venueName: 'Testplein',
      priceText: 'gratis',
      estimatedMinMonths: 0,
      estimatedMaxMonths: 120,
      bookingUrl: 'https://example.invalid/info',
    });
    expect(ev?.hints).toContain('Gezinnen');
    expect(ev?.hints).not.toContain('Jeugdtheater');
  });
  it('gebruikt geen knoptekst als "Bekijk locatie" als locatienaam', () => {
    const knop = detail
      .replace('<a href="/locatie/testplein/">Testplein</a>', '<a href="/locatie/123/stadsschouwburg-utrecht">Bekijk locatie</a>')
      .replace('location=Utrecht', 'location=Testzaal%2C%20Lucasbolwerk%2024%2C%203512%20EH%20Utrecht');
    const ev = parseEventPage(knop, 'u', '2', { today: TODAY, nowIso: NOW });
    expect(ev?.venueName).toBe('Testzaal');
    expect(ev?.address).toBe('Testzaal, Lucasbolwerk 24, 3512 EH Utrecht');
    const zonderAgenda = knop.replace(/<a href="https:\/\/calendar[^>]+>Google<\/a>/, '');
    expect(parseEventPage(zonderAgenda, 'u', '3', { today: TODAY, nowIso: NOW })?.venueName).toBe('Stadsschouwburg utrecht');
  });
  it('valt terug op paginatekst zonder agendalink', () => {
    const noCal = detail.replace(/<a href="https:\/\/calendar[^>]+>Google<\/a>/, '');
    const ev = parseEventPage(noCal, 'u', '1', { today: TODAY, nowIso: NOW });
    expect(ev?.start).toBe('2026-11-07T18:00');
    expect(ev?.extraUncertainties?.[0]).toMatch(/paginatekst/);
  });

  it('leest plek, adres, genre, leeftijd en duur uit de praktische informatie', () => {
    const rich = `<html><body><main>
      <div class="post-genres"><a href="https://www.uitagendautrecht.nl/genre/musea/" class="genre-label">Musea &amp; exposities</a> <span class="genre-label">Kinderen</span></div>
      <h1 class="post-title">[TESTDATA] Speurtocht in het testkasteel</h1>
      <div class="post-content"><p><strong>Duur</strong>: ± 40–55 minuten<br /><strong>Leeftijd</strong>: vanaf 6 jaar<br /><strong>Kosten</strong>: € 5,-</p></div>
      <address class="post-location"><span>Testkasteel<br />Testlaan 1<br/>1234 AB Testdorp <a class="more-btn" href="/locatie/1/x">Bekijk locatie</a></span></address>
      <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;dates=20261107T110000/20261107T160000">Google</a>
    </main></body></html>`;
    const ev = parseEventPage(rich, 'u', '2', { today: TODAY, nowIso: NOW });
    expect(ev).toMatchObject({
      venueName: 'Testkasteel',
      address: 'Testlaan 1, 1234 AB Testdorp',
      locality: 'Testdorp',
      kind: 'Expositie',
      durationMinutes: 40,
      officialMinMonths: 72,
      priceText: '€ 5,-',
    });
    expect(ev?.hints).toContain('Musea & exposities');
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

describe('Utrecht Natuurlijk: bereik met ― (U+2015)', () => {
  it('leest de einddatum en geeft een stabiele ID', async () => {
    const { parseUnList, unCardToRaw } = await import('../collector/adapters/utrecht-natuurlijk');
    const html = `<article class="activity-card"><h2>[TESTDATA] Herfstvakantie</h2><p class="font-bold">donderdag 22 oktober 2026 &#8213; zondag 25 oktober 2026</p><div>Eilandsteede</div><a href="https://www.utrechtnatuurlijk.nl/activiteit/herfst-test/?date=2026-10-22">x</a></article>`;
    const [c] = parseUnList(html, '2026-10-22');
    expect([c.date, c.end]).toEqual(['2026-10-22', '2026-10-25']);
    expect(unCardToRaw(c, '2026-10-22T00:00:00Z').sourceEventId).toBe('herfst-test|tm-2026-10-25');
  });
});

import { detailStillFresh } from '../collector/adapters/uitagenda-utrecht';
describe('Utrecht Natuurlijk: doelgroep', () => {
  it('"Alle leeftijden" alleen is voor volwassenen, niet voor kinderen', async () => {
    const { unAudiences } = await import('../collector/adapters/utrecht-natuurlijk');
    expect(unAudiences(['Alle leeftijden'])).toEqual(['volwassenen']);
    expect(unAudiences(['Alle leeftijden', 'Gezinnen']).sort()).toEqual(['gezin', 'volwassenen']);
    expect(unAudiences(['Peuters'])).toEqual(['kinderen']);
  });
});

describe('UITagenda detailopslag', () => {
  const ev = { sourceId: 'x', sourceName: 'x', url: 'u', title: '[TESTDATA] X', start: '2026-11-01', checkedAt: '' };
  it('vers binnen 5 dagen', () => {
    expect(detailStillFresh({ fetchedAt: '2026-10-20T03:00:00Z', value: ev }, '123', '2026-10-22')).toBe(true);
  });
  it('na 9 dagen altijd opnieuw', () => {
    expect(detailStillFresh({ fetchedAt: '2026-10-10T03:00:00Z', value: ev }, '123', '2026-10-22')).toBe(false);
  });
  it('doorlopende reeks waarvan de eerstvolgende keer voorbij is: opnieuw', () => {
    expect(detailStillFresh({ fetchedAt: '2026-10-21T03:00:00Z', value: { ...ev, start: '2026-10-21', rolling: true } }, '123', '2026-10-22')).toBe(false);
  });
});

describe('UITagenda muziek-subgenre', () => {
  const page = (labels: string) => `<html><body><main>
    <div class="post-genres">${labels}</div>
    <h1 class="post-title">[TESTDATA] Concertje</h1>
    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&amp;dates=20261107T200000/20261107T220000">Google</a>
  </main></body></html>`;
  it('Muziek + Jazz → Concert · Jazz', () => {
    const ev = parseEventPage(page('<a href="https://www.uitagendautrecht.nl/genre/muziek/" class="genre-label">Muziek</a><a href="https://www.uitagendautrecht.nl/genre/jazz/" class="genre-label">Jazz</a><span class="genre-label">Regulier / volwassenen</span>'), 'u', '1', { today: TODAY, nowIso: NOW });
    expect(ev?.kind).toBe('Concert · Jazz');
  });
  it('Muziek zonder subgenre → Concert', () => {
    const ev = parseEventPage(page('<a href="https://www.uitagendautrecht.nl/genre/muziek/" class="genre-label">Muziek</a><span class="genre-label">€€ (tot 30,-)</span>'), 'u', '2', { today: TODAY, nowIso: NOW });
    expect(ev?.kind).toBe('Concert');
  });
});

describe('UITagenda: eigen datum bovenaan gaat voor', () => {
  const page = (dates: string, tijd: string) => `<html><body><main>
    <h1>[TESTDATA] Prikkel workshopreeks</h1>
    <p>Diversen Workshops ${dates} [TESTDATA] Prikkel workshopreeks</p>
    <p>Tijd ${tijd} Voeg toe aan je agenda</p>
    <div class="related"><p>Ook leuk: di 2 jun t/m wo 11 nov Iets anders 10:00</p></div>
  </main></body></html>`;
  it('periode uit de kop, tijd uit het veld Tijd', () => {
    const ev = parseEventPage(page('maandag 2 november 2026 - maandag 30 november 2026', 'ma: 19:30 - 21:00'), 'u', '1', { today: TODAY, nowIso: NOW });
    expect(ev?.start).toBe('2026-11-02T19:30');
    expect(ev?.end).toBe('2026-11-30');
  });
  it('losse dag met tijd', () => {
    const ev = parseEventPage(page('vrijdag 23 oktober 2026', '20:00 - 22:00'), 'u', '2', { today: TODAY, nowIso: NOW });
    expect(ev?.start).toBe('2026-10-23T20:00');
    expect(ev?.end).toBe('2026-10-23T22:00');
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
