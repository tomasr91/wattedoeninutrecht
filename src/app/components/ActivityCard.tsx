import type { Activity } from '../../domain/types';
import { fitSummary } from '../../domain/age';
import { dateOf, formatShortDate, relativeDayLabel, timeOf } from '../../domain/dates';
import type { ListItem } from '../../domain/views';
import { kindLabel, NO_KIND } from '../../domain/kind';

/** Volledige tijdsaanduiding (voor het detailblad). */
export function whenLabel(a: Activity, today: string): string {
  const d = dateOf(a.start);
  const t = timeOf(a.start);
  const tEnd = a.end ? timeOf(a.end) : undefined;
  if (a.ongoing || (a.end && dateOf(a.end) !== d)) {
    if (a.endUnknown) return d <= today ? 'Doorlopend' : `Vanaf ${formatShortDate(d)}`;
    const from = d <= today ? 'Nu' : formatShortDate(d);
    return a.end ? `${from} t/m ${formatShortDate(dateOf(a.end))}` : from;
  }
  const day = relativeDayLabel(d, today);
  return t ? `${day} · ${t}${tEnd && dateOf(a.end!) === d ? `–${tEnd}` : ''}` : `${day} · ${a.allDay ? 'hele dag' : 'tijd zie bron'}`;
}

/** Korte tijdsaanduiding binnen een dag in de agenda (de dag staat al in de kop). */
function timeLabel(item: ListItem, ongoing: boolean): string {
  const a = item.activity;
  const d = dateOf(a.start);
  if (ongoing) {
    if (a.endUnknown) return 'Doorlopend, einddatum onbekend';
    return a.end ? `T/m ${formatShortDate(dateOf(a.end))}` : 'Doorlopend';
  }
  if (a.end && dateOf(a.end) !== d) {
    const t = timeOf(a.start);
    const started = d < item.day ? 'Loopt al, ' : t && d === item.day ? `${t}, ` : '';
    return `${started}t/m ${formatShortDate(dateOf(a.end))}`;
  }
  const t = timeOf(a.start);
  const tEnd = a.end ? timeOf(a.end) : undefined;
  if (t) return `${t}${tEnd ? `–${tEnd}` : ''}`;
  return a.allDay ? 'Hele dag' : 'Tijd: zie bron';
}

export { kindLabel } from '../../domain/kind';

export function priceLabel(a: Activity): string {
  if (a.price.kind === 'gratis') return 'Gratis';
  if (a.price.kind === 'betaald') {
    if (a.price.minEur !== undefined) {
      const fmt = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')}`;
      return a.price.maxEur && a.price.maxEur !== a.price.minEur ? `${fmt(a.price.minEur)}–${fmt(a.price.maxEur)}` : fmt(a.price.minEur);
    }
    return 'Betaald';
  }
  return 'Prijs onbekend';
}

export function kmText(km: number): string {
  return km < 1 ? '< 1 km' : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

export function ActivityCard({
  item,
  ongoing = false,
  onOpen,
}: {
  item: ListItem;
  ongoing?: boolean;
  onOpen: (item: ListItem) => void;
}) {
  const a = item.activity;
  const fit = item.fits ? fitSummary(item.fits) : undefined;
  const k = kindLabel(a);
  const kind = k === NO_KIND ? undefined : k;
  const cancelled = a.status === 'geannuleerd';
  const where = [a.venue.name, a.venue.locality && !a.venue.name.includes(a.venue.locality) ? a.venue.locality : undefined]
    .filter(Boolean)
    .join(', ');
  return (
    <button className={`card zone-${a.zone}${cancelled ? ' is-cancelled' : ''}`} onClick={() => onOpen(item)}>
      <span className="card-time">
        <span>{timeLabel(item, ongoing)}</span>
        {kind && <span className="kind">{kind}</span>}
        {cancelled && <span className="flag flag-bad">Gaat niet door</span>}
        {a.status === 'uitverkocht' && <span className="flag flag-bad">Uitverkocht</span>}
      </span>
      <span className="card-title">{a.title}</span>
      <span className="card-where">
        <span className="zone-dot" aria-hidden="true" />
        <span>
          {where}
          {item.km !== undefined && <span className="muted num"> · {kmText(item.km)}</span>}
          {item.others.length > 0 && <span className="muted"> · +{item.others.length} locatie{item.others.length > 1 ? 's' : ''}</span>}
        </span>
      </span>
      {ongoing && a.openingNote && <span className="card-note">{a.openingNote}</span>}
      <span className="card-tags">
        {fit && fit.label && <span className={`fit fit-${fit.tone}`}>{fit.label}</span>}
        {a.price.kind === 'gratis' && <span className="tag tag-free">Gratis</span>}
        {(a.booking.status === 'verplicht' || a.booking.status === 'aanbevolen') && !cancelled && <span className="tag">Reserveren</span>}
        {a.booking.availability && a.status !== 'uitverkocht' && <span className="tag tag-warn">{a.booking.availability.label}</span>}
      </span>
    </button>
  );
}
