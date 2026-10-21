import { DEFAULT_HOME } from '../src/domain/geo';
/**
 * ⚠️ TESTDATA — FICTIEF ⚠️
 * Alles in dit bestand is verzonnen en alleen bedoeld voor geautomatiseerde
 * tests. Elk record heeft `isTestData: true` en een titel met "[TESTDATA]";
 * de app filtert deze records altijd weg.
 */
import type { Activity, Profile } from '../src/domain/types';
import { defaultProfile } from '../src/domain/profile';

let counter = 0;

export function testActivity(overrides: Partial<Activity> = {}): Activity {
  counter++;
  const id = overrides.id ?? `test-${counter}`;
  return {
    id,
    title: `[TESTDATA] Activiteit ${counter}`,
    start: '2026-11-04T10:30',
    allDay: false,
    venue: { name: 'Testlocatie', locality: 'Leidsche Rijn', lat: 52.0946, lon: 5.0604, geoPrecision: 'approx' },
    zone: 'leidsche-rijn',
    audiences: ['kinderen'],
    age: {},
    price: { kind: 'gratis' },
    indoor: 'binnen',
    categories: ['voorlezen'],
    booking: { status: 'niet-nodig' },
    url: 'https://example.invalid/test',
    sources: [
      {
        sourceId: 'test-bron',
        sourceName: 'Testbron',
        sourceEventId: id,
        url: 'https://example.invalid/test',
        firstSeen: '2026-10-19T06:00:00Z',
        lastChecked: '2026-10-19T06:00:00Z',
      },
    ],
    status: 'gepland',
    confidence: 'hoog',
    uncertainties: [],
    lastChecked: '2026-10-19T06:00:00Z',
    isTestData: true,
    ...overrides,
  };
}

/** Testprofiel met vaste geboortedata (niet afhankelijk van 'vandaag'). */
export function testProfile(): Profile {
  const p = defaultProfile('2026-10-21');
  p.children = [
    { id: 'kind1', name: 'Kind 1', birthDate: '2024-10-21' }, // 2 jaar op 21-10-2026
    { id: 'kind2', name: 'Kind 2', birthDate: '2023-04-21' }, // 3,5 jaar op 21-10-2026
  ];
  p.home = { ...DEFAULT_HOME };
  return p;
}

/** Fictieve testdata voor de UI-ontwikkelmodus is er bewust niet: de app toont alleen echte bronnen. */
export const TEST_TODAY = '2026-10-21';
