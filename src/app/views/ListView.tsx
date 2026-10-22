import { useState } from "react";
import { loadArray, save } from "../storage";
import { relativeDayLabel, weekday } from "../../domain/dates";
import type { ListItem, Lists } from "../../domain/views";
import { addMonths, dateOf } from "../../domain/dates";
import { activityEndDate } from "../../domain/filters";
import { isWeeklySeries } from "../../domain/series";
import { ActivityCard } from "../components/ActivityCard";
import { IconClose } from "../components/Icons";
import { kindLabel } from "../../domain/kind";

/** Chronologische agenda: per dag, eendaags en meerdaags (op de eerste dag). */
export function DayList({
  lists,
  today,
  onOpen,
  empty,
}: {
  lists: Lists;
  today: string;
  onOpen: (i: ListItem) => void;
  empty: string;
}) {
  if (lists.days.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="day-list">
      <Days days={lists.days} today={today} onOpen={onOpen} />
    </div>
  );
}

function Days({
  days,
  today,
  onOpen,
}: {
  days: Lists["days"];
  today: string;
  onOpen: (i: ListItem) => void;
}) {
  return (
    <>
      {days.map((d) => (
        <section key={d.day} className="day" aria-labelledby={`day-${d.day}`}>
          <h2
            id={`day-${d.day}`}
            className={`day-head ${weekday(d.day) === 0 || weekday(d.day) === 6 ? "is-weekend" : ""}`}
          >
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

/** Doorlopend aanbod, gesorteerd op wat het eerst afloopt. */
/** Aanbod dat langer dan dit doorloopt staat standaard ingeklapt onderaan. */
export const SEASON_MONTHS = 2;

export function OngoingList({
  lists,
  today,
  onOpen,
  empty,
}: {
  lists: Lists;
  today: string;
  onOpen: (i: ListItem) => void;
  empty: string;
}) {
  if (lists.ongoing.length === 0)
    return <p className="empty">{empty}</p>;
  // Ingeklapt: vaste wekelijkse reeksen ("Elke woensdag") en wat vanaf nu (of vanaf de start, als die later is)
  // nog langer dan SEASON_MONTHS loopt. Iets korts dat pas over een tijd begint (Disney on Ice) blijft in de lijst.
  const isLater = (i: ListItem) => {
    if (isWeeklySeries(i.activity)) return true;
    const from =
      dateOf(i.activity.start) > today ? dateOf(i.activity.start) : today;
    return activityEndDate(i.activity) > addMonths(from, SEASON_MONTHS);
  };
  const soon = lists.ongoing.filter((i) => !isLater(i));
  // Met een echte einddatum eerst; vaste wekelijkse reeksen ("Elke donderdag") daarna. Binnen elke groep blijft
  // de volgorde begindatum (al lopend = vandaag) → einddatum.
  const later = lists.ongoing
    .filter(isLater)
    .sort(
      (x, y) =>
        Number(isWeeklySeries(x.activity)) - Number(isWeeklySeries(y.activity)),
    );
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
      {soon.length > 0
        ? cards(soon)
        : later.length > 0 && (
            <p className="empty">Niets dat binnenkort afloopt.</p>
          )}
      {later.length > 0 && (
        <details className="season-more">
          <summary>Langer te zien ({later.length})</summary>
          {cards(later)}
        </details>
      )}
    </div>
  );
}

/** Volgorde van de groepen in Altijd; andere soorten volgen op alfabet. */
const ALWAYS_ORDER = [
  "Spelen binnen",
  "Spelen buiten",
  "Natuur & dieren",
  "Museum",
  "Doe-activiteit",
  "Sterrenkijken",
  "Belevenis",
  "Expositie",
  "Zwemmen",
  "Sport",
  "Rondleiding",
];

/** Vaste uitjes zonder einddatum: kan altijd. Inspiratie, los van de agenda, per soort; dichtbij eerst. */
export function AlwaysList({
  items,
  archived = [],
  onOpen,
  onRestore,
  onArchive,
  empty,
}: {
  items: ListItem[];
  archived?: ListItem[];
  onOpen: (i: ListItem) => void;
  onRestore?: (i: ListItem) => void;
  onArchive?: (i: ListItem) => void;
  empty: string;
}) {
  const groups = new Map<string, ListItem[]>();
  for (const i of items) {
    const k = kindLabel(i.activity);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  const rank = (k: string) =>
    ALWAYS_ORDER.includes(k) ? ALWAYS_ORDER.indexOf(k) : ALWAYS_ORDER.length;
  const ordered = [...groups].sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, "nl"),
  );
  const byDistance = (x: ListItem, y: ListItem) =>
    (x.km ?? 999) - (y.km ?? 999) ||
    x.activity.title.localeCompare(y.activity.title, "nl");
  // Ingeklapte groepen onthouden op dit toestel; standaard alles open.
  const [closed, setClosed] = useState<string[]>(() =>
    loadArray<string>("alwaysClosed"),
  );
  const toggle = (k: string) => {
    const next = closed.includes(k)
      ? closed.filter((x) => x !== k)
      : [...closed, k];
    setClosed(next);
    save("alwaysClosed", next);
  };
  return (
    <div className="day-list">
      {!items.length && <p className="empty">{empty}</p>}
      {ordered.map(([kind, list]) => (
        <section key={kind} className="day" aria-label={kind}>
          <h2 className="day-head">
            <button
              className="group-toggle"
              aria-expanded={!closed.includes(kind)}
              onClick={() => toggle(kind)}
            >
              <span
                className={`chev${closed.includes(kind) ? "" : " is-open"}`}
                aria-hidden="true"
              >
                ›
              </span>
              {kind} <span className="num count">{list.length}</span>
            </button>
          </h2>
          {!closed.includes(kind) && (
            <ul className="card-list">
              {[...list].sort(byDistance).map((i) => (
                <li
                  key={i.activity.id}
                  className={onArchive ? "has-dismiss" : undefined}
                >
                  <ActivityCard item={i} ongoing onOpen={onOpen} />
                  {onArchive && (
                    <button
                      className="card-dismiss"
                      aria-label={`${i.activity.title} wegzetten`}
                      title="Wegzetten"
                      onClick={() => onArchive(i)}
                    >
                      <IconClose size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {archived.length > 0 && (
        <details className="season-more archived">
          <summary>Weggezet ({archived.length})</summary>
          <ul className="archived-list">
            {[...archived]
              .sort((x, y) =>
                x.activity.title.localeCompare(y.activity.title, "nl"),
              )
              .map((i) => (
                <li key={i.activity.id}>
                  <span>{i.activity.title}</span>
                  <button className="text-btn" onClick={() => onRestore?.(i)}>
                    Terugzetten
                  </button>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
