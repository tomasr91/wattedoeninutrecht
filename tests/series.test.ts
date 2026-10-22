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
    expect(recurrenceLabel(['2026-10-23', '2026-10-24', '2026-10-30', '2026-11-06'], ['20:30', '20:30', '20:30', '20:30'])).toBe('Elke vr en za · 20:30');
  });
});

import { kindLabel } from '../src/domain/kind';
describe('soort uit de titel als de bron niets zegt', () => {
  it.each([
    ['[TESTDATA] Estella Boersma All Night Long', 'Uitgaan'],
    ['[TESTDATA] PowerPoint Karaoke', 'Uitgaan'],
    ['[TESTDATA] PechaKucha Night #50', 'Lezing'],
    ['[TESTDATA] Open Mic: Rouw aan het Woord', 'Cursus & ontmoeting'],
    ['[TESTDATA] Open podium', 'Theater'],
    ['[TESTDATA] Boek & Yoga (4-8 jaar)', 'Workshop'],
    ['[TESTDATA] Slaapfeestje voor knuffels', 'Feest & seizoen'],
    ['[TESTDATA] USP Night Run', 'Sport'],
    ['[TESTDATA] Langs de muurschilderingen van Utrecht Noord', 'Rondleiding'],
    ['[TESTDATA] Jeremy Pelt Quintet', 'Overig'],
  ])('%s', (title, kind) => {
    expect(kindLabel({ title, categories: ['overig'] })).toBe(kind);
  });
});

import { overlapsPeriod } from '../src/domain/filters';
import { weekdaysFromNote } from '../src/domain/series';
describe('vaste dag en datumkeuze', () => {
  it('weekdagen uit de notitie', () => {
    expect(weekdaysFromNote('Elke vr en za · 20:30')).toEqual([5, 6]);
    expect(weekdaysFromNote('Elke woensdag')).toEqual([3]);
    expect(weekdaysFromNote('Zo 25 okt, 22 nov en 27 dec · 15:00')).toBeUndefined();
  });
  const rolling = act({ title: '[TESTDATA] Comedy', start: '2026-10-23T20:30', end: '2026-10-24', rolling: true, recurrenceNote: 'Elke vr en za · 20:30' });
  it('doorlopend op vr en za: niet op een woensdag', () => {
    expect(overlapsPeriod(rolling, { from: '2026-10-28', to: '2026-10-28' })).toBe(false);
  });
  it('wel op een latere vrijdag, ook na de eerstvolgende bekende datum', () => {
    expect(overlapsPeriod(rolling, { from: '2026-11-06', to: '2026-11-06' })).toBe(true);
  });
  it('samengevoegde reeks op donderdag: niet op woensdag, wel op donderdag', () => {
    const thu = ['2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12'].map((d, i) => act({ id: `t${i}`, title: '[TESTDATA] Spelletjesmiddag', start: `${d}T15:00` }));
    const [s] = collapseSeries(thu, '2026-10-22');
    expect(overlapsPeriod(s, { from: '2026-10-28', to: '2026-10-28' })).toBe(false);
    expect(overlapsPeriod(s, { from: '2026-10-29', to: '2026-10-29' })).toBe(true);
  });
});

import { notAnOuting } from '../collector/outings';
describe('geen uitje', () => {
  it.each([
    [{ title: '[TESTDATA] Spot de strik en win!' }, 'actie of campagne'],
    [{ title: '[TESTDATA] Stem op het mooiste kasteel' }, 'actie of campagne'],
    [{ title: '[TESTDATA] VriendenLoterij Museummaand' }, 'actie of campagne'],
    [{ title: '[TESTDATA] Leesbanken', venue: { name: 'Diverse locaties Utrecht', geoPrecision: 'unknown' }, allDay: true, start: '2026-10-01', end: '2026-11-30' }, 'campagne op diverse locaties'],
  ])('%o', (o, why) => {
    expect(notAnOuting(act(o as never))).toBe(why);
  });
  it('locatie uit de uitsluitlijst', () => {
    expect(notAnOuting(act({ title: '[TESTDATA] Gezelligheid', venue: { name: 'Salon van Weleer', geoPrecision: 'unknown' } }), ['salon van weleer'])).toMatch(/locatie/);
  });
  it('gewone activiteit blijft', () => {
    expect(notAnOuting(act({ title: '[TESTDATA] Winterconcert' }))).toBeUndefined();
  });
  it.each([
    ['[TESTDATA] Gratis Japanse les', 'Cursus & ontmoeting'],
    ['[TESTDATA] Scheidingscafé', 'Cursus & ontmoeting'],
    ['[TESTDATA] Utrechtse Bierproeverij', 'Eten & drinken'],
    ['[TESTDATA] Wijnmakersdiner', 'Eten & drinken'],
    ['[TESTDATA] Wintermarkt Podium Oost', 'Markt'],
  ])('%s', (title, kind) => {
    expect(kindLabel({ title, categories: ['overig'] })).toBe(kind);
  });
});

