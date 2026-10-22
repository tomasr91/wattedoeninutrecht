import { describe, expect, it } from 'vitest';
import { collapseSeries, recurrenceLabel } from '../src/domain/series';
import { buildLists, DEFAULT_LIST_OPTIONS } from '../src/domain/views';
import { parsePlaytimes } from '../collector/adapters/uitagenda-utrecht';
import { testActivity } from './fixtures';

// TESTDATA: verzonnen activiteiten.
const act = (o: Parameters<typeof testActivity>[0]) => testActivity({ isTestData: false, audiences: ['volwassenen'], categories: ['theater'], venue: { name: 'Testzaal', geoPrecision: 'unknown' }, ...o });

describe('speeltijden van UITagenda', () => {
  it('doorlopend met vaste dagen', () => {
    expect(parsePlaytimes('Datum doorlopend Tijd vr t/m za: 20:30', '2026-10-22')).toEqual({ rolling: true, note: 'Elke vr en za · 20:30' });
  });
  it('doorlopend op één dag', () => {
    expect(parsePlaytimes('Datum doorlopend Tijd zo: 14:00', '2026-10-22')).toEqual({ rolling: true, note: 'Elke zondag · 14:00' });
  });
  it('losse data in een periode', () => {
    const r = parsePlaytimes('Datum zo 25 okt t/m zo 27 dec Tijd zo 25 okt: 15:00zo 22 nov: 15:00zo 27 dec: 15:00 Voeg toe aan je kalender:', '2026-10-22');
    expect(r.occurrences).toEqual(['2026-10-25', '2026-11-22', '2026-12-27']);
    expect(r.note).toBe('Zo 25 okt, 22 nov en 27 dec · 15:00');
  });
  it('gewone periode zonder losse data', () => {
    expect(parsePlaytimes('Datum do 12 feb t/m do 31 dec Tijd 12:15 - 13:30', '2026-10-22')).toEqual({});
  });
});

describe('vaste reeksen samenvoegen', () => {
  const weekly = ['2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14'].map((d, i) =>
    act({ id: `w${i}`, title: '[TESTDATA] Quiz Night', start: `${d}T20:00` }),
  );
  it('wordt één doorlopende regel met het patroon', () => {
    const out = collapseSeries(weekly, '2026-10-22');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ start: '2026-10-24', end: '2026-11-14', recurrenceNote: 'Elke zaterdag · 20:00' });
    expect(out[0].id).toMatch(/^reeks-/);
  });
  it('staat onder doorlopend en niet in de dagagenda', () => {
    const l = buildLists(weekly, { ...DEFAULT_LIST_OPTIONS, audience: 'volwassenen' }, { today: '2026-10-22', period: { from: '2026-10-22', to: '2027-01-31' }, children: [] });
    expect(l.days).toHaveLength(0);
    expect(l.ongoing).toHaveLength(1);
  });
  it('alleen in een weekend met een datum van de reeks', () => {
    const l = buildLists(weekly, { ...DEFAULT_LIST_OPTIONS, audience: 'volwassenen' }, { today: '2026-10-22', period: { from: '2026-10-26', to: '2026-10-30' }, children: [] });
    expect(l.ongoing).toHaveLength(0);
  });
  it('drie voorstellingen in één weekend zijn geen reeks', () => {
    const run = ['2026-10-23', '2026-10-24', '2026-10-25'].map((d, i) => act({ id: `r${i}`, title: '[TESTDATA] Toneelstuk', start: `${d}T20:00` }));
    expect(collapseSeries(run, '2026-10-22')).toHaveLength(3);
  });
  it('de bron zegt doorlopend: ook met één bekende datum', () => {
    const one = act({ title: '[TESTDATA] Comedy Night', start: '2026-10-23T20:30', end: '2026-10-24', rolling: true, recurrenceNote: 'Elke vr en za · 20:30' });
    const out = collapseSeries([one], '2026-10-22');
    expect(out[0]).toMatchObject({ recurrenceNote: 'Elke vr en za · 20:30', rolling: true, occurrences: ['2026-10-23', '2026-10-24'] });
  });
  it('label', () => {
    expect(recurrenceLabel(['2026-10-23', '2026-10-24', '2026-10-30'], ['20:30', '20:30', '20:30'])).toBe('Elke vr en za · 20:30');
  });
});

import { kindLabel } from '../src/domain/kind';
describe('soort uit de titel als de bron niets zegt', () => {
  it.each([
    ['[TESTDATA] Estella Boersma All Night Long', 'Uitgaan'],
    ['[TESTDATA] PowerPoint Karaoke', 'Uitgaan'],
    ['[TESTDATA] PechaKucha Night #50', 'Lezing'],
    ['[TESTDATA] Open Mic: Rouw aan het Woord', 'Voorstelling'],
    ['[TESTDATA] Boek & Yoga (4-8 jaar)', 'Workshop'],
    ['[TESTDATA] Slaapfeestje voor knuffels', 'Feest'],
    ['[TESTDATA] USP Night Run', 'Sport'],
    ['[TESTDATA] Langs de muurschilderingen van Utrecht Noord', 'Rondleiding'],
    ['[TESTDATA] Jeremy Pelt Quintet', 'Overig'],
  ])('%s', (title, kind) => {
    expect(kindLabel({ title, categories: ['overig'] })).toBe(kind);
  });
});
