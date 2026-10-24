import { readFileSync } from 'node:fs';
import { kindLabel } from './src/domain/kind';
import { diffDays, dateOf } from './src/domain/dates';
const acts = JSON.parse(readFileSync('public/data/activities.json', 'utf8')).activities;
const sus = acts.filter((a: any) => a.sources[0].sourceId === 'uitagenda-utrecht' && !a.rolling && a.end && !a.occurrences && !a.recurrenceNote && diffDays(dateOf(a.start), dateOf(a.end)) >= 7 && dateOf(a.end) >= '2026-10-24');
const byKind = new Map<string, number>();
for (const a of sus) { const k = kindLabel(a); byKind.set(k, (byKind.get(k) ?? 0) + 1); }
console.log(sus.length, [...byKind].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
for (const a of sus) if (!/Expositie|Museum|Natuur/.test(kindLabel(a))) console.log(kindLabel(a).padEnd(16), a.start, '→', a.end, '|', a.title.slice(0, 45), '|', a.sources[0].sourceEventId);
