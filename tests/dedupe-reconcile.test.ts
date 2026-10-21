import { describe, expect, it } from 'vitest';
import { dedupe, isDuplicate, stableHash } from '../src/domain/dedupe';
import { contentHashOf, MISSING_THRESHOLD, reconcile, sourceKey, type StoredActivity } from '../src/domain/reconcile';
import type { Activity } from '../src/domain/types';
import { testActivity } from './fixtures';

const src = (sourceId: string, sourceEventId: string, url = `https://example.invalid/${sourceId}/${sourceEventId}`) => ({
  sourceId,
  sourceName: sourceId,
  sourceEventId,
  url,
  firstSeen: '2026-10-12T05:00:00Z',
  lastChecked: '2026-10-12T05:00:00Z',
});

describe('deduplicatie', () => {
  const venue = { name: 'Podium Hoge Woerd', locality: 'De Meern', lat: 52.0837, lon: 5.0398, geoPrecision: 'approx' as const };
  const fromVenue = testActivity({
    title: '[TESTDATA] Alle kinderen stinken (6+)',
    start: '2026-10-21T15:00',
    venue,
    price: { kind: 'onbekend' },
    sources: [src('podium-hoge-woerd', 'alle-kinderen-stinken')],
  });
  const fromAgenda = testActivity({
    title: '[TESTDATA] Patrick Duijtshoff en Judith van den Berg: Alle kinderen stinken (6+)',
    start: '2026-10-21T15:00',
    venue: { ...venue, name: 'Podium Hoge Woerd, De Meern' },
    price: { kind: 'betaald', text: '€ 12,50', minEur: 12.5, maxEur: 12.5 },
    sources: [src('uitagenda-utrecht', '147225')],
  });

  it('herkent hetzelfde evenement bij verschillende bronnen', () => {
    expect(isDuplicate(fromVenue, fromAgenda)).toBe(true);
  });

  it('voegt samen en bewaart beide bronverwijzingen', () => {
    const { activities, merged } = dedupe([fromVenue, fromAgenda]);
    expect(merged).toBe(1);
    expect(activities).toHaveLength(1);
    expect(activities[0].sources.map((s) => s.sourceId).sort()).toEqual(['podium-hoge-woerd', 'uitagenda-utrecht']);
    expect(activities[0].price.kind).toBe('betaald'); // ontbrekende prijs aangevuld uit de andere bron
  });

  it('andere begintijd = andere voorstelling', () => {
    const later = { ...fromAgenda, id: 'x', start: '2026-10-21T17:00', sources: [src('uitagenda-utrecht', '999')] };
    expect(isDuplicate(fromVenue, later)).toBe(false);
  });

  it('zelfde titel, andere locatie = apart evenement (voorlezen in meerdere bibliotheken)', () => {
    const a = testActivity({
      title: '[TESTDATA] Voorlezen (2-4 jaar)',
      venue: { name: 'Bibliotheek Vleuten', lat: 52.1076, lon: 5.0136, geoPrecision: 'approx' },
      sources: [src('bieb', '1')],
    });
    const b = testActivity({
      title: '[TESTDATA] Voorlezen (2-4 jaar)',
      venue: { name: 'Bibliotheek Leidsche Rijn Centrum', lat: 52.0947, lon: 5.0597, geoPrecision: 'approx' },
      sources: [src('bieb', '2')],
    });
    expect(isDuplicate(a, b)).toBe(false);
  });

  it('zelfde bron-ID is altijd hetzelfde', () => {
    const a = testActivity({ sources: [src('x', '42')] });
    const b = testActivity({ title: 'iets heel anders', start: '2026-12-01T09:00', sources: [src('x', '42')] });
    expect(isDuplicate(a, b)).toBe(true);
  });

  it('stabiele hash', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
  });
});

const store = (a: Activity): StoredActivity => ({ ...a, contentHash: contentHashOf(a), missingCount: 0 });
const NOW = '2026-10-26T05:00:00Z';
const TODAY = '2026-10-26';
const coverage = { from: '2026-10-26', to: '2027-01-26' };

