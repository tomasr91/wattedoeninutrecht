/** Twee lijsten (Kinderen / Volwassenen), fietsafstand, dit weekend, doorlopend. Alles hier is ⚠️ TESTDATA. */
import { describe, expect, it } from 'vitest';
import { buildLists, DEFAULT_LIST_OPTIONS, isBikeDistance, isLongRunning, nextWeekend, thisWeekend, weekendWindow, type ListOptions } from '../src/domain/views';
import { makePeriod } from '../src/domain/filters';
import { testActivity, testProfile, TEST_TODAY } from './fixtures';

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

describe('dit weekend', () => {
  it('op woensdag: de komende zaterdag en zondag', () => {
    expect(thisWeekend('2026-10-21')).toEqual({ from: '2026-10-24', to: '2026-10-25' });
  });
  it('op zaterdag: vandaag en morgen; op zondag: alleen vandaag', () => {
    expect(thisWeekend('2026-10-24')).toEqual({ from: '2026-10-24', to: '2026-10-25' });
    expect(thisWeekend('2026-10-25')).toEqual({ from: '2026-10-25', to: '2026-10-25' });
  });
  it('filtert op het weekend, ook buiten de gekozen periode niet', () => {
    const zat = act({ start: '2026-10-24T10:00' });
    const ma = act({ start: '2026-10-26T10:00' });
    const l = buildLists([zat, ma], opts({ weekend: 'dit' }), ctx);
    expect(l.days.flatMap((d) => d.items.map((i) => i.activity.id))).toEqual([zat.id]);
  });
});

describe('doorlopend versus agenda', () => {
  it('een festival van vier dagen blijft in de agenda', () => {
    expect(isLongRunning(act({ start: '2026-11-05', end: '2026-11-08', ongoing: true, categories: ['festival'] }))).toBe(false);
  });
  it('alleen de duur telt: korter dan zeven dagen agenda, zeven of meer doorlopend', () => {
    expect(isLongRunning(act({ start: '2026-11-01', end: '2026-11-06', ongoing: true, categories: ['expositie'] }))).toBe(false);
    expect(isLongRunning(act({ start: '2026-11-01', end: '2026-11-07', categories: ['feest'] }))).toBe(true);
    expect(isLongRunning(act({ start: '2026-10-17', end: '2026-10-25', ongoing: false, categories: ['natuur'] }))).toBe(true);
    expect(isLongRunning(act({ start: '2026-10-17', end: '2026-10-25', ongoing: true, categories: ['theater'] }))).toBe(true);
    expect(isLongRunning(act({ start: '2026-11-01', endUnknown: true, ongoing: true }))).toBe(true);
  });
  it('zonder einddatum wordt niet getoond', () => {
    const open = act({ start: '2026-10-01', end: '2027-01-21', endUnknown: true, ongoing: true });
    const vaag = act({ start: '2026-10-01', end: '2027-01-21', ongoing: true, uncertainties: ['Doorlopend; einddatum en seizoen niet vermeld'] });
    const expo = act({ start: '2026-10-01', end: '2026-12-31', ongoing: true, categories: ['expositie'] });
    expect(buildLists([open, vaag, expo], opts(), ctx).ongoing.map((i) => i.activity.id)).toEqual([expo.id]);
  });
  it('splitst de lijst en zet doorlopend niet in de dagagenda', () => {
    const expo = act({ start: '2026-09-01', end: '2026-12-31', allDay: true, ongoing: true, categories: ['expositie'] });
    const show = act({ start: '2026-10-28T10:30', categories: ['theater'] });
    const l = buildLists([expo, show], opts(), ctx);
    expect(l.ongoing.map((i) => i.activity.id)).toEqual([expo.id]);
    expect(l.days).toHaveLength(1);
    expect(l.days[0].items[0].activity.id).toBe(show.id);
  });
  it('meerdaags staat één keer, op de eerste dag binnen de periode', () => {
    const fest = act({ start: '2026-10-20', end: '2026-10-23', categories: ['festival'], allDay: true });
    const l = buildLists([fest], opts(), ctx);
    expect(l.days.map((d) => d.day)).toEqual(['2026-10-21']);
  });
  it('sorteert chronologisch: dag, dan begintijd', () => {
    const b = act({ start: '2026-10-28T14:00' });
    const a = act({ start: '2026-10-28T09:30' });
    const c = act({ start: '2026-10-27T16:00' });
    const l = buildLists([b, a, c], opts(), ctx);
    expect(l.days.flatMap((d) => d.items.map((i) => i.activity.id))).toEqual([c.id, a.id, b.id]);
  });
});

