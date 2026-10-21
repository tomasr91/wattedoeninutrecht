/**
 * Controleert public/data/status.json: welke ingeschakelde bronnen mislukken al DAYS dagen of langer?
 * Schrijft een Markdown-overzicht naar stdout (leeg = alles in orde). Gebruikt door de workflow
 * om een GitHub-melding (issue) te openen, bij te werken of te sluiten.
 */
import { readFileSync } from 'node:fs';

const DAYS = Number(process.env.FAIL_DAYS ?? 3);
const status = JSON.parse(readFileSync(new URL('../public/data/status.json', import.meta.url), 'utf8'));
const now = Date.now();
const days = (iso) => (iso ? Math.floor((now - Date.parse(iso)) / 86_400_000) : Infinity);

const bad = status.sources
  .filter((s) => s.enabled && !s.ok && s.sourceId !== 'handmatig')
  .map((s) => ({ ...s, since: days(s.failingSince ?? s.lastSuccess) }))
  // Zonder failingSince (oudere status) en zonder ooit succes: nog niet melden.
  .map((s) => (s.failingSince || s.lastSuccess ? s : { ...s, since: 0 }))
  .filter((s) => s.since >= DAYS);

if (bad.length) {
  const lines = bad.map((s) => `- **${s.sourceName}** (\`${s.sourceId}\`): ${s.error ?? 'onbekende fout'}; ${s.lastSuccess ? `laatst gelukt ${days(s.lastSuccess)} dagen geleden` : `mislukt al ${s.since} dagen`}.`);
  console.log(
    [
      `Deze bronnen mislukken al ${DAYS} dagen of langer. De app toont voor deze bronnen de laatst bekende activiteiten.`,
      '',
      ...lines,
      '',
      'Diagnose: Actions → **Bronnen diagnose** → Run workflow. Of vraag Claude om het uit te zoeken.',
    ].join('\n'),
  );
}
