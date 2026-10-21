/**
 * Doorlopende activiteiten (exposities, speurtochten): de leeftijd telt op de dag
 * dat je er binnen de gekozen periode heen kunt, niet op de (vroegere) startdatum.
 * Alle activiteiten hier zijn ⚠️ TESTDATA.
 */
import { describe, expect, it } from 'vitest';
import { childFits } from '../src/domain/age';
import { applyFilters, EMPTY_FILTERS, makePeriod } from '../src/domain/filters';
import { scoreActivity } from '../src/domain/scoring';
import { normalize, type RawEvent } from '../collector/normalize';
import { testActivity, testProfile } from './fixtures';

const profile = testProfile();
// Officieel vanaf 2 jaar; liep al sinds de zomer. Kind 1 wordt 2 op 21-10-2026.
const expo = testActivity({
  title: '[TESTDATA] Doorlopende peuter-expo (2+)',
  start: '2026-07-01',
  end: '2026-12-31',
  allDay: true,
  ongoing: true,
  age: { officialMinMonths: 24, label: '2+' },
});

describe('doorlopende activiteiten en leeftijd', () => {
  it('zonder peildatum telt de startdatum: kind 1 was toen te jong', () => {
    expect(childFits(expo, profile.children)[0].fit).toBe('te-jong');
  });

  it('met peildatum telt de eerste dag binnen de periode: kind 1 is dan 2', () => {
    expect(childFits(expo, profile.children, '2026-10-21')[0].fit).toBe('geschikt');
  });

  it('een peildatum vóór de start verandert niets', () => {
    const later = testActivity({ start: '2026-11-04T10:30', age: { officialMinMonths: 24 } });
    expect(childFits(later, profile.children, '2026-10-01')[0].age.totalMonths).toBe(24);
  });

  it('filter "geschikt voor kind 1" en de score gebruiken de dag binnen de periode', () => {
    const period = makePeriod('komende-maand', '2026-10-21');
    const ctx = { today: '2026-10-21', period, children: profile.children, home: profile.home!, savedIds: new Set<string>() };
    const shown = applyFilters([{ ...expo, isTestData: false }], { ...EMPTY_FILTERS, child: 'kind1' }, ctx);
    expect(shown).toHaveLength(1);
    const score = scoreActivity(expo, profile, { today: '2026-10-21', period });
    expect(score.fits.every((f) => f.fit === 'geschikt')).toBe(true);
  });
});

describe('open einddatum en onzekerheden', () => {
  const raw: RawEvent = {
    sourceId: 'test-bron',
    sourceName: 'Testbron',
    sourceEventId: 'open-1',
    url: 'https://example.invalid/open',
    title: '[TESTDATA] Expositie zonder einddatum',
    start: '2026-10-21',
    end: '2027-01-21',
    allDay: true,
    ongoing: true,
    venueName: 'Testzaal',
    locality: 'Vleuten',
    checkedAt: '2026-10-21T07:00:00Z',
    extraUncertainties: ['Doorlopend; einddatum niet vermeld', 'Prijs niet vermeld'],
  };

  it('markeert de einddatum als onbekend en belooft geen "t/m" in de samenvatting', () => {
    const a = normalize(raw);
    expect(a.endUnknown).toBe(true);
    expect(a.summary).not.toMatch(/t\/m/);
  });

  it('toont elke onzekerheid maar één keer', () => {
    const a = normalize(raw);
    expect(a.uncertainties.filter((u) => u === 'Prijs niet vermeld')).toHaveLength(1);
  });
});
