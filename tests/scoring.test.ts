import { describe, expect, it } from 'vitest';
import { diversify, scoreActivity } from '../src/domain/scoring';
import { makePeriod } from '../src/domain/filters';
import { classifyZone, DEFAULT_HOME } from '../src/domain/geo';
import { testActivity, testProfile, TEST_TODAY } from './fixtures';

const ctx = { today: TEST_TODAY, period: makePeriod('komende-maand', TEST_TODAY) };
const LR = { name: 'Bibliotheek Leidsche Rijn Centrum', locality: 'Leidsche Rijn', lat: 52.0947, lon: 5.0597, geoPrecision: 'approx' as const };
const CENTRUM = { name: 'Stadsschouwburg Utrecht', locality: 'Binnenstad', lat: 52.0918, lon: 5.1252, geoPrecision: 'approx' as const };
const AMERSFOORT = { name: 'Ergens in Amersfoort', locality: 'Amersfoort', lat: 52.156, lon: 5.3878, geoPrecision: 'approx' as const };

const kidsEvent = (venue: typeof LR, extra = {}) =>
  testActivity({
    venue,
    zone: classifyZone(venue),
    start: '2026-10-28T10:30',
    age: { estimatedMinMonths: 24, estimatedMaxMonths: 72 },
    ...extra,
  });

describe('scoring', () => {
  it('leeftijdsgeschiktheid weegt mee: geschikt voor beide > alleen voor de oudste', () => {
    const p = testProfile();
    const both = scoreActivity(kidsEvent(LR), p, ctx).total;
    const oldestOnly = scoreActivity(kidsEvent(LR, { age: { officialMinMonths: 36, label: '3+' } }), p, ctx).total;
    expect(both).toBeGreaterThan(oldestOnly);
  });

  it('onbekende prijs sluit niet uit, maar kost een klein beetje', () => {
    const p = testProfile();
    const known = scoreActivity(kidsEvent(LR), p, ctx).total;
    const unknown = scoreActivity(kidsEvent(LR, { price: { kind: 'onbekend' } }), p, ctx).total;
    expect(unknown).toBeLessThan(known);
    expect(known - unknown).toBeLessThan(3);
  });

  it('avondactiviteiten scoren lager voor het gezin', () => {
    const p = testProfile();
    const morning = scoreActivity(kidsEvent(LR), p, ctx).total;
    const evening = scoreActivity(kidsEvent(LR, { start: '2026-10-28T19:30' }), p, ctx).total;
    expect(morning).toBeGreaterThan(evening);
  });
});

describe('variatie in aanbevelingen', () => {
  it('kiest niet vijf keer dezelfde reeks', () => {
    const p = testProfile();
    const series = Array.from({ length: 5 }, (_, i) =>
      kidsEvent(LR, { seriesKey: 'voorlezen-lr', start: `2026-10-${28 + (i % 3)}T10:30` }),
    );
    const other = kidsEvent(CENTRUM, { seriesKey: 'theater-x', categories: ['theater'] });
    const items = [...series, other].map((a) => ({ activity: a, score: scoreActivity(a, p, ctx) }));
    const picked = diversify(items, 3);
    expect(picked.map((x) => x.activity.seriesKey)).toContain('theater-x');
    expect(picked.filter((x) => x.activity.seriesKey === 'voorlezen-lr').length).toBeLessThanOrEqual(2);
  });
});
