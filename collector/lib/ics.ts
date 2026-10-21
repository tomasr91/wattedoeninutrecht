/**
 * Minimale iCalendar (RFC 5545) parser voor VEVENT's. Ondersteunt regelvouwing,
 * TZID=Europe/Amsterdam, UTC ('Z') en hele dagen (VALUE=DATE).
 */
import { addDays, utcToLocal } from '../../src/domain/dates.ts';

export interface IcsEvent {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  url?: string;
  start: string;
  end?: string;
  allDay: boolean;
  status?: string;
  categories?: string[];
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseDateValue(value: string, params: Record<string, string>): { v: string; allDay: boolean } | undefined {
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
    return { v: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/);
  if (!m) return undefined;
  if (m[7] === 'Z') {
    return { v: utcToLocal(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))), allDay: false };
  }
  // Zonder Z: lokale tijd (TZID of "floating"). We gaan uit van Europe/Amsterdam.
  return { v: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`, allDay: false };
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> & { _start?: { v: string; allDay: boolean }; _end?: { v: string; allDay: boolean } } | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?._start) {
        let end = cur._end?.v;
        // DTEND bij hele dagen is exclusief
        if (cur._end?.allDay && end) end = addDays(end, -1);
        if (end === cur._start.v) end = undefined;
        events.push({
          uid: cur.uid,
          summary: cur.summary,
          description: cur.description,
          location: cur.location,
          url: cur.url,
          status: cur.status,
          categories: cur.categories,
          start: cur._start.v,
          end,
          allDay: cur._start.allDay,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const [nameAndParams, value] = [line.slice(0, idx), line.slice(idx + 1)];
    const [name, ...paramParts] = nameAndParams.split(';');
    const params = Object.fromEntries(paramParts.map((p) => p.split('=') as [string, string]));
    switch (name.toUpperCase()) {
      case 'UID': cur.uid = value; break;
      case 'SUMMARY': cur.summary = unescape(value); break;
      case 'DESCRIPTION': cur.description = unescape(value); break;
      case 'LOCATION': cur.location = unescape(value); break;
      case 'URL': cur.url = value; break;
      case 'STATUS': cur.status = value.toUpperCase(); break;
      case 'CATEGORIES': cur.categories = unescape(value).split(',').map((s) => s.trim()); break;
      case 'DTSTART': cur._start = parseDateValue(value, params); break;
      case 'DTEND': cur._end = parseDateValue(value, params); break;
    }
  }
  return events;
}
