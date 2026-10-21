/**
 * Pakt de gebouwde app (dist/) plus de huidige dataset in één zelfstandig HTML-fragment
 * (artifact/index.html). Handig om de app als losse pagina te delen of te publiceren
 * zonder server. De gewone hosting (GitHub Pages) gebruikt dist/ en heeft dit niet nodig.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const assets = join(root, 'dist', 'assets');
const files = readdirSync(assets);
const css = readFileSync(join(assets, files.find((f) => f.endsWith('.css'))), 'utf8');
const js = readFileSync(join(assets, files.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/gi, '<\\/script');
const data = readFileSync(join(root, 'public', 'data', 'activities.json'), 'utf8').replace(/<\//g, '<\\/');

const html = `<title>Op stap in 030</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Persoonlijke gezinsagenda voor Leidsche Rijn, Utrecht en omgeving.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="application/json" id="ufa-dataset">${data}</script>
<script type="module">${js}</script>
`;
mkdirSync(join(root, 'artifact'), { recursive: true });
writeFileSync(join(root, 'artifact', 'index.html'), html);
console.log(`artifact/index.html: ${(html.length / 1024).toFixed(0)} kB`);
