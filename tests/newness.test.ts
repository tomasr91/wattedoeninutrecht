import { describe, expect, it } from 'vitest';
import { newToday } from '../src/domain/newness';

const TODAY = '2026-11-13';
const src = (sourceId: string, firstSeen: string) => ({ sourceId, sourceName: sourceId, sourceEventId: 'x', url: 'https://x', firstSeen, lastChecked: firstSeen });
const status = { sources: [{ sourceId: 'oud', firstSuccess: '2026-10-01T03:00:00Z' }, { sourceId: 'vers', firstSuccess: '2026-11-13T03:10:00Z' }] } as never;

describe('nieuw-label', () => {
  it('nieuw alleen op de dag dat hij voor het eerst in de agenda staat (Amsterdamse datum)', () => {
    const acts = [
      { id: 'vandaag', sources: [src('oud', '2026-11-13T03:05:00Z')] },
      // 23:30 UTC op de 12e is 00:30 op de 13e in Amsterdam.
      { id: 'net-na-middernacht', sources: [src('oud', '2026-11-12T23:30:00Z')] },
      { id: 'gisteren', sources: [src('oud', '2026-11-12T03:05:00Z')] },
    ];
    expect([...newToday(acts, status, TODAY)]).toEqual(['vandaag', 'net-na-middernacht']);
  });

  it('de eerste lading van een nieuwe bron telt niet', () => {
    expect(newToday([{ id: 'a', sources: [src('vers', '2026-11-13T03:12:00Z')] }], status, TODAY).size).toBe(0);
  });

  it('stond hij er via een andere bron al eerder in, dan is hij niet nieuw', () => {
    const a = { id: 'a', sources: [src('oud', '2026-11-13T03:05:00Z'), src('vers', '2026-11-10T03:05:00Z')] };
    expect(newToday([a], status, TODAY).size).toBe(0);
  });

  it('zonder bekende eerste run van de bron: niet nieuw', () => {
    expect(newToday([{ id: 'a', sources: [src('onbekend', '2026-11-13T03:05:00Z')] }], status, TODAY).size).toBe(0);
  });
});
