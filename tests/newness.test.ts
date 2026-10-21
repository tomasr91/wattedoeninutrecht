import { describe, expect, it } from 'vitest';
import { updateSeen } from '../src/domain/newness';

describe('nieuw-label', () => {
  it('bij het eerste bezoek is niets nieuw', () => {
    expect(updateSeen(null, ['a', 'b'], '2026-10-21').fresh.size).toBe(0);
  });
  it('wat later verschijnt is een week nieuw, ook na herladen', () => {
    const s1 = updateSeen(null, ['a'], '2026-10-21').state;
    const r2 = updateSeen(s1, ['a', 'b'], '2026-10-23');
    expect([...r2.fresh]).toEqual(['b']);
    expect([...updateSeen(r2.state, ['a', 'b'], '2026-10-24').fresh]).toEqual(['b']);
    expect(updateSeen(r2.state, ['a', 'b'], '2026-10-31').fresh.size).toBe(0);
  });
  it('vergeet activiteiten die verdwenen zijn', () => {
    const s1 = updateSeen(null, ['a', 'b'], '2026-10-21').state;
    expect(Object.keys(updateSeen(s1, ['b'], '2026-10-22').state.firstSeen)).toEqual(['b']);
  });
});
