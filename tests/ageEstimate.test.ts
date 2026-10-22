import { describe, expect, it } from 'vitest';
import { estimateAge } from '../src/domain/ageEstimate';
import { enrich, parseAgeLabel } from '../src/domain/enrich';
import { ageDisplay } from '../src/domain/age';

// TESTDATA: verzonnen titels, alleen om de regels te toetsen.
describe('expliciete leeftijd in tekst', () => {
  it.each([
    ['voor kinderen van 4 tot 8 jaar', 48, 96],
    ['4 t/m 7 jaar', 48, 84],
    ['groep 1 en 2', 48, 72],
    ['groep 5-8', 96, 144],
    ['vanaf 2,5 jaar', 30, undefined],
    ['2½+', 30, undefined],
    ['12-plus', 144, undefined],
    ['6 jaar en ouder', 72, undefined],
    ['minimumleeftijd 8', 96, undefined],
  ])('%s', (text, min, max) => {
    const r = parseAgeLabel(text);
    expect(r?.officialMinMonths).toBe(min);
    expect(r?.officialMaxMonths).toBe(max);
  });
  it('alle leeftijden is een open range vanaf 0', () => {
    expect(parseAgeLabel('Geschikt voor alle leeftijden')).toMatchObject({ officialMinMonths: 0, label: 'alle leeftijden' });
  });
  it('18+ maakt een activiteit voor volwassenen', () => {
    const e = enrich({ title: '[TESTDATA] Proeverij', description: 'Toegang 18+', sourceHints: ['Kinderen'] });
    expect(e.audiences).toEqual(['volwassenen']);
  });
});

describe('schatting', () => {
  it('jongerencrew is voor 10–18, niet voor peuters', () => {
    const e = enrich({ title: '[TESTDATA] UC-Crew: The New Gen', sourceHints: ['Kinderen'] });
    expect(e.age).toMatchObject({ estimatedMinMonths: 120, estimatedMaxMonths: 216 });
  });
  it('verhalen voor kinderen: 3–8', () => {
    const e = enrich({ title: '[TESTDATA] Kom luisteren: Mysterieuze Herfstverhalen', knownAudiences: ['kinderen'] });
    expect(e.age).toMatchObject({ estimatedMinMonths: 36, estimatedMaxMonths: 96, estimateReason: 'verhalen vertellen' });
  });
  it('levensfase-woorden worden samengevoegd', () => {
    expect(estimateAge({ title: '[TESTDATA] Muziek voor peuters en kleuters', kidContext: true })).toMatchObject({ minMonths: 24, maxMonths: 72 });
  });
  it('een workshop zonder kindercontext krijgt geen schatting', () => {
    expect(estimateAge({ title: '[TESTDATA] Workshop knutselen met kaarsen', kidContext: false })).toBeUndefined();
  });
  it('alleen het label Kinderen is te vaag', () => {
    const e = enrich({ title: '[TESTDATA] Middagje in het park', sourceHints: ['Kinderen'] });
    expect(e.age.estimatedMinMonths).toBeUndefined();
    expect(e.age.officialMinMonths).toBeUndefined();
  });
  it('een late starttijd maakt geen leeftijdsgrens', () => {
    const e = enrich({ title: '[TESTDATA] Familievoorstelling', startTime: '19:30' });
    expect(e.age.estimatedMinMonths).toBe(48);
    expect(e.age.cautions).toContain('Laat op de dag voor peuters');
  });
});

describe('weergave', () => {
  it('bron zonder ca., schatting met ca. en reden', () => {
    expect(ageDisplay({ officialMinMonths: 72 })).toMatchObject({ text: 'vanaf 6 jaar', basis: 'bron' });
    expect(ageDisplay({ estimatedMinMonths: 60, estimatedMaxMonths: 144, estimateReason: 'speurtocht' })).toMatchObject({ text: 'ca. 5–12 jaar', note: 'Geschat: speurtocht' });
  });
});
