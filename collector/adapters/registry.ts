/**
 * Adapterregister: koppelt een bron uit city/sources.config.json aan een adapter.
 *
 *  1. type "ical" / "jsonld" / "tribe": algemene adapter, alleen configuratie (geen code).
 *  2. Algemene adapters van de verzamellaag: handmatig (data/curated), vaste-plekken (data/places.json), pathe.
 *  3. Eigen adapters van de stad: city/adapters/index.ts.
 *
 * Bij 2 en 3 mogen name, homepage en description in de config de standaard van de adapter vervangen.
 */
import { join } from 'node:path';
import type { SourceAdapter } from './types.ts';
import { curatedAdapter } from './curated.ts';
import { placesAdapter } from './places.ts';
import { pathe } from './pathe.ts';
import { icalAdapter, jsonLdAdapter, tribeAdapter } from './generic.ts';
import { CITY_ADAPTERS } from '../../city/adapters/index.ts';

export interface SourceConfig {
  id: string;
  enabled: boolean;
  type?: 'ical' | 'jsonld' | 'tribe';
  name?: string;
  homepage?: string;
  description?: string;
  options?: Record<string, unknown>;
}

/** Algemene adapters die elke stad kan gebruiken. */
export function coreAdapters(root: string): Record<string, SourceAdapter> {
  return {
    handmatig: curatedAdapter(join(root, 'data', 'curated')),
    'vaste-plekken': placesAdapter(join(root, 'data', 'places.json')),
    pathe,
  };
}

export function buildRegistry(root: string): Record<string, SourceAdapter> {
  const core = coreAdapters(root);
  const clash = Object.keys(CITY_ADAPTERS).filter((id) => id in core);
  if (clash.length) throw new Error(`Bron-ID's van de stad botsen met algemene adapters: ${clash.join(', ')}`);
  return { ...core, ...CITY_ADAPTERS };
}

export function adapterFor(cfg: SourceConfig, registry: Record<string, SourceAdapter>): SourceAdapter | undefined {
  const generic = { id: cfg.id, name: cfg.name ?? cfg.id, homepage: cfg.homepage, options: cfg.options };
  if (cfg.type === 'ical') return icalAdapter(generic);
  if (cfg.type === 'tribe') return tribeAdapter(generic);
  if (cfg.type === 'jsonld') return jsonLdAdapter(generic);
  const a = registry[cfg.id];
  if (!a) return undefined;
  return {
    ...a,
    name: cfg.name ?? a.name,
    homepage: cfg.homepage ?? a.homepage,
    description: cfg.description ?? a.description,
  };
}
