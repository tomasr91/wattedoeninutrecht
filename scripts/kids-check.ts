/**
 * Kindercontrole: welke activiteiten vallen bij Kinderen weg omdat er geen leeftijd bij staat
 * (en de bron ook volwassenen noemt), terwijl ze wel naar kinderaanbod klinken?
 *
 *   npx tsx scripts/kids-check.ts            → Markdown-overzicht
 *
 * Gebruikt door de wekelijkse controle (scheduled task). Leest alleen public/data/activities.json.
 */
import { readFileSync } from 'node:fs';
import { todayInAmsterdam, dateOf } from '../src/domain/dates';
import { kidHiddenForUnknownAge } from '../src/domain/views';
import type { Activity } from '../src/domain/types';

const KID_WORDS = /\b(kinder\w*|kids?|familie\w*|gezin\w*|jeugd\w*|peuter\w*|kleuter\w*|baby\w*|dreumes\w*|junior\w*|ouder(?:s)? en kind|knutsel\w*|speel(?:tuin|middag|ochtend|dag|plek|paradijs)|sprookje\w*|poppenkast|sinterklaas|sint[\s-]?maarten|lampion\w*|kerstman|schoolvakantie|herfstvakantie|kerstvakantie|voorjaarsvakantie|meivakantie)\b/i;

const today = todayInAmsterdam();
const data = JSON.parse(readFileSync('public/data/activities.json', 'utf8')) as { activities: Activity[] };
const hidden = data.activities.filter((a) => !a.isTestData && dateOf(a.end ?? a.start) >= today && kidHiddenForUnknownAge(a));

const seen = new Set<string>();
const candidates: { a: Activity; word: string }[] = [];
for (const a of hidden) {
  const key = a.title.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  const m = `${a.title} ${a.summary ?? ''}`.match(KID_WORDS);
  if (m) candidates.push({ a, word: m[1].toLowerCase() });
}

console.log(`Niet getoond bij Kinderen (geen leeftijd, bron noemt ook volwassenen): ${seen.size} titels.`);
console.log('');
if (!candidates.length) {
  console.log('Geen daarvan klinkt als kinderaanbod.');
} else {
  console.log(`Mogelijk gemist bij Kinderen (${candidates.length}):`);
  for (const { a, word } of candidates) {
    console.log(`- ${a.title} – ${a.sources[0].sourceName}, ${dateOf(a.start)} (woord: "${word}") [↗](${a.url})`);
  }
}
