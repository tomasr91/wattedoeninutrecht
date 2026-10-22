import { kindLabel, NO_KIND } from '../../domain/kind';
import type { Activity, Profile } from '../../domain/types';
import { ageDisplay, childFits, type Fit } from '../../domain/age';
import { dateOf, diffDays, formatLongDate, timeOf } from '../../domain/dates';
import { distanceFromHome, travelEstimate } from '../../domain/geo';
import { Sheet } from './Sheet';
import { priceLabel, whenLabel } from './ActivityCard';
import { IconCalendarPlus, IconExternal, IconRoute, IconShare } from './Icons';

const BOOKING_LABEL = {
  verplicht: 'Kaartje kopen of reserveren nodig',
  aanbevolen: 'Reserveren aanbevolen',
  'niet-nodig': 'Vrije inloop, reserveren niet nodig',
  onbekend: 'Niet bekend of reserveren nodig is',
};

const INDOOR_LABEL = { binnen: 'Binnen', buiten: 'Buiten', beide: 'Binnen en buiten', onbekend: 'Niet bekend' };

export function fmtChecked(iso: string, today: string): string {
  const d = dateOf(iso);
  const days = diffDays(d, today);
  if (days <= 0) return 'vandaag';
  if (days === 1) return 'gisteren';
  if (days < 14) return `${days} dagen geleden`;
  return `op ${formatLongDate(d)}`;
}

