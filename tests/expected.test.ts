/** "Komt eraan": jaarlijkse momenten zonder datum in de agenda. Activiteiten hier zijn ⚠️ TESTDATA. */
import { describe, expect, it } from 'vitest';
import { computeExpected, nextOccurrence, type RecurringMoment } from '../src/domain/expected';
import { testActivity } from './fixtures';

const kerst: RecurringMoment = { id: 'kerst-lr-centrum', name: 'Kerst in Leidsche Rijn Centrum', audience: 'beide', from: '12-05', to: '12-24', whenText: 'december', keywords: ['kerst', 'kerstmarkt'], venueKeywords: ['leidsche rijn centrum', 'berlijnplein'] };
const koningsdag: RecurringMoment = { id: 'kd', name: 'Koningsdag', audience: 'beide', from: '04-26', to: '04-27', whenText: '27 april', keywords: ['koningsdag', 'vrijmarkt'] };
const nye: RecurringMoment = { id: 'nye', name: 'Soenda NYE', audience: 'volwassenen', from: '12-31', to: '12-31', whenText: 'oudejaarsavond', keywords: ['soenda'] };

describe('vaste momenten', () => {
  it('volgende keer: dit jaar als het nog moet komen, anders volgend jaar', () => {
    expect(nextOccurrence(kerst, '2026-10-21')).toEqual({ from: '2026-12-05', to: '2026-12-24' });
    expect(nextOccurrence(koningsdag, '2026-10-21')).toEqual({ from: '2027-04-26', to: '2027-04-27' });
  });

  it('meldt een moment binnen de horizon als er nog niets in de agenda staat', () => {
    const r = computeExpected([kerst, koningsdag, nye], [], '2026-10-21', 56);
    expect(r.map((e) => e.id)).toEqual(['kerst-lr-centrum']);
    expect(r[0].inDays).toBe(45);
  });

  it('niet meer melden zodra er iets passends in de agenda staat', () => {
    const markt = testActivity({ isTestData: false, title: '[TESTDATA] Kerstmarkt', start: '2026-12-12', venue: { name: 'Berlijnplein', locality: 'Leidsche Rijn Centrum', geoPrecision: 'unknown' } });
    expect(computeExpected([kerst], [markt], '2026-10-21', 56)).toEqual([]);
  });

  it('kerst ergens anders telt niet voor Leidsche Rijn Centrum', () => {
    const elders = testActivity({ isTestData: false, title: '[TESTDATA] Kerstsfeerdag', start: '2026-12-13', venue: { name: 'Geertjes Hoeve', locality: 'Haarzuilens', geoPrecision: 'unknown' } });
    expect(computeExpected([kerst], [elders], '2026-10-21', 56).map((e) => e.id)).toEqual(['kerst-lr-centrum']);
  });

  it('trefwoorden zijn hele woorden: "parade" matcht niet in "paradepaardje"', async () => {
    const parade: RecurringMoment = { id: 'p', name: 'De Parade', audience: 'beide', from: '11-01', to: '11-30', whenText: 'x', keywords: ['parade'] };
    const a = testActivity({ isTestData: false, title: '[TESTDATA] Het paradepaardje', start: '2026-11-10' });
    expect(computeExpected([parade], [a], '2026-10-21', 56)).toHaveLength(1);
  });
});
