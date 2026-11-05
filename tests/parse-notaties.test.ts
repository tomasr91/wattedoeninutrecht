import { describe, expect, it } from 'vitest';
import { parseAgeLabel } from '../src/domain/enrich';
import { pricesIn, priceTextFrom } from '../collector/lib/parse';

describe('leeftijden en prijzen in nieuwe notaties', () => {
  it('halve jaren en maanden', () => {
    expect(parseAgeLabel('Tuimelaar (0,5+)')).toEqual({ officialMinMonths: 6, label: '0,5+' });
    expect(parseAgeLabel('Cadeautje (1,5+)')?.officialMinMonths).toBe(18);
    expect(parseAgeLabel('Tuimelaar (6-18 mnd)')).toEqual({ officialMinMonths: 6, officialMaxMonths: 18, label: '6-18 mnd' });
  });
  it('bedragen met ,- en zonder spatie', () => {
    expect(pricesIn('€ 16,- en €9 / € 12,50')).toEqual([16, 9, 12.5]);
    expect(priceTextFrom('Vrije inloop')).toBe('Gratis');
  });
});
