/**
 * "Nieuw"-label: alleen op de dag dat een activiteit voor het eerst in de agenda staat.
 *
 * Bepaald uit de data, niet per toestel: per bron weet de verzamellaag wanneer hij een activiteit
 * voor het eerst zag (sources[].firstSeen). Een activiteit is nieuw als dat (in Amsterdam) vandaag was.
 * De eerste lading van een bron die net is toegevoegd telt niet: dan stond de bron er gisteren nog niet
 * in en is "alles nieuw" geen nieuws.
 */
import { dateOf, utcToLocal } from './dates';
import type { Activity, UpdateStatus } from './types';

const localDay = (iso: string) => dateOf(utcToLocal(new Date(iso)));

export function isNew(a: Pick<Activity, 'sources'>, firstSuccessDay: Map<string, string>, today: string): boolean {
  if (!a.sources.length) return false;
  const days = a.sources.map((s) => ({ id: s.sourceId, day: localDay(s.firstSeen) }));
  // Stond hij er via een andere bron al eerder in, dan is hij niet nieuw.
  if (days.some((d) => d.day < today)) return false;
  return days.some((d) => d.day === today && (firstSuccessDay.get(d.id) ?? today) < today);
}

/** IDs van de activiteiten die vandaag nieuw zijn. */
export function newToday(activities: Pick<Activity, 'id' | 'sources'>[], status: Pick<UpdateStatus, 'sources'> | undefined, today: string): Set<string> {
  const firstSuccessDay = new Map<string, string>();
  for (const s of status?.sources ?? []) if (s.firstSuccess) firstSuccessDay.set(s.sourceId, localDay(s.firstSuccess));
  return new Set(activities.filter((a) => isNew(a, firstSuccessDay, today)).map((a) => a.id));
}
