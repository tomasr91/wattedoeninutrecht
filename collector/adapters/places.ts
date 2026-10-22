/**
 * Vaste plekken (data/places.json): musea, stadsboerderijen, speeltuinen, binnenspeelparadijzen,
 * zwembaden en dergelijke. Geen agenda: plekken waar je zonder afspraak heen kunt.
 * In de app staan ze onder het tabblad Altijd (als "doorlopend" zonder einddatum).
 *
 * Elke plek is met de hand opgezocht en bevestigd; de maandelijkse controle (dinsdagtaak) houdt het bij.
 */
import { readFileSync } from 'node:fs';
import type { RawEvent } from '../normalize.ts';
import type { Audience, IndoorKind } from '../../src/domain/types.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

export interface Place {
  id: string;
  name: string;
  kind: string;
  audiences: Audience[];
  indoor: IndoorKind;
  price: 'gratis' | 'betaald';
  /** Kort, zoals de plek het zelf noemt: "di–zo 10–17", "dagelijks". */
  open?: string;
  address?: string;
  locality: string;
  url: string;
  summary?: string;
  ageLabel?: string;
  officialMinMonths?: number;
  officialMaxMonths?: number;
  estimatedMinMonths?: number;
  estimatedMaxMonths?: number;
  estimateReason?: string;
}

export interface PlacesFile {
  meta: { collectedAt: string; collectedBy: string; method: string; note?: string };
  places: Place[];
}

export const PLACES_ID = 'vaste-plekken';

export function placeToRaw(p: Place, ctx: Pick<AdapterContext, 'today' | 'until'>, checkedAt: string): RawEvent {
  const open = p.open ? p.open.charAt(0).toUpperCase() + p.open.slice(1) : 'Vaste plek';
  return {
    sourceId: PLACES_ID,
    sourceName: 'Vaste plekken',
    sourceEventId: p.id,
    url: p.url,
    title: p.name,
    start: ctx.today,
    end: ctx.until,
    allDay: true,
    ongoing: true,
    rolling: true,
    recurrenceNote: open,
    venueName: p.name,
    address: p.address,
    locality: p.locality,
    kind: p.kind,
    audiences: p.audiences,
    indoor: p.indoor,
    priceText: p.price === 'gratis' ? 'Gratis' : undefined,
    summary: p.summary,
    ageLabel: p.ageLabel,
    officialMinMonths: p.officialMinMonths,
    officialMaxMonths: p.officialMaxMonths,
    estimatedMinMonths: p.estimatedMinMonths,
    estimatedMaxMonths: p.estimatedMaxMonths,
    estimateReason: p.estimateReason,
    bookingStatus: 'niet-nodig',
    checkedAt,
  };
}

export function placesAdapter(file: string): SourceAdapter {
  return {
    id: PLACES_ID,
    name: 'Vaste plekken',
    homepage: '',
    method: 'handmatig',
    description: 'Musea, stadsboerderijen, speeltuinen, binnenspeelparadijzen en zwembaden: plekken zonder agenda, met de hand opgezocht.',
    async run(ctx: AdapterContext): Promise<AdapterResult> {
      const data = JSON.parse(readFileSync(file, 'utf8')) as PlacesFile;
      return {
        events: data.places.map((p) => placeToRaw(p, ctx, data.meta.collectedAt)),
        keepCheckedDates: true,
        authoritative: true,
        notes: `${data.places.length} vaste plekken`,
      };
    },
  };
}
