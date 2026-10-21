/**
 * Optionele geocodering via OpenStreetMap Nominatim, alleen actief met
 * GEOCODER=nominatim en NOMINATIM_EMAIL (verplicht volgens hun gebruiksbeleid).
 * Maximaal 1 verzoek per seconde; resultaten worden in SQLite gecachet zodat
 * elke locatie maar één keer wordt opgevraagd.
 */
import type { Activity } from '../src/domain/types.ts';
import { classifyZone } from '../src/domain/geo.ts';
import type { Db } from './db.ts';
import { USER_AGENT } from './lib/http.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function geocodingEnabled(): boolean {
  return process.env.GEOCODER === 'nominatim' && !!process.env.NOMINATIM_EMAIL;
}

export async function geocodeMissing(db: Db, list: Activity[], log: (m: string) => void, max = 40): Promise<number> {
  if (!geocodingEnabled()) return 0;
  const get = db.prepare('SELECT lat, lon FROM geocache WHERE query = ?');
  const put = db.prepare('INSERT OR REPLACE INTO geocache (query, lat, lon, display, fetched_at) VALUES (?, ?, ?, ?, ?)');
  let looked = 0;
  let fixed = 0;
  for (const a of list) {
    if (a.venue.geoPrecision !== 'unknown' || /diverse|meerdere|onbekend/i.test(a.venue.name)) continue;
    const q = [a.venue.address ?? a.venue.name, a.venue.locality ?? 'Utrecht', 'Nederland'].join(', ');
    let hit = get.get(q) as { lat: number | null; lon: number | null } | undefined;
    if (!hit && looked < max) {
      looked++;
      await sleep(1100);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nl&q=${encodeURIComponent(q)}&email=${encodeURIComponent(process.env.NOMINATIM_EMAIL!)}`;
        const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
        const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
        const r = json[0];
        put.run(q, r ? Number(r.lat) : null, r ? Number(r.lon) : null, r?.display_name ?? null, new Date().toISOString());
        hit = { lat: r ? Number(r.lat) : null, lon: r ? Number(r.lon) : null };
      } catch (e) {
        log(`  geocoderen mislukt voor "${q}": ${(e as Error).message}`);
        continue;
      }
    }
    if (hit && hit.lat !== null && hit.lon !== null) {
      a.venue = { ...a.venue, lat: hit.lat, lon: hit.lon, geoPrecision: 'approx' };
      a.zone = classifyZone(a.venue);
      a.uncertainties = a.uncertainties.filter((u) => !/afstand onzeker/.test(u));
      fixed++;
    }
  }
  return fixed;
}
