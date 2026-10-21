/**
 * Overzicht van het komende weekend als tekst, als basis voor de wekelijkse weekendtips.
 *
 *   npx tsx scripts/weekend-digest.ts [--kids=2024-10-01,2023-04-01] [--weekend=dit|volgend]
 *
 * Leest public/data/activities.json en past dezelfde regels toe als de app (verborgen soorten
 * van het standaardprofiel, leeftijd op de dag zelf, geen voorlezen).
 */
import { readFileSync } from 'node:fs';
import { buildLists, DEFAULT_LIST_OPTIONS, weekendWindow, type ListAudience } from '../src/domain/views';
import { makePeriod } from '../src/domain/filters';
import { defaultProfile } from '../src/domain/profile';
import { fitSummary } from '../src/domain/age';
import { dateOf, formatShortDate, timeOf, todayInAmsterdam } from '../src/domain/dates';
import { kindLabel } from '../src/domain/kind';
import type { Child, Dataset } from '../src/domain/types';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const today = todayInAmsterdam();
const weekend = (arg('weekend') ?? 'dit') as 'dit' | 'volgend';
const profile = defaultProfile(today);
const kids: Child[] = (arg('kids') ?? process.env.KIDS ?? '')
  .split(',')
  .filter(Boolean)
  .map((b, i) => ({ id: `kind${i + 1}`, name: `Kind ${i + 1}`, birthDate: b.trim() }));
const children = kids.length ? kids : profile.children;

const data = JSON.parse(readFileSync(new URL('../public/data/activities.json', import.meta.url), 'utf8')) as Dataset;
const activities = data.activities.filter((a) => !a.isTestData && a.status !== 'geannuleerd');

for (const audience of ['kinderen', 'volwassenen'] as ListAudience[]) {
  const wk = weekendWindow(weekend, today, audience);
  const lists = buildLists(
    activities,
    { ...DEFAULT_LIST_OPTIONS, audience, weekend, hiddenKinds: profile.hiddenKinds?.[audience] ?? [] },
    { today, period: makePeriod('drie-maanden', today), children },
  );
  console.log(`\n## ${audience === 'kinderen' ? 'Kinderen' : 'Volwassenen'} (${wk.fridayEvening ? 'vr-avond, ' : ''}${formatShortDate(wk.from)}–${formatShortDate(wk.to)})`);
  for (const d of lists.days) {
    for (const i of d.items) {
      const a = i.activity;
      const t = timeOf(a.start);
      const fit = i.fits ? fitSummary(i.fits).label : '';
      const multi = a.end && dateOf(a.end) !== dateOf(a.start) ? ` (t/m ${formatShortDate(dateOf(a.end))})` : '';
      console.log(
        `- ${formatShortDate(d.day)}${t ? ` ${t}` : ''}${multi} | ${a.title} | ${kindLabel(a)} | ${a.venue.name} (${a.zone}${i.km !== undefined ? `, ${i.km.toFixed(1)} km` : ''}) | ${a.price.kind}${a.special ? ' | bijzonder' : ''}${fit ? ` | ${fit}` : ''} | ${a.url}`,
      );
    }
  }
  if (lists.ongoing.length) console.log(`(+ ${lists.ongoing.length} doorlopend, bv. ${lists.ongoing.slice(0, 3).map((o) => o.activity.title).join('; ')})`);
}
