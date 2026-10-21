// Bouwt één los HTML-bestand (dist/uit-met-de-kids.html) met CSS, JS en data erin,
// zodat de agenda zonder server te openen of als Artifact te publiceren is.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");

const [html, css, js, data] = await Promise.all([
  read("index.html"),
  read("assets/app.css"),
  read("assets/app.js"),
  read("data/activities.json"),
]);

// Valideert de JSON en voorkomt dat "</script>" in een tekst het script afbreekt.
const inlineData = JSON.stringify(JSON.parse(data)).replace(/</g, "\\u003c");

const out = html
  .replace(/<!--.*?-->\n/s, "")
  .replace('<link rel="stylesheet" href="./assets/app.css">', () => `<style>${css}</style>`)
  .replace('<script type="application/json" id="ufa-dataset"></script>', () =>
    `<script type="application/json" id="ufa-dataset">${inlineData}</script>`)
  .replace('<script type="module" src="./assets/app.js"></script>', () =>
    `<script type="module">${js}</script>`);

await mkdir(new URL("dist/", root), { recursive: true });
await writeFile(new URL("dist/uit-met-de-kids.html", root), out);
console.log(`dist/uit-met-de-kids.html (${(out.length / 1024).toFixed(0)} KB)`);