describe('wekelijkse update (reconcile)', () => {
  it('voegt nieuwe activiteiten toe', () => {
    const a = testActivity({ start: '2026-11-04T10:30', sources: [src('bieb', 'n1')] });
    const r = reconcile([], [{ sourceId: 'bieb', ok: true, coverage, activities: [a] }], NOW, TODAY);
    expect(r.stats.added).toBe(1);
    expect(r.activities[0].sources[0].firstSeen).toBe(NOW);
  });

  it('werkt gewijzigde activiteiten bij en houdt de ID stabiel', () => {
    const old = store(testActivity({ id: 'stabiel', start: '2026-11-04T10:30', sources: [src('bieb', 'n1')] }));
    const changed = testActivity({ id: 'nieuw-id', start: '2026-11-04T11:00', sources: [src('bieb', 'n1')] });
    const r = reconcile([old], [{ sourceId: 'bieb', ok: true, coverage, activities: [changed] }], NOW, TODAY);
    expect(r.stats.updated).toBe(1);
    expect(r.activities[0].id).toBe('stabiel');
    expect(r.activities[0].start).toBe('2026-11-04T11:00');
    expect(r.activities[0].lastChecked).toBe(NOW);
    expect(r.activities[0].sources[0].firstSeen).toBe('2026-10-12T05:00:00Z');
  });

  it('ongewijzigd telt niet als update, maar ververst de controledatum', () => {
    const a = testActivity({ start: '2026-11-04T10:30', sources: [src('bieb', 'n1')] });
    const r = reconcile([store(a)], [{ sourceId: 'bieb', ok: true, coverage, activities: [a] }], NOW, TODAY);
    expect(r.stats).toMatchObject({ updated: 0, unchanged: 1 });
    expect(r.activities[0].lastChecked).toBe(NOW);
  });

  it('markeert verlopen activiteiten', () => {
    const past = store(testActivity({ start: '2026-10-20T10:30', sources: [src('bieb', 'p1')] }));
    const r = reconcile([past], [{ sourceId: 'bieb', ok: true, coverage, activities: [] }], NOW, TODAY);
    expect(r.activities[0].status).toBe('verlopen');
    expect(r.stats.expired).toBe(1);
  });

  it('doorlopende activiteit is pas verlopen na de einddatum', () => {
    const expo = store(testActivity({ start: '2026-10-07', end: '2027-01-03', allDay: true, sources: [src('agenda', 'e1')] }));
    const r = reconcile([expo], [{ sourceId: 'other', ok: true, coverage, activities: [] }], NOW, TODAY);
    expect(r.activities[0].status).toBe('gepland');
  });

  it('neemt een expliciete annulering van de bron over', () => {
    const a = testActivity({ start: '2026-10-31T20:00', sources: [src('podium', 'c1')] });
    const cancelled = { ...a, status: 'geannuleerd' as const };
    const r = reconcile([store(a)], [{ sourceId: 'podium', ok: true, coverage, activities: [cancelled] }], NOW, TODAY);
    expect(r.activities[0].status).toBe('geannuleerd');
    expect(r.stats.cancelled).toBe(1);
  });

  it('verdwenen bij de bron: eerst waarschuwing, daarna vermoedelijk geannuleerd', () => {
    let items = [store(testActivity({ start: '2026-11-20T10:30', sources: [src('bieb', 'gone')] }))];
    let r = reconcile(items, [{ sourceId: 'bieb', ok: true, coverage, activities: [] }], NOW, TODAY);
    expect(r.activities[0].status).toBe('gepland');
    expect(r.activities[0].uncertainties.join(' ')).toMatch(/Niet meer vermeld/);
    expect(r.activities[0].confidence).toBe('middel');
    for (let i = 1; i < MISSING_THRESHOLD; i++) {
      items = r.activities;
      r = reconcile(items, [{ sourceId: 'bieb', ok: true, coverage, activities: [] }], NOW, TODAY);
    }
    expect(r.activities[0].status).toBe('geannuleerd');
  });

  it('buiten het opgehaalde venster niet als verdwenen markeren', () => {
    const far = store(testActivity({ start: '2027-03-01T10:30', sources: [src('bieb', 'far')] }));
    const r = reconcile([far], [{ sourceId: 'bieb', ok: true, coverage, activities: [] }], NOW, TODAY);
    expect(r.activities[0].missingCount).toBe(0);
    expect(r.activities[0].uncertainties).toEqual([]);
  });
});

describe('foutafhandeling bij uitgevallen bronnen', () => {
  it('behoudt eerder verzamelde data met de oude controledatum', () => {
    const a = store(testActivity({ start: '2026-11-04T10:30', sources: [src('bieb', 'keep')] }));
    const r = reconcile([a], [{ sourceId: 'bieb', ok: false, error: 'HTTP 503', activities: [] }], NOW, TODAY);
    expect(r.activities).toHaveLength(1);
    expect(r.activities[0].status).toBe('gepland');
    expect(r.activities[0].lastChecked).toBe('2026-10-19T06:00:00Z');
    expect(r.activities[0].missingCount).toBe(0);
  });

  it('een kapotte bron beïnvloedt een andere bron niet', () => {
    const fromA = store(testActivity({ start: '2026-11-04T10:30', sources: [src('a', '1')] }));
    const newB = testActivity({ start: '2026-11-05T10:30', sources: [src('b', '1')] });
    const r = reconcile(
      [fromA],
      [
        { sourceId: 'a', ok: false, error: 'timeout', activities: [] },
        { sourceId: 'b', ok: true, coverage, activities: [newB] },
      ],
      NOW,
      TODAY,
    );
    expect(r.activities.map(sourceKey).sort()).toEqual(['a::1', 'b::1']);
    expect(r.stats.added).toBe(1);
  });
});

describe('handmatig gecontroleerde bron', () => {
  it('behoudt de oorspronkelijke controledatum', () => {
    const a = testActivity({ start: '2026-11-07T18:00', lastChecked: '2026-10-21T09:00:00Z', sources: [src('handmatig', 'sm')] });
    a.sources[0].lastChecked = '2026-10-21T09:00:00Z';
    const r = reconcile([], [{ sourceId: 'handmatig', ok: true, keepCheckedDates: true, activities: [a] }], NOW, TODAY);
    expect(r.activities[0].lastChecked).toBe('2026-10-21T09:00:00Z');
    expect(r.activities[0].sources[0].lastChecked).toBe('2026-10-21T09:00:00Z');
  });
});
