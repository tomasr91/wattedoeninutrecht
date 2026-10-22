import type { Activity } from '../src/domain/types.ts';
import { dateOf, diffDays } from '../src/domain/dates.ts';

/**
 * Geen uitje: aanbod dat een bron als evenement invoert, maar dat je niet "bezoekt".
 * Wordt bij elke run toegepast, dus ook nieuwe gevallen vallen er vanzelf uit.
 *
 * - Acties en campagnes: "Spot de strik en win!", "Stem op …", loterijen.
 * - Wekenlang op "Diverse locaties" zonder tijd: een campagne, geen moment om heen te gaan.
 * - Locaties uit `excludeVenues` (per bron instelbaar): zaken die hun openingstijden als evenement invoeren.
 */
const CAMPAIGN = /\b(win|winnen|maak kans|stem op|stemmen op|winactie|spaaractie)\b|loterij|^spot de\b/i;

export function notAnOuting(a: Activity, excludeVenues: string[] = []): string | undefined {
  if (CAMPAIGN.test(a.title)) return 'actie of campagne';
  const span = diffDays(dateOf(a.start), dateOf(a.end ?? a.start)) + 1;
  if (/diverse locaties|meerdere locaties/i.test(a.venue.name) && a.allDay && span > 14) return 'campagne op diverse locaties';
  const v = excludeVenues.find((re) => new RegExp(re, 'i').test(a.venue.name));
  if (v) return `locatie uitgesloten (${v})`;
  return undefined;
}
