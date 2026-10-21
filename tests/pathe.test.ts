/** Pathé-adapter. De HTML hieronder is ⚠️ TESTDATA: nagebouwd naar de opbouw van pathe.nl op 21-10-2026, met verzonnen films. */
import { describe, expect, it } from 'vitest';
import { parsePathePage, patheToRaw } from '../collector/adapters/pathe';

const cinema = 'pathe-utrecht-leidsche-rijn';
const state = {
  '1': { u: `https://www.pathe.nl/api/cinema/${cinema}/shows`, b: { days: {}, shows: {
    'testfilm-kids-1': { isKids: true, days: { '2026-10-22': { tags: ['DEFAULT'], versions: ['nlnl'] }, '2026-10-25': { tags: ['DEFAULT'], versions: ['nlnl'] }, '2026-10-24': { tags: ['DEFAULT', 'kleuter'], flag: 'Kleuterbios', versions: ['nlnl'] } } },
    'testfilm-negen-2': { isKids: true, days: { '2026-10-22': { tags: ['DEFAULT'] } } },
    'testfilm-volwassen-3': { isKids: false, days: { '2026-10-22': { tags: ['DEFAULT'] } } },
    'testfilm-oud-4': { isKids: true, days: { '2026-10-01': { tags: ['DEFAULT'] } } },
  } } },
  '2': { u: 'https://www.pathe.nl/api/shows', b: { shows: [
    { slug: 'testfilm-kids-1', title: '[TESTDATA] Kinderfilm', genresSlug: ['kinderfilm'], duration: 60, contentRating: { ref: 'al', description: 'Alle Leeftijden' } },
    { slug: 'testfilm-negen-2', title: '[TESTDATA] Negen', genresSlug: ['kinderfilm'], contentRating: { ref: '-9ans', description: '-9 jaar' } },
    { slug: 'testfilm-volwassen-3', title: '[TESTDATA] Thriller', genresSlug: ['thriller'], contentRating: { ref: 'al' } },
    { slug: 'testfilm-oud-4', title: '[TESTDATA] Oud', genresSlug: ['kinderfilm'], contentRating: { ref: 'al' } },
  ] } },
  '3': { u: 'https://www.pathe.nl/api/cinemas', b: [{ slug: cinema, theaters: [{ name: 'Pathé Utrecht Leidsche Rijn', addressLine1: 'Berlijnplein 100', addressZip: '3541 CM ', addressCity: 'Utrecht', gpsPosition: { x: 52.0968, y: 5.0699 } }] }] },
};
const html = `<html><body><script id="ng-state" type="application/json">${JSON.stringify(state)}</script></body></html>`;

describe('Pathé', () => {
  const events = patheToRaw(parsePathePage(html, cinema), '2026-10-21', '2027-01-21', '2026-10-21T00:00:00Z');

  it('alleen kinderfilms met keuring AL of 6, binnen het venster', () => {
    expect(new Set(events.map((e) => e.title))).toEqual(new Set(['[TESTDATA] Kinderfilm', 'Kleuterbios: [TESTDATA] Kinderfilm']));
  });
  it('Kleuterbios per dag, gewone voorstellingen als één doorlopende regel', () => {
    const k = events.filter((e) => e.kind === 'Kleuterbios');
    expect(k.map((e) => e.start)).toEqual(['2026-10-24']);
    const film = events.find((e) => e.kind === 'Kinderfilm')!;
    expect([film.start, film.end, film.ongoing]).toEqual(['2026-10-22', '2026-10-25', true]);
    expect(film.openingNote).toContain('Nederlands gesproken');
  });
  it('adres en coördinaten uit de paginadata', () => {
    expect(events[0].address).toBe('Berlijnplein 100, 3541 CM Utrecht');
    expect(events[0].lat).toBeCloseTo(52.0968);
  });
  it('meldt een fout als de opbouw van de pagina verandert', () => {
    expect(() => parsePathePage('<html></html>', cinema)).toThrow(/ng-state/);
  });
});
