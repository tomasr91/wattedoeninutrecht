/**
 * Beleefde HTTP-client voor de verzamellaag:
 *  - herkenbare User-Agent met contactadres (COLLECTOR_CONTACT)
 *  - respecteert robots.txt (User-agent: * en onze eigen naam)
 *  - minimaal interval per host (standaard 1,5 s)
 *  - time-out en beperkte retries bij tijdelijke fouten
 */

const CONTACT = process.env.COLLECTOR_CONTACT ?? 'zie README van utrecht-family-agenda';
export const USER_AGENT = `UtrechtFamilyAgendaBot/0.1 (persoonlijke gezinsagenda; ${CONTACT})`;

const lastRequestAt = new Map<string, number>();
const robotsCache = new Map<string, RobotsRules>();

interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs?: number;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly status?: number,
  ) {
    super(`${message} (${shortUrl(url)})`);
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}${u.search}`.slice(0, 120);
  } catch {
    return url.slice(0, 120);
  }
}

/** Netwerkfout leesbaar maken: "fetch failed" zegt niets, de oorzaak (DNS, time-out, TLS, reset) wel. */
export function describeNetworkError(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'time-out';
  const cause = err?.cause?.code ?? err?.cause?.message;
  return cause ? `${err.message ?? 'netwerkfout'}: ${cause}` : String(err?.message ?? e);
}

export interface HttpOptions {
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
  respectRobots?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function parseRobots(txt: string, agentName = 'utrechtfamilyagendabot'): RobotsRules {
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: { disallow: [], allow: [] } };
        groups.push(current);
      }
      current.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'disallow' && val) current.rules.disallow.push(val);
    if (key === 'allow' && val) current.rules.allow.push(val);
    if (key === 'crawl-delay') current.rules.crawlDelayMs = Number(val) * 1000;
  }
  const own = groups.find((g) => g.agents.some((a) => agentName.includes(a) && a !== '*'));
  const star = groups.find((g) => g.agents.includes('*'));
  return (own ?? star)?.rules ?? { disallow: [], allow: [] };
}

function ruleMatches(rule: string, path: string): boolean {
  const re = new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(path);
}

export function isAllowed(rules: RobotsRules, pathWithQuery: string): boolean {
  const longest = (list: string[]) =>
    list.filter((r) => ruleMatches(r, pathWithQuery)).reduce((m, r) => Math.max(m, r.length), -1);
  const d = longest(rules.disallow);
  if (d < 0) return true;
  return longest(rules.allow) >= d;
}

async function robotsFor(origin: string, timeoutMs: number): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let rules: RobotsRules = { disallow: [], allow: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    // Geen robots.txt bereikbaar: standaard toegestaan, maar we blijven traag.
  }
  robotsCache.set(origin, rules);
  return rules;
}

export async function fetchText(url: string, opts: HttpOptions = {}): Promise<string> {
  const { minIntervalMs = 1500, timeoutMs = 20_000, retries = 2, respectRobots = true } = opts;
  const u = new URL(url);
  if (respectRobots) {
    const rules = await robotsFor(u.origin, timeoutMs);
    if (!isAllowed(rules, u.pathname + u.search)) {
      throw new FetchError(`robots.txt staat ${u.pathname} niet toe`, url);
    }
    if (rules.crawlDelayMs && rules.crawlDelayMs > minIntervalMs) opts.minIntervalMs = rules.crawlDelayMs;
  }
  for (let attempt = 0; ; attempt++) {
    const wait = (lastRequestAt.get(u.host) ?? 0) + (opts.minIntervalMs ?? minIntervalMs) - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt.set(u.host, Date.now());
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,text/calendar,*/*;q=0.8', 'accept-language': 'nl-NL,nl;q=0.9' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new FetchError(`HTTP ${res.status}`, url, res.status);
      }
      if (!res.ok) throw new FetchError(`HTTP ${res.status}`, url, res.status);
      return await res.text();
    } catch (e) {
      const retryable = !(e instanceof FetchError) || (e.status !== undefined && (e.status === 429 || e.status >= 500));
      if (attempt >= retries || !retryable) throw e instanceof FetchError ? e : new FetchError(describeNetworkError(e), url);
      await sleep(2000 * (attempt + 1));
    }
  }
}
