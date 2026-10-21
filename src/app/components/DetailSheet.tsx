import type { Activity, Profile } from '../../domain/types';
import { childFits, formatAge, monthsLabel, type Fit } from '../../domain/age';
import { dateOf, diffDays, formatLongDate, timeOf } from '../../domain/dates';
import { distanceFromHome, travelEstimate, ZONE_LABEL } from '../../domain/geo';
import { categoryLabel } from '../../domain/profile';
import { Sheet } from './Sheet';
import { priceLabel, whenLabel } from './ActivityCard';
import { IconCalendarPlus, IconExternal, IconRoute, IconShare } from './Icons';
import { useState } from 'react';

const FIT_LABEL: Record<Fit, string> = {
  geschikt: 'Geschikt',
  mogelijk: 'Misschien',
  'te-jong': 'Te jong',
  'te-oud': 'Te oud',
  onbekend: 'Onbekend',
  'niet-voor-kinderen': 'Voor volwassenen',
};

const BOOKING_LABEL = {
  verplicht: 'Reserveren of kaartje kopen nodig',
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
  const fits = childFits(a, profile.children, onDay);
  const adultOnly = a.audiences.length > 0 && a.audiences.every((x) => x === 'volwassenen');
  const km = distanceFromHome(a.venue, profile.home);
  const travel = km !== undefined ? travelEstimate(km) : undefined;
  const stale = diffDays(dateOf(a.lastChecked), today) > 14;
  const official = a.age.officialMinMonths !== undefined || a.age.officialMaxMonths !== undefined;
  const estimated = a.age.estimatedMinMonths !== undefined || a.age.estimatedMaxMonths !== undefined;

  return (
    <Sheet
      title={a.title}
      onClose={onClose}
      footer={
        <div className="action-row">
          <a className="btn" href={routeUrl(a)} target="_blank" rel="noopener noreferrer">
            <IconRoute size={18} /> Route
          </a>
          <a className="btn btn-primary" href={a.url} target="_blank" rel="noopener noreferrer">
            <IconExternal size={18} /> Naar de bron
          </a>
        </div>
      }
    >
      <div className={`detail zone-${a.zone}`}>
        {a.status === 'geannuleerd' && <p className="banner banner-bad">Volgens de bron gaat deze activiteit niet door.</p>}
        {a.status === 'uitverkocht' && <p className="banner banner-warn">Volgens de bron is deze activiteit uitverkocht.</p>}

        <p className="detail-when">{whenLabel(a, today)}</p>
        {a.openingNote && <p className="muted">{a.openingNote}</p>}
        {a.summary && <p className="detail-summary">{a.summary}</p>}

        <section className="detail-block">
          <h3>Voor wie</h3>
          {adultOnly ? (
            <p>Voor volwassenen.</p>
          ) : (
            <ul className="fit-list">
              {fits.map((f) => (
                <li key={f.childId}>
                  <span className={`fit-badge fit-${f.fit}`}>{FIT_LABEL[f.fit]}</span>
                  <div>
                    <strong>{f.childName}</strong>{' '}
                    <span className="muted">
                      is op {formatLongDate(onDay)} {formatAge(f.age)}
                    </span>
                    <div className="small">
                      {f.reason}
                      {f.basis === 'geschat' && ' · inschatting, niet van de bron'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!adultOnly && (
            <p className="small muted">
              {official
                ? `Officiële leeftijd volgens de bron: ${a.age.label ?? rangeText(a.age.officialMinMonths, a.age.officialMaxMonths)}.`
                : 'De bron noemt geen leeftijd.'}
              {estimated && ` Onze inschatting: ${rangeText(a.age.estimatedMinMonths, a.age.estimatedMaxMonths)}.`}
            </p>
          )}
          {a.age.fitReasons && a.age.fitReasons.length > 0 && (
            <ul className="plain-list good-list">
              {a.age.fitReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {a.age.cautions && a.age.cautions.length > 0 && (
            <ul className="plain-list caution-list">
              {a.age.cautions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="detail-block">
          <h3>Praktisch</h3>
          <dl className="facts">
            <dt>Waar</dt>
            <dd>
              {a.venue.name}
              {a.venue.address && <div className="small muted">{a.venue.address}</div>}
              <div className="small">
                <span className="zone-dot" aria-hidden="true" /> {a.venue.locality ? `${a.venue.locality} · ` : ''}
                {ZONE_LABEL[a.zone]}
              </div>
            </dd>
            <dt>Afstand</dt>
            <dd>
              {km !== undefined && travel ? (
                <>
                  ca. {km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km hemelsbreed vanaf {profile.home!.label};{' '}
                  {travel.mode === 'fiets' ? 'fietsen' : 'met de auto'} ca. {travel.minutes} min
                  {a.venue.geoPrecision !== 'exact' && <div className="small muted">Locatie benaderd, afstand is indicatief</div>}
                </>
              ) : (
                <span className="muted">{profile.home ? 'Onbekend: de bron geeft geen precieze locatie' : 'Vul bij Gezin je adres in om afstanden te zien'}</span>
              )}
            </dd>
            <dt>Prijs</dt>
            <dd>
              {a.price.text ?? priceLabel(a)}
              {a.price.kind === 'onbekend' && !a.price.text && <div className="small muted">Check de bron</div>}
            </dd>
            <dt>Binnen/buiten</dt>
            <dd>{INDOOR_LABEL[a.indoor]}</dd>
            {a.durationMinutes && (
              <>
                <dt>Duur</dt>
                <dd>
                  {a.durationIsEstimate ? 'ca. ' : ''}
                  {a.durationMinutes} min{a.durationIsEstimate && <span className="small muted"> (inschatting)</span>}
                </dd>
              </>
            )}
            <dt>Reserveren</dt>
            <dd>
              {BOOKING_LABEL[a.booking.status]}
              {a.booking.availability && (
                <div className="small">
                  {a.booking.availability.label} (gecontroleerd {fmtChecked(a.booking.availability.checkedAt, today)})
                </div>
              )}
              {a.booking.url && (
                <div>
                  <a href={a.booking.url} target="_blank" rel="noopener noreferrer">
                    Naar kaartverkoop
                  </a>
                </div>
              )}
            </dd>
            <dt>Soort</dt>
            <dd>{[a.kind, ...a.categories.map(categoryLabel)].filter((x, i, arr) => x && arr.indexOf(x) === i).join(', ')}</dd>
          </dl>
          <a className="link-row" href={calendarUrl(a)} target="_blank" rel="noopener noreferrer">
            <IconCalendarPlus size={18} /> Zet in Google Agenda
          </a>
          <ShareRow a={a} today={today} />
        </section>

        {others.length > 0 && (
          <section className="detail-block">
            <h3>Zelfde activiteit op andere locaties</h3>
            <ul className="plain-list">
              {others.map((o) => (
                <li key={o.id}>
                  <button className="text-btn" onClick={() => onOpen(o)}>
                    {o.venue.name}
                    {o.venue.locality ? ` (${o.venue.locality})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="detail-block">
          <h3>Bron en zekerheid</h3>
          {stale && (
            <p className="banner banner-warn">
              Langer dan twee weken niet gecontroleerd. Kijk op de bronpagina of het nog klopt.
            </p>
          )}
          <ul className="plain-list">
            {a.sources.map((s) => (
              <li key={`${s.sourceId}-${s.url}`}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.sourceName}
                </a>{' '}
                <span className="small muted">gecontroleerd {fmtChecked(s.lastChecked, today)}</span>
              </li>
            ))}
          </ul>
          {a.uncertainties.length > 0 && (
            <>
              <p className="small">Wat we niet zeker weten:</p>
              <ul className="plain-list unsure-list">
                {a.uncertainties.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </Sheet>
  );
}

function rangeText(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${monthsLabel(min)} t/m ${monthsLabel(max)}`;
  if (min !== undefined) return `vanaf ${monthsLabel(min)}`;
  if (max !== undefined) return `t/m ${monthsLabel(max)}`;
  return 'alle leeftijden';
}

/** Delen via het deelmenu van de telefoon (WhatsApp e.d.); anders WhatsApp-link. */
function ShareRow({ a, today }: { a: Activity; today: string }) {
  const [done, setDone] = useState(false);
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
    setDone(true);
  };
  return (
    <button className="link-row text-btn" onClick={share}>
      <IconShare size={18} /> {done ? 'Gedeeld' : 'Delen'}
    </button>
  );
}
