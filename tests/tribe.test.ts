/** Generieke adapter voor The Events Calendar (bv. Máximapark). De JSON hieronder is ⚠️ TESTDATA. */
import { describe, expect, it } from 'vitest';
import { tribeToRaw, type TribeEvent } from '../collector/adapters/generic';

const cfg = { id: 'maximapark', name: 'Máximapark' };
const ctx = { options: { locality: 'Leidsche Rijn' }, nowIso: '2026-10-21T00:00:00Z' };

describe('The Events Calendar (tribe)', () => {
  it('zet tijden, locatie, prijs en categorieën om', () => {
    const e: TribeEvent = {
      id: 1, url: 'https://example.org/activiteit/test/', title: '[TESTDATA] Parkloop &#8211; kids',
      start_date: '2026-11-08 10:30:00', end_date: '2026-11-08 14:00:00', all_day: false, cost: '€33',
      venue: { venue: 'Desto Paviljoen', address: 'Teststraat 1', city: 'Utrecht', geo_lat: '52.10', geo_lng: '5.05' },
      categories: [{ name: 'Sport en spel' }],
    };
    const r = tribeToRaw(e, cfg, ctx);
    expect([r.title, r.start, r.end, r.allDay]).toEqual(['[TESTDATA] Parkloop – kids', '2026-11-08T10:30', '2026-11-08T14:00', false]);
    expect([r.venueName, r.priceText, r.lat, r.locality]).toEqual(['Desto Paviljoen', '€33', 52.1, 'Leidsche Rijn']);
    expect(r.hints).toContain('Sport en spel');
  });
  it('hele dag en zonder locatie', () => {
    const r = tribeToRaw({ id: 2, url: 'u', title: '[TESTDATA] Expositie', start_date: '2026-10-09 00:00:00', end_date: '2027-01-03 23:59:59', all_day: true, venue: [] }, cfg, ctx);
    expect([r.start, r.end, r.allDay, r.venueName]).toEqual(['2026-10-09', '2027-01-03', true, undefined]);
  });
});
