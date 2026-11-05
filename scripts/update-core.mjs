/**
 * Motorupdate: haalt een versie van uit-core op en vervangt de motorbestanden (de paden in core.json).
 * Alles van de stad (city/, data/, public/icons/, public/data/, README.md) blijft staan.
 *
 *   node scripts/update-core.mjs            nieuwste versie (hoogste tag vX.Y.Z)
 *   node scripts/update-core.mjs v1.2.0     een bepaalde versie
 *   node scripts/update-core.mjs --check    alleen melden welke versie er is
 *
 * Daarna: npm ci && npm test && npm run build, en committen. De workflow "Motor bijwerken"
 * doet dit wekelijks en zet het klaar als pull request.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const local = JSON.parse(readFileSync(join(root, 'core.json'), 'utf8'));
const repoUrl = process.env.UIT_CORE_URL ?? `https://github.com/${local.repository}.git`;
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const semver = (t) => t.replace(/^v/, '').split('.').map(Number);
const newer = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

function latestTag() {
  const tags = git('ls-remote', '--tags', '--refs', repoUrl)
    .split('\n')
    .map((l) => l.split('refs/tags/')[1])
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t ?? ''));
  if (!tags.length) throw new Error(`Geen versies (tags vX.Y.Z) gevonden in ${repoUrl}`);
  return tags.reduce((best, t) => (newer(t, best) ? t : best));
}

const tag = args.find((a) => /^v\d+\.\d+\.\d+$/.test(a)) ?? latestTag();
console.log(`Huidige motor: v${local.version} · beschikbaar: ${tag}`);
if (checkOnly) process.exit(0);
if (!args.includes(tag) && !newer(tag, `v${local.version}`)) {
  console.log('Motor is al bij. Niets gedaan.');
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), 'uit-core-'));
try {
  git('clone', '--quiet', '--depth', '1', '--branch', tag, repoUrl, tmp);
  const next = JSON.parse(readFileSync(join(tmp, 'core.json'), 'utf8'));
  // Oude motorpaden weg (ook paden die in de nieuwe versie niet meer bestaan), dan de nieuwe erin.
  for (const p of new Set([...local.paths, ...next.paths])) {
    if (p.startsWith('city') || p.startsWith('data')) throw new Error(`core.json mag geen stadspad bevatten: ${p}`);
    rmSync(join(root, p), { recursive: true, force: true });
  }
  for (const p of next.paths) {
    if (existsSync(join(tmp, p))) cpSync(join(tmp, p), join(root, p), { recursive: true });
  }
  console.log(`Motor bijgewerkt naar ${tag}. Controleer met: npm ci && npm test && npm run build`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