import { recurrenceHintFromText } from '../src/domain/series';
describe('vaste dagen in de omschrijving', () => {
  it('elke maandag … en elke donderdag', () => {
    expect(recurrenceHintFromText('Elke maandag van 10.00 tot 12.30 uur en elke donderdag van 10.00 tot 13.00 uur kun je in de oogstkraam')).toBe('Elke ma en do');
  });
  it('twee data plus de hint: één doorlopende reeks', () => {
    const ms = ['2026-10-22', '2026-10-26', '2026-10-29'].map((d, i) => act({ id: `o${i}`, title: '[TESTDATA] Oogstkraam', start: `${d}T10:00`, recurrenceHint: 'Elke ma en do' }));
    const out = collapseSeries(ms, '2026-10-22');
    expect(out).toHaveLength(1);
    expect(out[0].recurrenceNote).toBe('Elke ma en do · 10:00');
  });
  it('één datum met de hint blijft een losse activiteit', () => {
    expect(collapseSeries([act({ title: '[TESTDATA] Rondleiding', start: '2026-10-25T14:00', recurrenceHint: 'Elke zondag' })], '2026-10-22')[0].id).not.toMatch(/^reeks-/);
  });
});

describe('korte periode is geen wekelijkse reeks', () => {
  it('festival do t/m zo: geen losse data en geen "Elke"', () => {
    const r = parsePlaytimes('Datum do 22 okt t/m zo 25 okt Tijd do 22 okt: 10:00vr 23 okt: 10:00za 24 okt: 10:00zo 25 okt: 10:00 Voeg toe', '2026-10-22');
    expect(r).toEqual({});
  });
  it('label over minder dan twee weken noemt de data', () => {
    expect(recurrenceLabel(['2026-10-22', '2026-10-23', '2026-10-29'], ['10:00', '10:00', '10:00'])).not.toMatch(/^Elke/);
  });
});

import { seriesNote } from '../src/domain/series';
describe('oude "Elke …" over een korte periode', () => {
  it('Varende Kerstverhalen: de data zelf, met begindatum', () => {
    const a = act({ title: '[TESTDATA] Varende verhalen', start: '2026-12-20T20:00', end: '2026-12-29', recurrenceNote: 'Elke di en zo', occurrences: ['2026-12-20', '2026-12-27', '2026-12-29'] });
    expect(seriesNote(a)).toBe('20 dec, 27 dec en 29 dec · 20:00');
  });
});

import { expandOccurrences } from '../src/domain/views';
describe('losse speeldata in de agenda', () => {
  it('voorstelling op 22 en 23 okt: twee agendaregels, niet doorlopend', () => {
    const a = act({ title: '[TESTDATA] Voorstelling', start: '2026-10-22T19:30', end: '2026-10-23', recurrenceNote: '22 okt en 23 okt · 19:30', occurrences: ['2026-10-22', '2026-10-23'] });
    const out = expandOccurrences([a]);
    expect(out.map((x) => x.start)).toEqual(['2026-10-22T19:30', '2026-10-23T19:30']);
    expect(out[0].recurrenceNote).toBeUndefined();
  });
  it('wekelijkse reeks blijft één regel', () => {
    const a = act({ title: '[TESTDATA] Quiz', start: '2026-10-22', end: '2026-11-12', recurrenceNote: 'Elke donderdag · 20:00', occurrences: ['2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12'] });
    expect(expandOccurrences([a])).toHaveLength(1);
  });
});

import { canonicalKind } from '../src/domain/kind';
describe('samengevoegde labels', () => {
  it.each([
    ['Cabaret', 'Comedy'],
    ['Comedy & cabaret', 'Comedy'],
    ['Toneel', 'Theater'],
    ['Familievoorstelling', 'Kindertheater'],
    ['Kleuterbios', 'Film'],
    ['Indie', 'Concert · Indie'],
    ['Pop', 'Concert · Pop & rock'],
    ['Concert · Rock', 'Concert · Pop & rock'],
    ['Club', 'Uitgaan'],
  ])('%s → %s', (k, out) => expect(canonicalKind(k)).toBe(out));
});

import { inspirationList } from '../src/domain/views';
describe('doorlopend zonder einddatum', () => {
  const rolling = act({ title: '[TESTDATA] Doolhof', start: '2026-10-23', end: '2026-10-23', rolling: true, recurrenceNote: 'Doorlopend' });
  it('staat niet in de lijsten', () => {
    const l = buildLists([rolling], { ...DEFAULT_LIST_OPTIONS, audience: 'volwassenen' }, { today: '2026-10-22', period: { from: '2026-10-22', to: '2026-12-31' }, children: [] });
    expect(l.days.length + l.ongoing.length).toBe(0);
  });
  it('wel in de inspiratielijst', () => {
    expect(inspirationList([rolling], 'volwassenen').map((a) => a.title)).toEqual(['[TESTDATA] Doolhof']);
  });
});
