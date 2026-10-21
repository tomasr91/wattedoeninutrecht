/**
 * "Nieuw"-label: welke activiteiten zijn sinds een eerder bezoek aan de agenda toegevoegd?
 * Per toestel bijgehouden: per activiteit de eerste dag dat de app hem zag.
 * Bij het allereerste bezoek is niets nieuw. Een activiteit blijft NEW_DAYS dagen "nieuw".
 */
import { addDays } from './dates';

export const NEW_DAYS = 7;

export interface SeenState {
  /** Dag van het eerste bezoek. */
  since: string;
  /** Activiteit-ID → eerste dag gezien. */
  firstSeen: Record<string, string>;
}

export function updateSeen(prev: SeenState | null, ids: string[], today: string): { state: SeenState; fresh: Set<string> } {
  if (!prev || !prev.since) {
    const firstSeen: Record<string, string> = {};
    for (const id of ids) firstSeen[id] = today;
    return { state: { since: today, firstSeen }, fresh: new Set() };
  }
  const firstSeen: Record<string, string> = {};
  const fresh = new Set<string>();
  const cutoff = addDays(today, -NEW_DAYS);
  for (const id of ids) {
    // Op de eerste dag zelf toegevoegd telt niet als nieuw (alles was toen al nieuw voor je).
    const seen = prev.firstSeen[id] ?? today;
    firstSeen[id] = seen;
    if (seen > prev.since && seen > cutoff) fresh.add(id);
  }
  return { state: { since: prev.since, firstSeen }, fresh };
}
