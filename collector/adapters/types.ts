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
}

export interface AdapterResult {
  events: RawEvent[];
  /** Venster dat volledig is opgehaald; nodig om "verdwenen" items te herkennen. */
  coverage?: { from: string; to: string };
  /** Bij handmatig gecontroleerde data: controledatum niet verversen. */
  keepCheckedDates?: boolean;
  notes?: string;
}

export interface SourceAdapter {
  id: string;
  name: string;
  /** Korte uitleg voor het bronnenoverzicht. */
  description: string;
  homepage: string;
  method: 'html' | 'ical' | 'jsonld' | 'handmatig';
  run(ctx: AdapterContext): Promise<AdapterResult>;
}
