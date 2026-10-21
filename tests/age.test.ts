import { describe, expect, it } from 'vitest';
import { ageOnDate, birthDateFromAge, childFits, fitForAge } from '../src/domain/age';
import { testActivity, testProfile } from './fixtures';

describe('leeftijd op de datum van een activiteit', () => {
  it('berekent hele jaren en maanden', () => {
    expect(ageOnDate('2023-04-21', '2026-10-21')).toEqual({ years: 3, months: 6, totalMonths: 42 });
  });

  it('telt een maand pas mee als de dag is bereikt', () => {
    expect(ageOnDate('2024-10-21', '2026-10-20').totalMonths).toBe(23);
    expect(ageOnDate('2024-10-21', '2026-10-21').totalMonths).toBe(24);
  });

  it('gebruikt de datum van het evenement, niet vandaag', () => {
    // Kind 1 wordt 2 op 21-10-2026; een activiteit in december valt na de verjaardag
    expect(ageOnDate('2024-10-21', '2026-12-13T15:00').totalMonths).toBe(25);
  });

  it('gaat goed om met schrikkeldagen en maandeinden', () => {
    expect(ageOnDate('2024-02-29', '2027-02-28').totalMonths).toBe(35);
    expect(ageOnDate('2024-02-29', '2027-03-01').totalMonths).toBe(36);
    expect(ageOnDate('2024-01-31', '2024-02-29').totalMonths).toBe(0);
  });

  it('leidt een geboortedatum af uit een leeftijd', () => {
    expect(birthDateFromAge(42, '2026-10-21')).toBe('2023-04-21');
  });
});

describe('leeftijdsgeschiktheid verandert mee met de tijd', () => {
  const twoPlus = { officialMinMonths: 24, label: '2+' };

  it('officiële minimumleeftijd: te jong vóór de verjaardag, geschikt erna', () => {
    expect(fitForAge(23, twoPlus, false).fit).toBe('te-jong');
    expect(fitForAge(24, twoPlus, false).fit).toBe('geschikt');
    expect(fitForAge(24, twoPlus, false).basis).toBe('officieel');
  });

  it('dezelfde voorstelling wordt geschikt voor kind 1 zodra het oud genoeg is', () => {
    const p = testProfile();
    const threePlusEarly = testActivity({ start: '2026-11-01T11:00', age: { officialMinMonths: 36, label: '3+' } });
    const threePlusLater = testActivity({ start: '2027-11-01T11:00', age: { officialMinMonths: 36, label: '3+' } });
    expect(childFits(threePlusEarly, p.children).map((f) => f.fit)).toEqual(['te-jong', 'geschikt']);
    expect(childFits(threePlusLater, p.children).map((f) => f.fit)).toEqual(['geschikt', 'geschikt']);
  });

  it('maakt onderscheid tussen officieel en geschat', () => {
    const est = fitForAge(30, { estimatedMinMonths: 24, estimatedMaxMonths: 72 }, false);
    expect(est).toMatchObject({ fit: 'geschikt', basis: 'geschat' });
    const off = fitForAge(30, { officialMinMonths: 24, officialMaxMonths: 48 }, false);
    expect(off).toMatchObject({ fit: 'geschikt', basis: 'officieel' });
  });

  it('net te jong voor een geschatte ondergrens = "mogelijk"', () => {
    expect(fitForAge(44, { estimatedMinMonths: 48 }, false).fit).toBe('mogelijk');
    expect(fitForAge(30, { estimatedMinMonths: 48 }, false).fit).toBe('te-jong');
  });

  it('een kind ontgroeit een activiteit (2-4 jaar)', () => {
    const info = { officialMinMonths: 24, officialMaxMonths: 48 };
    expect(fitForAge(59, info, false).fit).toBe('geschikt'); // 4 jaar en 11 mnd valt nog in "t/m 4"
    expect(fitForAge(60, info, false).fit).toBe('te-oud');
  });

  it('volwassenenactiviteiten zijn niet voor kinderen', () => {
    const a = testActivity({ audiences: ['volwassenen'] });
    expect(childFits(a, testProfile().children).every((f) => f.fit === 'niet-voor-kinderen')).toBe(true);
  });

  it('zonder leeftijdsinformatie: onbekend in plaats van een gok', () => {
    expect(fitForAge(30, {}, false).fit).toBe('onbekend');
  });
});
