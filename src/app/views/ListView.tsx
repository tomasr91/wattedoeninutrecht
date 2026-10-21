import { relativeDayLabel, weekday } from '../../domain/dates';
import type { ListItem, Lists } from '../../domain/views';
import type { ExpectedMoment } from '../../domain/expected';
import { formatShortDate } from '../../domain/dates';
import { ActivityCard } from '../components/ActivityCard';

/** Chronologische agenda: per dag, eendaags en meerdaags (op de eerste dag). */
export function DayList({ lists, today, onOpen, empty }: { lists: Lists; today: string; onOpen: (i: ListItem) => void; empty: string }) {
  if (lists.days.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="day-list">
      {lists.days.map((d) => (
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
    </div>
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
export function OngoingList({ lists, onOpen, empty, expected = [] }: { lists: Lists; onOpen: (i: ListItem) => void; empty: string; expected?: ExpectedMoment[] }) {
  if (lists.ongoing.length === 0 && expected.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="day-list">
      <ExpectedBlock items={expected} />
      <ul className="card-list">
        {lists.ongoing.map((i) => (
          <li key={i.activity.id}>
            <ActivityCard item={i} ongoing onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}
