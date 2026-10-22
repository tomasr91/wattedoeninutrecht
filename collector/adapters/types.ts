import type { RawEvent } from '../normalize.ts';

export interface AdapterContext {
  today: string;
  /** Laatste dag die we ophalen (standaard: vandaag + 3 maanden + marge). */
  until: string;
  nowIso: string;
  /** Maximaal aantal detailpagina's per bron per run. */
  maxDetailPages: number;
  log: (msg: string) => void;
  /** Bronspecifieke instellingen uit sources.config.json */
  options: Record<string, unknown>;
  /** Opslag van eerder uitgelezen detailpagina's (per bron). */
  cache?: DetailCache;
}

export interface DetailCache {
  get<T>(key: string): { fetchedAt: string; value: T } | undefined;
  set(key: string, value: unknown): void;
}

export interface AdapterResult {
  events: RawEvent[];
  /** Venster dat volledig is opgehaald; nodig om "verdwenen" items te herkennen. */
  coverage?: { from: string; to: string };
  /** Bij handmatig gecontroleerde data: controledatum niet verversen. */
  keepCheckedDates?: boolean;
  /** Levert altijd de volledige lijst; ontbrekende items worden verwijderd. */
  authoritative?: boolean;
  notes?: string;
}

export interface SourceAdapter {
  id: string;
  name: string;
  /** Korte uitleg voor het bronnenoverzicht. */
  description: string;
  homepage: string;
  method: 'html' | 'ical' | 'jsonld' | 'json' | 'handmatig';
  run(ctx: AdapterContext): Promise<AdapterResult>;
}
