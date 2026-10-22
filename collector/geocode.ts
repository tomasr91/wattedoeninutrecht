/**
 * Coördinaten aanvullen voor locaties die niet in de vaste lijst staan.
 *
 * 1. PDOK Locatieserver (Kadaster/overheid) voor locaties met een adres: altijd aan,
 *    gratis en zonder sleutel. Rustig tempo (ca. 4 per seconde).
 * 2. Optioneel OpenStreetMap Nominatim voor locaties met alleen een naam, alleen met
 *    GEOCODER=nominatim en NOMINATIM_EMAIL (verplicht volgens hun gebruiksbeleid).
 *
 * Resultaten (ook "niet gevonden") worden in SQLite gecachet, zodat elke locatie maar
 * één keer wordt opgevraagd.
 */
import type { Activity } from '../src/domain/types.ts';
import { classifyZone } from '../src/domain/geo.ts';
import type { Db } from './db.ts';
import { USER_AGENT } from './lib/http.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function geocodingEnabled(): boolean {
  return process.env.GEOCODER === 'nominatim' && !!process.env.NOMINATIM_EMAIL;
}

/** "POINT(5.0604 52.0946)" → { lat, lon } */
export function parsePdokPoint(p: string | undefined): { lat: number; lon: number } | undefined {
  const m = p?.match(/POINT\(([\d.]+) ([\d.]+)\)/);
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : undefined;
}

/** Adressen via PDOK opzoeken. Geeft het aantal aangevulde activiteiten terug. */
export async function geocodeAddressesPdok(db: Db, list: Activity[], log: (m: string) => void, max = 600): Promise<number> {
  const get = db.prepare('SELECT lat, lon FROM geocache WHERE query = ?');
  const put = db.prepare('INSERT OR REPLACE INTO geocache (query, lat, lon, display, fetched_at) VALUES (?, ?, ?, ?, ?)');
  let looked = 0;
  let fixed = 0;
  let failures = 0;
  for (const a of list) {
    if (a.venue.lat !== undefined || !a.venue.address) continue;
    const q = `pdok:${a.venue.address.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    let hit = get.get(q) as { lat: number | null; lon: number | null } | undefined;
    if (!hit && looked < max && failures < 5) {
      looked++;
      await sleep(250);
      try {
        const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fq=type:adres&fl=weergavenaam,centroide_ll&q=${encodeURIComponent(a.venue.address)}`;
        const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { response?: { docs?: { weergavenaam: string; centroide_ll: string }[] } };
        const doc = json.response?.docs?.[0];
        const pt = parsePdokPoint(doc?.centroide_ll);
        put.run(q, pt?.lat ?? null, pt?.lon ?? null, doc?.weergavenaam ?? null, new Date().toISOString());
        hit = { lat: pt?.lat ?? null, lon: pt?.lon ?? null };
      } catch (e) {
        failures++;
        log(`  PDOK mislukt voor "${a.venue.address}": ${(e as Error).message}`);
        continue;
      }
    }
    if (hit && hit.lat !== null && hit.lon !== null) {
      a.venue = { ...a.venue, lat: hit.lat, lon: hit.lon, geoPrecision: 'exact' };
      a.zone = classifyZone(a.venue);
      a.uncertainties = a.uncertainties.filter((u) => !/afstand onzeker/.test(u));
      fixed++;
    }
  }
  if (looked) log(`  PDOK: ${looked} adressen opgezocht`);
  return fixed;
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
