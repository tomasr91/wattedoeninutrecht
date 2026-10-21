import type { Home } from '../domain/types';

/**
 * Adres opzoeken via de PDOK Locatieserver (Kadaster/overheid): gratis, zonder sleutel, alleen Nederland.
 * Het adres gaat alleen voor deze ene zoekvraag naar PDOK; de app bewaart het resultaat op het toestel.
 */
export async function lookupAddress(q: string): Promise<Home | null> {
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fl=weergavenaam,centroide_ll&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Zoeken mislukt (HTTP ${res.status})`);
  const body = (await res.json()) as { response?: { docs?: { weergavenaam: string; centroide_ll: string }[] } };
  const doc = body.response?.docs?.[0];
  const m = doc?.centroide_ll.match(/POINT\(([\d.]+) ([\d.]+)\)/);
  if (!doc || !m) return null;
  return { label: doc.weergavenaam, lon: Number(m[1]), lat: Number(m[2]) };
}