export function routeUrl(a: Activity): string {
  const dest =
    a.venue.lat !== undefined && a.venue.lon !== undefined && a.venue.geoPrecision === 'exact'
      ? `${a.venue.lat},${a.venue.lon}`
      : [a.venue.name, a.venue.address, a.venue.locality ?? 'Utrecht'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/** Google Agenda-sjabloon: werkt via een gewone link, zonder bestand te downloaden. */
export function calendarUrl(a: Activity): string {
  const compact = (v: string) => v.replace(/[-:]/g, '');
  let dates: string;
  if (timeOf(a.start)) {
    const end = a.end && timeOf(a.end) ? a.end : a.start;
    dates = `${compact(a.start)}00/${compact(end)}00`;
  } else {
    const last = a.end && !a.ongoing ? dateOf(a.end) : dateOf(a.start);
    const d = new Date(`${last}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    dates = `${compact(dateOf(a.start))}/${d.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: a.title,
    dates,
    ctz: 'Europe/Amsterdam',
    location: [a.venue.name, a.venue.address].filter(Boolean).join(', '),
    details: `${a.summary ?? ''}\n\nBron: ${a.url}`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function DetailSheet({
  activity: a,
  others,
  profile,
  today,
  onClose,
  onOpen,
}: {
  activity: Activity;
  others: Activity[];
  profile: Profile;
  today: string;
  onClose: () => void;
  onOpen: (a: Activity) => void;
}) {
  const onDay = dateOf(a.start) < today ? today : dateOf(a.start);
  const fits = profile.children.length ? childFits(a, profile.children, onDay) : [];
  const adultOnly = a.audiences.length > 0 && a.audiences.every((x) => x === 'volwassenen');
  const km = distanceFromHome(a.venue, profile.home);
  const travel = km !== undefined ? travelEstimate(km) : undefined;
  const stale = diffDays(dateOf(a.lastChecked), today) > 14;
  const shownAge = ageDisplay(a.age);
  const ageText = a.age.label && /kijkwijzer/i.test(a.age.label) ? a.age.label : shownAge ? capital(shownAge.text) : undefined;
  const price = a.price.text ?? (a.price.kind !== 'onbekend' ? priceLabel(a) : undefined);
  const where = [a.venue.name, a.venue.locality && !a.venue.name.includes(a.venue.locality) ? a.venue.locality : undefined].filter(Boolean).join(', ');
  const k = kindLabel(a);
  const kind = k === NO_KIND ? undefined : k;
  const needsBooking = a.booking.status === 'verplicht' || a.booking.status === 'aanbevolen';

  return (
    <Sheet
      title={a.title}
      onClose={onClose}
      footer={
        <div className="detail-actions">
          <a className="btn btn-primary" href={a.url} target="_blank" rel="noopener noreferrer">
            <IconExternal size={18} /> Naar de bron
          </a>
          <div className="action-row three">
            <a className="btn" href={routeUrl(a)} target="_blank" rel="noopener noreferrer">
              <IconRoute size={18} /> Route
            </a>
            <a className="btn" href={calendarUrl(a)} target="_blank" rel="noopener noreferrer">
              <IconCalendarPlus size={18} /> Agenda
            </a>
            <ShareButton a={a} today={today} />
          </div>
        </div>
      }
    >
      <div className="detail">
        {kind && <span className="detail-kind">{kind}</span>}
        {a.summary && <p className="detail-intro">{a.summary}</p>}
        {a.status === 'geannuleerd' && <p className="banner banner-bad">Volgens de bron gaat deze activiteit niet door.</p>}
        {a.status === 'uitverkocht' && <p className="banner banner-warn">Volgens de bron is deze activiteit uitverkocht.</p>}

        <ul className="detail-facts">
          <li>
            <span aria-hidden="true">📅</span>
            <span>{whenLabel(a, today)}</span>
          </li>
          <li>
            <span aria-hidden="true">📍</span>
            <span>
              {where}
              {km !== undefined && travel && (
                <span className="muted">
                  {' '}
                  · {km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km · ± {travel.minutes} min {travel.mode === 'fiets' ? 'fietsen' : 'rijden'}
                </span>
              )}
            </span>
          </li>
          {price && (
            <li>
              <span aria-hidden="true">💶</span>
              <span>{price}</span>
            </li>
          )}
          {a.durationMinutes && (
            <li>
              <span aria-hidden="true">⏱</span>
              <span>
                {a.durationIsEstimate ? 'Ongeveer ' : ''}
                {a.durationMinutes} minuten
              </span>
            </li>
          )}
          {a.indoor !== 'onbekend' && (
            <li>
              <span aria-hidden="true">{a.indoor === 'buiten' ? '🌳' : '🏠'}</span>
              <span>{INDOOR_LABEL[a.indoor]}</span>
            </li>
          )}
          {(needsBooking || a.booking.availability) && (
            <li>
              <span aria-hidden="true">🎟</span>
              <span>
                {needsBooking ? BOOKING_LABEL[a.booking.status] : ''}
                {a.booking.availability && <span className="warn-text">{needsBooking ? ' · ' : ''}{a.booking.availability.label}</span>}
              </span>
            </li>
          )}
        </ul>

        {a.openingNote && (
          <div className="detail-text">
            <p className="muted">{a.openingNote}</p>
          </div>
        )}

        <section className="detail-block">
          <h3>Voor wie</h3>
          {adultOnly ? (
            <p>Voor volwassenen</p>
          ) : (
            <>
              {ageText && (
                <p className="detail-age">
                  {ageText}
                  {shownAge && <span className="small muted"> · {shownAge.note}</span>}
                </p>
              )}
              {fits.length > 0 && fits.every((f) => f.fit === 'onbekend') && !ageText && <p className="muted">De bron noemt geen leeftijd.</p>}
              {fits.length > 0 && !fits.every((f) => f.fit === 'onbekend') && (
                <ul className="child-fits">
                  {fits.map((f) => (
                    <li key={f.childId} className={`fit-chip fit-${f.fit}`}>
                      <strong>{f.childName}</strong> {FIT_WORDS[f.fit]}
                    </li>
                  ))}
                </ul>
              )}
              {a.age.cautions && a.age.cautions.length > 0 && <p className="small warn-text">{a.age.cautions.join(' · ')}</p>}
            </>
          )}
        </section>

        <details className="detail-more">
          <summary>Meer informatie</summary>
          {stale && <p className="small warn-text">Langer dan twee weken niet gecontroleerd; kijk op de bronpagina of het nog klopt.</p>}
          <p className="small">
            Bron:{' '}
            {a.sources.map((s, i) => (
              <span key={`${s.sourceId}-${s.url}`}>
                {i > 0 && ', '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.sourceName}
                </a>{' '}
                <span className="muted">(gecontroleerd {fmtChecked(s.lastChecked, today)})</span>
              </span>
            ))}
          </p>
          {a.venue.address && <p className="small muted">Adres: {a.venue.address}</p>}
          {a.uncertainties.length > 0 && (
            <>
              <p className="small">Niet zeker:</p>
              <ul className="plain-list unsure-list small">
                {a.uncertainties.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </>
          )}
          {others.length > 0 && (
            <>
              <p className="small">Ook op andere locaties:</p>
              <ul className="plain-list small">
                {others.map((o) => (
                  <li key={o.id}>
                    <button className="text-btn" onClick={() => onOpen(o)}>
                      {o.venue.name}
                      {o.venue.locality ? ` (${o.venue.locality})` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      </div>
    </Sheet>
  );
}

const FIT_WORDS: Record<Fit, string> = {
  geschikt: 'geschikt',
  mogelijk: 'misschien nog wat jong',
  'te-jong': 'nog te jong',
  'te-oud': 'te oud',
  onbekend: 'leeftijd onbekend',
  'niet-voor-kinderen': 'niet voor kinderen',
};

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);


/** Delen via het deelmenu van de telefoon (WhatsApp e.d.); anders WhatsApp-link. */
function ShareButton({ a, today }: { a: Activity; today: string }) {
  const text = `${a.title}\n${whenLabel(a, today)} · ${a.venue.name}`;
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: a.title, text, url: a.url });
        return;
      }
    } catch {
      return; // geannuleerd
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${a.url}`)}`, '_blank', 'noopener');
  };
  return (
    <button className="btn" onClick={share}>
      <IconShare size={18} /> Delen
    </button>
  );
}
