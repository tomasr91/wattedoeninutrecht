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
  it('geeft een score tussen 0 en 100 met uitleg', () => {
    const s = scoreActivity(kidsEvent(LR), testProfile(), ctx);
    expect(s.total).toBeGreaterThan(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s.reasons).toContain('Goed passend voor beide kinderen');
    expect(s.reasons).toContain('Dichtbij in Leidsche Rijn');
  });

  it('leeftijdsgeschiktheid weegt mee: geschikt voor beide > alleen voor de oudste', () => {
    const p = testProfile();
    const both = scoreActivity(kidsEvent(LR), p, ctx).total;
    const oldestOnly = scoreActivity(kidsEvent(LR, { age: { officialMinMonths: 36, label: '3+' } }), p, ctx).total;
    expect(both).toBeGreaterThan(oldestOnly);
  });

  it('gewichten zijn configureerbaar', () => {
    const p = testProfile();
    const near = kidsEvent(LR);
    const far = kidsEvent(AMERSFOORT);
    const def = scoreActivity(near, p, ctx).total - scoreActivity(far, p, ctx).total;
    p.weights = { ...p.weights, distance: 0 };
    const noDist = scoreActivity(near, p, ctx).total - scoreActivity(far, p, ctx).total;
    expect(def).toBeGreaterThan(noDist);
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

describe('geografische prioritering', () => {
  it('kinderactiviteit in Leidsche Rijn scoort hoger dan dezelfde activiteit in de binnenstad', () => {
    const p = testProfile();
    expect(scoreActivity(kidsEvent(LR), p, ctx).total).toBeGreaterThan(scoreActivity(kidsEvent(CENTRUM), p, ctx).total);
  });

  it('de voorkeur voor Leidsche Rijn is instelbaar', () => {
    const p = testProfile();
    const gap = () => scoreActivity(kidsEvent(LR), p, ctx).total - scoreActivity(kidsEvent(CENTRUM), p, ctx).total;
    p.leidscheRijnPreference = 2;
    const strong = gap();
    p.leidscheRijnPreference = 0;
    const none = gap();
    expect(strong).toBeGreaterThan(none);
  });

  it('een bijzonder evenement elders kan een doorsnee activiteit dichtbij overtreffen', () => {
    const p = testProfile();
    const ordinaryNear = kidsEvent(LR, { price: { kind: 'onbekend' }, confidence: 'middel', categories: ['overig'] });
    const specialCity = kidsEvent(CENTRUM, { special: true, categories: ['feest', 'festival'], audiences: ['gezin'] });
    expect(scoreActivity(specialCity, p, ctx).total).toBeGreaterThan(scoreActivity(ordinaryNear, p, ctx).total);
  });

  it('volwassenenactiviteiten in de binnenstad worden niet hard afgestraft', () => {
    const p = testProfile();
    const adultCity = testActivity({ audiences: ['volwassenen'], categories: ['muziek'], venue: CENTRUM, zone: 'utrecht', start: '2026-10-28T20:00' });
    const s = scoreActivity(adultCity, p, ctx);
    expect(s.lens).toBe('volwassenen');
    expect(s.components.distance).toBeGreaterThan(0.7);
  });

  it('zone-indeling', () => {
    expect(classifyZone(LR)).toBe('leidsche-rijn');
    expect(classifyZone({ name: 'Podium Hoge Woerd', address: 'Hoge Woerdplein 1, 3454 PB Utrecht', geoPrecision: 'unknown' })).toBe('leidsche-rijn');
    expect(classifyZone(CENTRUM)).toBe('utrecht');
    expect(classifyZone(AMERSFOORT)).toBe('omgeving');
    expect(classifyZone({ name: 'Kasteel de Haar', locality: 'Haarzuilens', geoPrecision: 'unknown' })).toBe('leidsche-rijn');
    expect(classifyZone({ name: 'X', lat: 52.03, lon: 5.17, geoPrecision: 'approx' }, DEFAULT_HOME)).toBe('omgeving');
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

describe('zone bij expliciete plaats buiten Utrecht', () => {
  it('Bunnik is omgeving, ook al ligt het dicht bij de stad', () => {
    expect(classifyZone({ name: 'Waterliniemuseum Fort bij Vechten', locality: 'Bunnik', lat: 52.059, lon: 5.1685, geoPrecision: 'approx' })).toBe('omgeving');
  });
});
