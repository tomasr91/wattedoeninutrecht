import { describe, expect, it } from 'vitest';
import { collapseSeries, recurrenceLabel } from '../../src/domain/series';
import { buildLists, DEFAULT_LIST_OPTIONS } from '../../src/domain/views';
import { parsePlaytimes } from '../adapters/uitagenda-utrecht';
import { testActivity } from '../../tests/fixtures';
import { kindLabel } from '../../src/domain/kind';
import { overlapsPeriod } from '../../src/domain/filters';
import { weekdaysFromNote } from '../../src/domain/series';
import { notAnOuting } from '../../collector/outings';
import { recurrenceHintFromText } from '../../src/domain/series';
import { seriesNote } from '../../src/domain/series';
import { expandOccurrences } from '../../src/domain/views';
import { canonicalKind } from '../../src/domain/kind';
import { inspirationList } from '../../src/domain/views';
import { placeToRaw } from '../../collector/adapters/places';
import { normalize } from '../../collector/normalize';
import { openDays, openInPeriod } from '../../src/domain/series';

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

describe('UITagenda: Datum-veld met één resterende datum', () => {
  it('Happen met Grappen: alleen do 26 nov, niet de hele reeks', () => {
    expect(parsePlaytimes('Entree € 39,50 Datum do 26 nov Tijd 18:00 Voeg toe aan je kalender:', '2026-10-24')).toEqual({ single: '2026-11-26', time: '18:00', endTime: undefined });
  });
  it('meerdere losse data in het Datum-veld', () => {
    const r = parsePlaytimes('Datum do 26 nov, do 10 dec Tijd 20:00 Voeg toe', '2026-10-24');
    expect(r.occurrences).toEqual(['2026-11-26', '2026-12-10']);
  });
});

describe('UITagenda: korte periode is geen wekelijkse reeks', () => {
  it('festival do t/m zo: geen losse data en geen "Elke"', () => {
    const r = parsePlaytimes('Datum do 22 okt t/m zo 25 okt Tijd do 22 okt: 10:00vr 23 okt: 10:00za 24 okt: 10:00zo 25 okt: 10:00 Voeg toe', '2026-10-22');
    expect(r).toEqual({});
  });
});
