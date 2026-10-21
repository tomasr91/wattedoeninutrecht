import { describe, expect, it } from 'vitest';
import { enrich, parseAgeLabel, parsePrice } from '../src/domain/enrich';

describe('leeftijdsaanduidingen uit titels', () => {
  it.each([
    ['Voorlezen (2-4 jaar)', 24, 48, '2-4 jaar'],
    ['Destiny: avontuur aan tafel (8-13 jaar)', 96, 156, '8-13 jaar'],
    ['Babyconcert \'Ik droom\' (0-2 jaar)', 0, 24, '0-2 jaar'],
    ['Het Koffertje (4+)', 48, undefined, '4+'],
    ['Krulmuziek: Kerstconcert (0+/2+)', 0, undefined, '0+'],
    ['Activiteit voor kinderen vanaf 3 jaar', 36, undefined, '3+'],
  ])('%s', (title, min, max, label) => {
    expect(parseAgeLabel(title)).toEqual(
      Object.fromEntries(
        Object.entries({ officialMinMonths: min, officialMaxMonths: max, label }).filter(([, v]) => v !== undefined),
      ),
    );
  });

  it('herkent 55-plussers niet als kinderleeftijd', () => {
    expect(parseAgeLabel('Samenlezen voor 55-plussers')).toBeNull();
  });
});

describe('verrijking', () => {
  it('voorlezen: kinderen, binnen, korte duur, geschatte leeftijd', () => {
    const e = enrich({ title: 'Voorlezen (2-4 jaar)', sourceHints: ['Jeugd'] });
    expect(e.categories).toContain('voorlezen');
    expect(e.audiences).toContain('kinderen');
    expect(e.indoor).toBe('binnen');
    expect(e.age.officialMinMonths).toBe(24);
    expect(e.age.fitReasons?.[0]).toMatch(/Korte duur/);
  });

  it('spreekuur is voor volwassenen', () => {
    expect(enrich({ title: 'Spreekuur Vrouwenrechtswinkel' }).audiences).toEqual(['volwassenen']);
  });

  it('jeugdtheater zonder peuterleeftijd krijgt een aandachtspunt', () => {
    const e = enrich({ title: 'Samar en de bange koning (8+)', sourceHints: ['Jeugdtheater'] });
    expect(e.categories).toContain('theater');
    expect(e.age.cautions).toContain('Zitvoorstelling: vraagt concentratie');
  });

  it('Sint Maarten is bijzonder en voor het gezin', () => {
    const e = enrich({ title: 'Sint Maarten Parade', startTime: '18:00' });
    expect(e.special).toBe(true);
    expect(e.audiences).toContain('gezin');
  });
});

describe('prijzen', () => {
  it('gratis', () => expect(parsePrice('Gratis, wel reserveren').kind).toBe('gratis'));
  it('bedragen', () =>
    expect(parsePrice('€ 7 lid / € 10 niet-lid')).toMatchObject({ kind: 'betaald', minEur: 7, maxEur: 10 }));
  it('decimalen met komma', () => expect(parsePrice('€ 12,50').minEur).toBe(12.5));
  it('leeg = onbekend', () => expect(parsePrice(undefined).kind).toBe('onbekend'));
});
