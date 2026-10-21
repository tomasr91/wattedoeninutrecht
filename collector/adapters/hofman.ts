/**
 * Hofman (Janskerkhof) — "Utrecht Lacht": elke woensdagavond stand-upcomedy in het café.
 *
 * Werkwijze (vastgesteld 21-10-2026):
 *  - De agendapagina noemt geen losse data, alleen "Iedere woensdagavond … Utrecht Lacht begint om 20:30".
 *    Tickets en line-up lopen via een externe reserveringswidget.
 *  - Daarom: zolang de pagina dit nog zo vermeldt, zetten we elke woensdag binnen het venster in de agenda.
 *    Verdwijnt de tekst, dan levert de bron niets meer op en verdwijnen de avonden vanzelf.
 */
import { fetchText } from '../lib/http.ts';
import { cleanText } from '../lib/parse.ts';
import { addDays, weekday } from '../../src/domain/dates.ts';
import type { RawEvent } from '../normalize.ts';
import type { AdapterContext, AdapterResult, SourceAdapter } from './types.ts';

const URL_AGENDA = 'https://hofman-utrecht.nl/agenda/';
const ID = 'hofman';
const NAME = 'Hofman';

/** Begintijd als de pagina de wekelijkse comedyavond nog noemt; anders undefined. */
export function weeklyComedyTime(html: string): string | undefined {
  const text = cleanText(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
  if (!/(iedere|elke) woensdag/i.test(text) || !/utrecht lacht/i.test(text)) return undefined;
  const m = text.match(/utrecht lacht begint om (\d{1,2})[:.](\d{2})/i) ?? text.match(/vanaf (\d{1,2})[:.](\d{2})/i);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '20:30';
}

export function wednesdays(from: string, until: string): string[] {
  const out: string[] = [];
  let d = from;
  while (weekday(d) !== 3) d = addDays(d, 1);
  for (; d <= until; d = addDays(d, 7)) out.push(d);
  return out;
}

export const hofman: SourceAdapter = {
  id: ID,
  name: NAME,
  homepage: 'https://hofman-utrecht.nl/comedy-cafe-utrecht',
  method: 'html',
  description: 'Utrecht Lacht: elke woensdagavond comedy in café Hofman aan het Janskerkhof.',
  async run(ctx: AdapterContext): Promise<AdapterResult> {
    const time = weeklyComedyTime(await fetchText(URL_AGENDA));
    if (!time) return { events: [], coverage: { from: ctx.today, to: ctx.until }, notes: 'Geen wekelijkse comedyavond meer vermeld' };
    const events: RawEvent[] = wednesdays(ctx.today, ctx.until).map((d) => ({
      sourceId: ID,
      sourceName: NAME,
      sourceEventId: `utrecht-lacht|${d}`,
      url: 'https://hofman-utrecht.nl/comedy-cafe-utrecht',
      title: 'Utrecht Lacht (comedy bij Hofman)',
      start: `${d}T${time}`,
      allDay: false,
      venueName: 'Hofman',
      address: 'Janskerkhof 17A, 3512 BM Utrecht',
      locality: 'Binnenstad',
      lat: 52.0937,
      lon: 5.1219,
      geoPrecision: 'approx',
      audiences: ['volwassenen'],
      categories: ['theater'],
      kind: 'Comedy',
      indoor: 'binnen',
      bookingText: 'reserveren aanbevolen',
      openingNote: 'Wekelijkse comedyavond in het café; vooraf eventueel een comedy-diner.',
      extraUncertainties: ['Line-up en prijs staan bij de reservering', 'Wekelijkse avond; een losse avond kan uitvallen'],
      confidence: 'middel',
      checkedAt: ctx.nowIso,
    }));
    return { events, coverage: { from: ctx.today, to: ctx.until }, notes: `${events.length} woensdagavonden, aanvang ${time}` };
  },
};
