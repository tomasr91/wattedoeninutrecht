/**
 * Diagnose van bronnen die mislukken: per URL de robots.txt, HTTP-status, eindadres na
 * doorverwijzing, een paar kopregels (server, CDN) en het begin van de pagina.
 * Gebruikt dezelfde, eerlijke User-Agent als de verzamellaag; doet geen pogingen om blokkades te omzeilen.
 *
 *   npx tsx collector/diagnose.ts [url ...]   (zonder argumenten: de standaardlijst hieronder)
 */
import { describeNetworkError, USER_AGENT } from './lib/http.ts';

const DEFAULT_URLS = [
  'https://www.tivolivredenburg.nl/agenda/',
  'https://bibliotheekutrecht.op-shop.nl/',
  'https://www.jaarbeurs.nl/agenda',
  'https://www.uitagendautrecht.nl/agenda/',
  'https://www.kasteeldehaar.nl/agenda',
];

const HEADERS = ['server', 'content-type', 'location', 'cf-ray', 'cf-mitigated', 'x-cache', 'via', 'x-sucuri-id', 'x-served-by', 'retry-after'];

async function probe(url: string) {
  const out: Record<string, unknown> = { url };
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8', 'accept-language': 'nl-NL,nl;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    });
    out.status = res.status;
    out.finalUrl = res.url;
    out.headers = Object.fromEntries(HEADERS.map((h) => [h, res.headers.get(h)]).filter(([, v]) => v));
    const body = await res.text();
    out.length = body.length;
    out.title = body.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim();
    out.start = body.replace(/\s+/g, ' ').slice(0, 400);
  } catch (e) {
    out.error = describeNetworkError(e);
  }
  return out;
}

async function main() {
  const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;
  const results = [];
  for (const url of urls) {
    const origin = new URL(url).origin;
    const robots = await probe(`${origin}/robots.txt`);
    const page = await probe(url);
    results.push({ url, robots: { status: robots.status, error: robots.error, text: robots.status === 200 ? undefined : robots.start }, page });
    if (robots.status === 200) {
      const r = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } }).then((x) => x.text()).catch(() => '');
      (results.at(-1)!.robots as Record<string, unknown>).text = r.slice(0, 3000);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(JSON.stringify({ at: new Date().toISOString(), userAgent: USER_AGENT, results }, null, 2));
}

main();