describe('kinderen of volwassenen', () => {
  const kids = act({ audiences: ['kinderen'], categories: ['theater'], start: '2026-10-28T10:00' });
  const adults = act({ audiences: ['volwassenen'], categories: ['lezing'], start: '2026-10-28T20:00' });
  const market = act({ audiences: ['volwassenen', 'gezin'], categories: ['markt'], start: '2026-10-31T11:00' });
  const ids = (l: ReturnType<typeof buildLists>) => l.days.flatMap((d) => d.items.map((i) => i.activity.id));

  it('een gezinsactiviteit staat in beide lijsten', () => {
    expect(ids(buildLists([kids, adults, market], opts({ audience: 'kinderen' }), ctx))).toEqual([kids.id, market.id]);
    expect(ids(buildLists([kids, adults, market], opts({ audience: 'volwassenen' }), ctx))).toEqual([adults.id, market.id]);
  });
  it('voorlezen wordt standaard niet getoond', () => {
    const voorlezen = act({ audiences: ['kinderen'], categories: ['voorlezen'], start: '2026-10-28T10:30' });
    expect(buildLists([voorlezen], opts(), ctx).total).toBe(0);
    expect(buildLists([voorlezen], opts({ excludeCategories: [] }), ctx).total).toBe(1);
  });
  it('verbergt wat voor beide kinderen te jong is, en telt dat', () => {
    const zesPlus = act({ audiences: ['kinderen'], age: { officialMinMonths: 72, label: '6+' }, start: '2026-10-28T10:00' });
    const l = buildLists([zesPlus, kids], opts(), ctx);
    expect(l.total).toBe(1);
    expect(l.hiddenForAge).toBe(1);
  });
  it('laat zien wat voor één van de twee past', () => {
    // 3+: kind 2 (3,5) wel, kind 1 (2) niet
    const driePlus = act({ audiences: ['kinderen'], age: { officialMinMonths: 36 }, start: '2026-10-28T10:00' });
    const l = buildLists([driePlus], opts(), ctx);
    expect(l.total).toBe(1);
    expect(l.days[0].items[0].fits!.map((f) => f.fit)).toEqual(['te-jong', 'geschikt']);
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

describe('volgend weekend en vrijdagavond', () => {
  const ids = (l: ReturnType<typeof buildLists>) => l.days.flatMap((d) => d.items.map((i) => i.activity.id));
  it('volgend weekend is het weekend na dit weekend', () => {
    expect(nextWeekend('2026-10-21')).toEqual({ from: '2026-10-31', to: '2026-11-01' });
    expect(nextWeekend('2026-10-24')).toEqual({ from: '2026-10-31', to: '2026-11-01' });
    expect(nextWeekend('2026-10-25')).toEqual({ from: '2026-10-31', to: '2026-11-01' });
  });
  it('voor volwassenen telt de vrijdagavond mee, voor kinderen niet', () => {
    expect(weekendWindow('volgend', '2026-10-21', 'volwassenen').fridayEvening).toBe('2026-10-30');
    expect(weekendWindow('volgend', '2026-10-21', 'kinderen').fridayEvening).toBeUndefined();
    // Op zaterdag is de vrijdagavond van dit weekend al voorbij
    expect(weekendWindow('dit', '2026-10-24', 'volwassenen').fridayEvening).toBeUndefined();
  });
  it('vrijdagavond vanaf 18:00 wel, vrijdagmiddag niet', () => {
    const avond = act({ audiences: ['volwassenen'], start: '2026-10-30T20:00' });
    const middag = act({ audiences: ['volwassenen'], start: '2026-10-30T14:00' });
    const zat = act({ audiences: ['volwassenen'], start: '2026-10-31T11:00' });
    const zoNa = act({ audiences: ['volwassenen'], start: '2026-11-02T20:00' });
    const l = buildLists([avond, middag, zat, zoNa], opts({ audience: 'volwassenen', weekend: 'volgend' }), ctx);
    expect(ids(l)).toEqual([avond.id, zat.id]);
    expect(l.days[0].day).toBe('2026-10-30');
  });
  it('kinderen: alleen zaterdag en zondag', () => {
    const vrij = act({ audiences: ['kinderen'], start: '2026-10-30T18:30' });
    const zon = act({ audiences: ['kinderen'], start: '2026-11-01T10:00' });
    expect(ids(buildLists([vrij, zon], opts({ weekend: 'volgend' }), ctx))).toEqual([zon.id]);
  });
});

describe('verborgen soorten', () => {
  it('verbergt een soort alleen in de lijst waar hij is uitgezet', () => {
    const expo = act({ audiences: ['gezin', 'volwassenen'], categories: ['expositie'], start: '2026-10-28T10:00' });
    const indie = act({ audiences: ['volwassenen'], kind: 'Indie', categories: ['muziek'], start: '2026-10-28T20:00' });
    const comedy = act({ audiences: ['volwassenen'], kind: 'Comedy', categories: ['theater'], start: '2026-10-28T21:00' });
    const hidden = ['Indie', 'Expositie'];
    expect(buildLists([expo, indie, comedy], opts({ audience: 'volwassenen', hiddenKinds: hidden }), ctx).total).toBe(1);
    expect(buildLists([expo, indie, comedy], opts({ audience: 'kinderen', hiddenKinds: [] }), ctx).total).toBe(1);
  });
});

describe('leeftijd onbekend', () => {
  it('staat bij Kinderen apart, niet tussen de gewone dagen', () => {
    const known = act({ title: '[TESTDATA] Bekend', audiences: ['kinderen'], start: '2026-10-28T10:00' });
    const unknown = act({ title: '[TESTDATA] Onbekend', audiences: ['kinderen'], age: {}, start: '2026-10-28T11:00' });
    const l = buildLists([known, unknown], opts(), { today: '2026-10-22', period: { from: '2026-10-22', to: '2026-11-30' }, children: [] });
    expect(l.days.flatMap((d) => d.items.map((i) => i.activity.title))).toEqual(['[TESTDATA] Bekend']);
    expect(l.unknownAge.days[0].items[0].activity.title).toBe('[TESTDATA] Onbekend');
  });
});
