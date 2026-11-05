/**
 * Motortests voor het stadsprofiel. Ze lezen hun verwachtingen uit city/config.ts,
 * zodat ze voor elke stad gelden. Stad-specifieke gevallen staan in city/tests/.
 */
import { describe, expect, it } from 'vitest';
import { CITY } from '../city/config';
import { CITY_ZONE, classifyZone, DEFAULT_HOME, HOME_ZONE, OUTSIDE_ZONE, ZONE_LABEL } from '../src/domain/geo';
import { isBikeDistance } from '../src/domain/views';
import { scoreActivity } from '../src/domain/scoring';
import { makePeriod } from '../src/domain/filters';
import { testActivity, testProfile, TEST_TODAY } from './fixtures';

const homeVenue = { name: '[TESTDATA] Zaal', locality: CITY.home.localities[0], lat: CITY.home.lat, lon: CITY.home.lon, geoPrecision: 'approx' as const };
const cityVenue = { name: '[TESTDATA] Zaal', locality: CITY.city.localities[0], lat: CITY.center.lat, lon: CITY.center.lon, geoPrecision: 'approx' as const };
const farVenue = { name: '[TESTDATA] Zaal', locality: 'Een andere plaats', lat: CITY.center.lat + 0.5, lon: CITY.center.lon + 0.5, geoPrecision: 'approx' as const };

describe('stadsprofiel', () => {
  it('heeft drie verschillende zones en een label voor elk', () => {
    expect(new Set([HOME_ZONE, CITY_ZONE, OUTSIDE_ZONE]).size).toBe(3);
    for (const z of [HOME_ZONE, CITY_ZONE, OUTSIDE_ZONE]) expect(ZONE_LABEL[z]).toBeTruthy();
  });

  it('thuispunt komt uit het profiel', () => {
    expect(DEFAULT_HOME).toEqual({ label: CITY.home.label, lat: CITY.home.lat, lon: CITY.home.lon });
  });

  it('zone-indeling op plaatsnaam', () => {
    expect(classifyZone(homeVenue)).toBe(HOME_ZONE);
    expect(classifyZone(cityVenue)).toBe(CITY_ZONE);
    expect(classifyZone(farVenue)).toBe(OUTSIDE_ZONE);
  });

  it('zonder plaatsnaam: het thuispunt zelf is thuiswijk, ver weg is omgeving', () => {
    expect(classifyZone({ name: '[TESTDATA] X', lat: CITY.home.lat, lon: CITY.home.lon, geoPrecision: 'approx' })).toBe(HOME_ZONE);
    expect(classifyZone({ name: '[TESTDATA] Y', lat: farVenue.lat, lon: farVenue.lon, geoPrecision: 'approx' })).toBe(OUTSIDE_ZONE);
  });

  it('thuiswijk en stad zijn altijd fietsafstand, ver weg niet', () => {
    expect(isBikeDistance(testActivity({ zone: HOME_ZONE }))).toBe(true);
    expect(isBikeDistance(testActivity({ zone: CITY_ZONE }))).toBe(true);
    expect(isBikeDistance(testActivity({ zone: OUTSIDE_ZONE, venue: farVenue }))).toBe(false);
  });

  it('kinderactiviteit in de thuiswijk scoort hoger dan dezelfde ver weg, met de naam van de wijk als reden', () => {
    const ctx = { today: TEST_TODAY, period: makePeriod('komende-maand', TEST_TODAY) };
    const kids = (venue: typeof homeVenue) =>
      testActivity({ venue, zone: classifyZone(venue), start: '2026-10-28T10:30', age: { estimatedMinMonths: 24, estimatedMaxMonths: 72 } });
    const p = testProfile();
    const near = scoreActivity(kids(homeVenue), p, ctx);
    const far = scoreActivity(kids(farVenue), p, ctx);
    expect(near.total).toBeGreaterThan(far.total);
    expect(near.reasons).toContain(`Dichtbij in ${CITY.home.name}`);
  });
});
