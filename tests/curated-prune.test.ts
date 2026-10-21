/** Opruimen van handmatige kopieën. Alles hier is ⚠️ TESTDATA. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneCuratedFiles } from '../collector/adapters/curated';
import { reconcile, type SourceResult } from '../src/domain/reconcile';
import { testActivity } from './fixtures';

describe('handmatige kopieën opruimen', () => {
  it('haalt items van werkende bronnen uit de bestanden en verwijdert lege bestanden', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cur-'));
    const ev = (sourceName: string) => ({ sourceName, url: 'u', title: '[TESTDATA] x', start: '2026-11-01' });
    const meta = { collectedAt: '', collectedBy: '', method: '' };
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ meta, events: [ev('Bron A'), ev('Markt')] }));
    writeFileSync(join(dir, 'b.json'), JSON.stringify({ meta, events: [ev('Bron A')] }));
    expect(pruneCuratedFiles(dir, new Set(['Bron A']))).toBe(2);
    expect(JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8')).events.map((e: { sourceName: string }) => e.sourceName)).toEqual(['Markt']);
    expect(existsSync(join(dir, 'b.json'))).toBe(false);
  });
  it('een volledige lijst verwijdert direct wat er niet meer in staat', () => {
    const a = testActivity({ isTestData: false, start: '2026-11-01' });
    const stored = [{ ...a, sources: [{ ...a.sources[0], sourceId: 'handmatig' }], contentHash: 'x', missingCount: 0 }];
    const res: SourceResult[] = [{ sourceId: 'handmatig', ok: true, authoritative: true, activities: [] }];
    const r = reconcile(stored, res, '2026-10-21T00:00:00Z', '2026-10-21');
    expect(r.activities).toHaveLength(0);
    expect(r.removed).toHaveLength(1);
  });
});
