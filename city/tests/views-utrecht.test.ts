/** Twee lijsten (Kinderen / Volwassenen), fietsafstand, dit weekend, doorlopend. Alles hier is ⚠️ TESTDATA. */
import { describe, expect, it } from 'vitest';
import { buildLists, DEFAULT_LIST_OPTIONS, isBikeDistance, isLongRunning, nextWeekend, thisWeekend, weekendWindow, type ListOptions } from '../../src/domain/views';
import { makePeriod } from '../../src/domain/filters';
import { testActivity, testProfile, TEST_TODAY } from '../../tests/fixtures';

const profile = testProfile();
const period = makePeriod('komende-maand', TEST_TODAY); // wo 21-10 t/m vr 20-11
const ctx = { today: TEST_TODAY, period, children: profile.children, home: profile.home };
// testActivity is standaard isTestData; buildLists slaat die over, dus hier uitzetten.
const act = (o: Parameters<typeof testActivity>[0]) => testActivity({ isTestData: false, categories: ['workshop'], age: { estimatedMinMonths: 0 }, ...o });
const opts = (o: Partial<ListOptions> = {}): ListOptions => ({ ...DEFAULT_LIST_OPTIONS, ...o });

describe('fietsafstand', () => {
  it('Leidsche Rijn en de stad Utrecht zijn altijd fietsafstand', () => {
    expect(isBikeDistance(act({ zone: 'utrecht', venue: { name: 'X', geoPrecision: 'unknown' } }))).toBe(true);
    expect(isBikeDistance(act({ zone: 'leidsche-rijn' }))).toBe(true);
  });
  it('buiten Utrecht: alleen binnen 8 km van Leidsche Rijn Centrum', () => {
    // Haarzuilens-achtig punt, ca. 5 km
    const dichtbij = act({ zone: 'omgeving', venue: { name: 'X', lat: 52.1214, lon: 4.9939, geoPrecision: 'approx' } });
    // Amersfoort, ca. 23 km
    const ver = act({ zone: 'omgeving', venue: { name: 'Y', lat: 52.156, lon: 5.387, geoPrecision: 'approx' } });
    const onbekend = act({ zone: 'omgeving', venue: { name: 'Z', geoPrecision: 'unknown' } });
    expect(isBikeDistance(dichtbij)).toBe(true);
    expect(isBikeDistance(ver)).toBe(false);
    expect(isBikeDistance(onbekend)).toBe(false);
  });
});

describe('zelfde sessie op meerdere locaties', () => {
  it('wordt één regel met de dichtstbijzijnde locatie voorop', () => {
    const ver = act({ title: '[TESTDATA] Knutselen', start: '2026-10-28T14:00', venue: { name: 'Bieb Overvecht', lat: 52.116, lon: 5.111, geoPrecision: 'approx' } });
    const dichtbij = act({ title: '[TESTDATA] Knutselen', start: '2026-10-28T14:00', venue: { name: 'Bieb Vleuterweide', lat: 52.1033, lon: 5.0208, geoPrecision: 'approx' } });
    const l = buildLists([ver, dichtbij], opts(), ctx);
    expect(l.total).toBe(1);
    expect(l.days[0].items[0].activity.venue.name).toBe('Bieb Vleuterweide');
    expect(l.days[0].items[0].others.map((o) => o.venue.name)).toEqual(['Bieb Overvecht']);
  });
});
