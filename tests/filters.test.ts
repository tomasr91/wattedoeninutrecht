import { describe, expect, it } from 'vitest';
import { applyFilters, EMPTY_FILTERS, makePeriod, overlapsPeriod, type Filters } from '../src/domain/filters';
import { DEFAULT_HOME } from '../src/domain/geo';
import { testActivity, testProfile, TEST_TODAY } from './fixtures';

const ctx = (preset: Parameters<typeof makePeriod>[0] = 'komende-maand', opts = {}) => ({
  today: TEST_TODAY,
  period: makePeriod(preset, TEST_TODAY, opts),
  children: testProfile().children,
  home: DEFAULT_HOME,
  savedIds: new Set<string>(),
});

// Testdata wordt in de app altijd verborgen; voor filtertests zetten we de vlag uit.
const real = (o: Parameters<typeof testActivity>[0] = {}) => testActivity({ isTestData: false, ...o });

describe('periodes', () => {
  it('deze week loopt van vandaag t/m zondag', () => {
    expect(makePeriod('deze-week', '2026-10-21')).toMatchObject({ from: '2026-10-21', to: '2026-10-25' });
  });
  it('komende maand is een maand vanaf vandaag', () => {
    expect(makePeriod('komende-maand', '2026-10-21')).toMatchObject({ from: '2026-10-21', to: '2026-11-20' });
  });
  it('drie maanden', () => {
    expect(makePeriod('drie-maanden', '2026-10-21')).toMatchObject({ to: '2027-01-20' });
  });
  it('specifieke week = maandag t/m zondag van die week', () => {
    expect(makePeriod('week', '2026-10-21', { anchor: '2026-11-11' })).toMatchObject({ from: '2026-11-09', to: '2026-11-15' });
  });
  it('lopende week begint niet in het verleden', () => {
    expect(makePeriod('week', '2026-10-21', { anchor: '2026-10-21' }).from).toBe('2026-10-21');
  });
  it('zelfgekozen bereik', () => {
    expect(makePeriod('bereik', TEST_TODAY, { anchor: '2026-12-01', to: '2026-12-31' })).toMatchObject({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });
  it('meerdaagse activiteiten overlappen met de periode', () => {
    const expo = real({ start: '2026-10-07', end: '2027-01-03', allDay: true });
    expect(overlapsPeriod(expo, { from: '2026-12-20', to: '2026-12-27' })).toBe(true);
    expect(overlapsPeriod(expo, { from: '2027-01-04', to: '2027-01-10' })).toBe(false);
  });
});

describe('periodefilter', () => {
  const nov = real({ start: '2026-11-10T10:00' });
  const dec = real({ start: '2026-12-13T15:00' });
  const past = real({ start: '2026-10-20T10:00' });

  it('komende maand bevat november maar niet december', () => {
    const r = applyFilters([nov, dec, past], EMPTY_FILTERS, ctx('komende-maand'));
    expect(r.map((a) => a.id)).toEqual([nov.id]);
  });
  it('drie maanden bevat ook december', () => {
    const r = applyFilters([nov, dec, past], EMPTY_FILTERS, ctx('drie-maanden'));
    expect(r.map((a) => a.id)).toEqual([nov.id, dec.id]);
  });
  it('verbergt testdata altijd', () => {
    const t = testActivity({ start: '2026-11-10T10:00' });
    expect(applyFilters([t], EMPTY_FILTERS, ctx())).toEqual([]);
  });
});

describe('combinaties van filters', () => {
  const freeIndoorLR = real({ title: 'Voorlezen', age: { estimatedMinMonths: 24, estimatedMaxMonths: 72 }, price: { kind: 'gratis' }, indoor: 'binnen', zone: 'leidsche-rijn', start: '2026-10-24T10:30' });
  const paidCity = real({
    title: 'Voorstelling',
    price: { kind: 'betaald', minEur: 10 },
    indoor: 'binnen',
    zone: 'utrecht',
    categories: ['theater'],
    age: { officialMinMonths: 48 },
    start: '2026-10-28T15:00',
    venue: { name: 'Stadsschouwburg', lat: 52.0918, lon: 5.1252, geoPrecision: 'approx' },
  });
  const outdoorFree = real({ title: 'Parade', age: { estimatedMinMonths: 0 }, indoor: 'buiten', zone: 'utrecht', categories: ['feest'], audiences: ['gezin'], start: '2026-11-07T18:00' });
  const adults = real({ title: 'Lezing', zone: 'utrecht', price: { kind: 'betaald', minEur: 5 }, audiences: ['volwassenen'], categories: ['lezing'], start: '2026-10-26T20:00' });
  const all = [freeIndoorLR, paidCity, outdoorFree, adults];
  const f = (o: Partial<Filters>) => applyFilters(all, { ...EMPTY_FILTERS, ...o }, ctx()).map((a) => a.title);

  it('gratis + binnen', () => {
    expect(f({ price: ['gratis'], indoor: ['binnen'] })).toEqual(['Voorlezen']);
  });
  it('Leidsche Rijn of rest van Utrecht', () => {
    expect(f({ zones: ['utrecht'] })).toEqual(['Voorstelling', 'Parade', 'Lezing']);
  });
  it('voor volwassenen', () => {
    expect(f({ forWhom: ['volwassenen'] })).toEqual(['Parade', 'Lezing']);
  });
  it('geschikt voor beide kinderen sluit 4+ en volwassenen uit', () => {
    expect(f({ child: 'beide' })).toEqual(['Voorlezen', 'Parade']);
  });
  it('weekend + gratis', () => {
    expect(f({ when: ['weekend'], price: ['gratis'] })).toEqual(['Voorlezen', 'Parade']);
  });
  it('avond', () => {
    expect(f({ dayParts: ['avond'] })).toEqual(['Parade', 'Lezing']);
  });
  it('maximale afstand laat items zonder coördinaten staan', () => {
    const noGeo = real({ title: 'Onbekende plek', venue: { name: '?', geoPrecision: 'unknown' }, start: '2026-10-30T10:00' });
    const r = applyFilters([...all, noGeo], { ...EMPTY_FILTERS, maxDistanceKm: 2 }, ctx()).map((a) => a.title);
    expect(r).toContain('Onbekende plek');
    expect(r).not.toContain('Voorstelling');
  });
  it('categorie + leeftijdscategorie', () => {
    expect(f({ categories: ['theater'], ageBands: ['4-6'] })).toEqual(['Voorstelling']);
    expect(f({ categories: ['theater'], ageBands: ['0-2'] })).toEqual([]);
  });
});
