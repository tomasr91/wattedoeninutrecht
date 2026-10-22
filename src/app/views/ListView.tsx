import { relativeDayLabel, weekday } from '../../domain/dates';
import type { ListItem, Lists } from '../../domain/views';
import type { ExpectedMoment } from '../../domain/expected';
import { addMonths, formatShortDate } from '../../domain/dates';
import { activityEndDate } from '../../domain/filters';
import { isWeeklySeries } from '../../domain/series';
import { ActivityCard } from '../components/ActivityCard';

/** Chronologische agenda: per dag, eendaags en meerdaags (op de eerste dag). */
export function DayList({ lists, today, onOpen, empty }: { lists: Lists; today: string; onOpen: (i: ListItem) => void; empty: string }) {
  const unknown = lists.unknownAge.days;
  const unknownCount = unknown.reduce((n, d) => n + d.items.length, 0);
  if (lists.days.length === 0 && unknownCount === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="day-list">
      {lists.days.length === 0 ? <p className="empty">{empty}</p> : <Days days={lists.days} today={today} onOpen={onOpen} />}
      {unknownCount > 0 && (
        <details className="season-more">
          <summary>Leeftijd onbekend ({unknownCount})</summary>
          <Days days={unknown} today={today} onOpen={onOpen} />
        </details>
      )}
    </div>
  );
}

function Days({ days, today, onOpen }: { days: Lists['days']; today: string; onOpen: (i: ListItem) => void }) {
  return (
    <>
      {days.map((d) => (
        <section key={d.day} className="day" aria-labelledby={`day-${d.day}`}>
          <h2 id={`day-${d.day}`} className={`day-head ${weekday(d.day) === 0 || weekday(d.day) === 6 ? 'is-weekend' : ''}`}>
            {relativeDayLabel(d.day, today)}
          </h2>
          <ul className="card-list">
            {d.items.map((i) => (
              <li key={i.activity.id}>
                <ActivityCard item={i} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Jaarlijkse momenten die eraan komen, maar nog niet in de agenda staan. */
export function ExpectedBlock({ items }: { items: ExpectedMoment[] }) {
  if (!items.length) return null;
  return (
    <section className="expected" aria-labelledby="h-expected">
      <h2 id="h-expected">Komt eraan</h2>
      <p className="section-hint">Jaarlijkse momenten waarvoor nog geen datum of programma in de agenda staat.</p>
      <ul className="expected-list">
        {items.map((e) => (
          <li key={e.id}>
            <strong>{e.name}</strong>
            <span className="small muted">
              Meestal {e.whenText}
              {e.inDays > 0 ? `, rond ${formatShortDate(e.from)}` : ''}
            </span>
            {e.checkUrl && (
              <a className="small" href={e.checkUrl} target="_blank" rel="noopener noreferrer">
                {e.checkName ?? 'Bekijk de bron'}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Doorlopend aanbod, gesorteerd op wat het eerst afloopt. */
/** Aanbod dat langer dan dit doorloopt staat standaard ingeklapt onderaan. */
export const SEASON_MONTHS = 2;

export function OngoingList({ lists, today, onOpen, empty, expected = [] }: { lists: Lists; today: string; onOpen: (i: ListItem) => void; empty: string; expected?: ExpectedMoment[] }) {
  const unknown = lists.unknownAge.ongoing;
  if (lists.ongoing.length === 0 && expected.length === 0 && unknown.length === 0) return <p className="empty">{empty}</p>;
  const cutoff = addMonths(today, SEASON_MONTHS);
  // Vaste wekelijkse reeksen ("Elke woensdag") en wat langer dan de grens loopt: ingeklapt.
  const isLater = (i: ListItem) => isWeeklySeries(i.activity) || activityEndDate(i.activity) > cutoff;
  const soon = lists.ongoing.filter((i) => !isLater(i));
  const later = lists.ongoing.filter(isLater);
  const cards = (items: ListItem[]) => (
    <ul className="card-list">
      {items.map((i) => (
        <li key={i.activity.id}>
          <ActivityCard item={i} ongoing onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="day-list">
      <ExpectedBlock items={expected} />
      {soon.length > 0 ? cards(soon) : (later.length > 0 || unknown.length > 0) && <p className="empty">Niets dat binnenkort afloopt.</p>}
      {later.length > 0 && (
        <details className="season-more">
          <summary>Langer te zien ({later.length})</summary>
          {cards(later)}
        </details>
      )}
      {unknown.length > 0 && (
        <details className="season-more">
          <summary>Leeftijd onbekend ({unknown.length})</summary>
          {cards(unknown)}
        </details>
      )}
    </div>
  );
}
