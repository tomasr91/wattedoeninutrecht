import { describe, expect, it } from 'vitest';
import { distanceFromHome } from '../src/domain/geo';

describe('afstand vanaf ingevuld adres', () => {
  const venue = { name: 'X', lat: 52.0907, lon: 5.1214, geoPrecision: 'exact' as const };
  it('zonder adres geen afstand', () => {
    expect(distanceFromHome(venue, undefined)).toBeUndefined();
  });
  it('met adres de afstand hemelsbreed', () => {
    expect(distanceFromHome(venue, { label: 'Thuis', lat: 52.0907, lon: 5.0214 })).toBeCloseTo(6.8, 0);
  });
});
