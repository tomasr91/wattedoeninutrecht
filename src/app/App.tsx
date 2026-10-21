import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import type { Activity, Dataset, Profile } from '../domain/types';
import { makePeriod } from '../domain/filters';
import { defaultProfile } from '../domain/profile';
import { dateOf, diffDays, formatShortDate, todayInAmsterdam, formatDateTime } from '../domain/dates';
import { buildLists, DEFAULT_LIST_OPTIONS, weekendWindow, type ListAudience, type ListItem, type WeekendChoice } from '../domain/views';
import { loadDataset } from './data';
import { load, save } from './storage';
import { DetailSheet } from './components/DetailSheet';
import { IconUser } from './components/Icons';
import { DomTower } from './components/DomTower';
import { DayList, OngoingList } from './views/ListView';
import { updateSeen, type SeenState } from '../domain/newness';
import { NewContext } from './newContext';
import { SettingsSheet } from './views/SettingsView';

type Pane = 'agenda' | 'doorlopend';
interface ViewState {
  audience: ListAudience;
  weekend: WeekendChoice | null;
}

const DEFAULT_VIEW: ViewState = { audience: 'kinderen', weekend: null };

export function App() {
  const today = todayInAmsterdam();
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfileState] = useState<Profile>(() => {
    const p = load<Profile>('profile', defaultProfile(today));
    const d = defaultProfile(today);
    return { ...d, ...p, hiddenKinds: p.hiddenKinds ?? d.hiddenKinds };
  });
  const [view, setViewState] = useState<ViewState>(() => {
    const v = load<Partial<ViewState> & { onlyWeekend?: boolean }>('view', DEFAULT_VIEW);
    return { audience: v.audience ?? DEFAULT_VIEW.audience, weekend: v.weekend ?? (v.onlyWeekend ? 'dit' : null) };
  });
  const [pane, setPane] = useState<Pane>('agenda');
  const [slide, setSlide] = useState<'' | 'from-left' | 'from-right'>('');
  const [detail, setDetail] = useState<{ a: Activity; others: Activity[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    loadDataset().then((d) => {
      const { state, fresh: f } = updateSeen(load<SeenState | null>('seen', null), d.activities.map((a) => a.id), today);
      save('seen', state);
      setFresh(f);
      setData(d);
    }, (e: Error) => setError(e.message));
  }, []);

  const setView = (patch: Partial<ViewState>) => {
    const next = { ...view, ...patch };
    setViewState(next);
    save('view', next);
  };
  const setProfile = (p: Profile) => {
    setProfileState(p);
    save('profile', p);
  };

  // Altijd de komende drie maanden (zo ver kijken de bronnen vooruit).
  const period = useMemo(() => makePeriod('drie-maanden', today), [today]);
  const lists = useMemo(
    () =>
      data
        ? buildLists(
            data.activities,
            {
              ...DEFAULT_LIST_OPTIONS,
              audience: view.audience,
              weekend: view.weekend,
              onlyBike: false,
              hiddenKinds: profile.hiddenKinds?.[view.audience] ?? [],
            },
            { today, period, children: profile.children },
          )
        : null,
    [data, view, today, period, profile.children, profile.hiddenKinds],
  );
  const datedCount = lists ? lists.days.reduce((n, d) => n + d.items.length, 0) : 0;
  const expected = (data?.expected ?? []).filter((e) => e.audience === 'beide' || e.audience === view.audience);

  const goTo = (p: Pane) => {
    if (p === pane) return;
    setSlide(p === 'doorlopend' ? 'from-right' : 'from-left');
    setPane(p);
    window.scrollTo({ top: 0 });
  };

  // Opzij vegen wisselt tussen agenda en doorlopend. Alleen duidelijk horizontale vegen tellen.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy) && Date.now() - s.t < 800) {
      goTo(pane === 'agenda' ? 'doorlopend' : 'agenda');
    }
  };

  const open = (i: ListItem) => setDetail({ a: i.activity, others: i.others });
  const lastRun = data?.status.lastSuccessfulRun;
  const staleDays = lastRun ? diffDays(dateOf(lastRun), today) : undefined;
  const wk = view.weekend ? weekendWindow(view.weekend, today, view.audience) : undefined;
  const scope = wk
    ? [
        wk.fridayEvening ? `${formatShortDate(wk.fridayEvening)} (avond)` : '',
        wk.from === wk.to ? `${formatShortDate(wk.from)}` : `${formatShortDate(wk.from)} en ${formatShortDate(wk.to)}`,
      ]
        .filter(Boolean)
        .join(', ')
    : `${formatShortDate(period.from)} – ${formatShortDate(period.to)}`;
  const who = view.audience === 'kinderen' ? 'voor de kinderen' : 'voor volwassenen';

  return (
    <NewContext.Provider value={fresh}>
    <div className="app">
      <header className="masthead">
        <span className="masthead-art" aria-hidden="true">
          <DomTower height={180} line />
        </span>
        <div className="masthead-inner">
          <div className="brand">
            <DomTower height={54} />
            <div>
              <h1>Op stap in 030</h1>
              <p className="brand-sub">Leidsche Rijn · Utrecht</p>
            </div>
          </div>
          <button className="icon-btn on-brand" onClick={() => setSettingsOpen(true)} aria-label="Gezin en bronnen">
            <IconUser size={20} />
          </button>
        </div>
      </header>

      <div className="controls">
        <div className="controls-inner">
          <div className="audience-tabs" role="tablist" aria-label="Voor wie">
            {(
              [
                ['kinderen', 'Kinderen'],
                ['volwassenen', 'Volwassenen'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view.audience === id}
                className={view.audience === id ? 'is-on' : ''}
                onClick={() => {
                  setView({ audience: id });
                  window.scrollTo({ top: 0 });
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="toggle-row">
            {(
              [
                ['dit', 'Dit weekend'],
                ['volgend', 'Volgend weekend'],
              ] as const
            ).map(([w, label]) => (
              <button key={w} className={`toggle ${view.weekend === w ? 'is-on' : ''}`} aria-pressed={view.weekend === w} onClick={() => setView({ weekend: view.weekend === w ? null : w })}>
                {label}
              </button>
            ))}
          </div>

          <div className="pane-tabs" role="tablist" aria-label="Weergave">
            <button role="tab" aria-selected={pane === 'agenda'} className={pane === 'agenda' ? 'is-on' : ''} onClick={() => goTo('agenda')}>
              Agenda <span className="num count">{lists ? datedCount : ''}</span>
            </button>
            <button role="tab" aria-selected={pane === 'doorlopend'} className={pane === 'doorlopend' ? 'is-on' : ''} onClick={() => goTo('doorlopend')}>
              Doorlopend <span className="num count">{lists ? lists.ongoing.length + expected.length : ''}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {error && <p className="banner banner-bad">{error} Controleer je verbinding en herlaad de pagina.</p>}
        {!data && !error && <p className="loading">Activiteiten laden…</p>}
        {staleDays !== undefined && staleDays > 3 && (
          <p className="banner banner-warn">De agenda is {staleDays} dagen niet bijgewerkt. Tijden en prijzen kunnen veranderd zijn; check de bron.</p>
        )}
        {lists && (
          <div key={`${pane}-${view.audience}`} className={`pane ${slide}`}>
            <p className="scope small muted">
              {who[0].toUpperCase() + who.slice(1)}, {scope}
            </p>
            {pane === 'agenda' ? (
              <DayList lists={lists} today={today} onOpen={open} empty={`Niets gevonden ${who} in deze periode.`} />
            ) : (
              <OngoingList lists={lists} onOpen={open} expected={expected} empty={`Geen doorlopend aanbod ${who} in deze periode.`} />
            )}
            <footer className="list-foot small muted">
              {view.audience === 'kinderen' && lists.hiddenForAge > 0 && (
                <p>
                  {lists.hiddenForAge} activiteit{lists.hiddenForAge === 1 ? ' is' : 'en zijn'} verborgen omdat ze voor beide kinderen te jong of te oud zijn.
                </p>
              )}
              {lastRun && (
                <p>
                  Bijgewerkt {formatDateTime(lastRun)}.{' '}
                  <button className="text-btn small" onClick={() => setSettingsOpen(true)}>
                    Bronnen
                  </button>
                </p>
              )}
            </footer>
          </div>
        )}
      </main>

      {settingsOpen && (
        <SettingsSheet
          profile={profile}
          setProfile={setProfile}
          today={today}
          status={data?.status}
          generatedAt={data?.generatedAt}
          activities={data?.activities ?? []}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {detail && (
        <DetailSheet
          activity={detail.a}
          others={detail.others}
          profile={profile}
          today={today}
          onClose={() => setDetail(null)}
          onOpen={(a) => setDetail({ a, others: [detail.a, ...detail.others].filter((o) => o.id !== a.id) })}
        />
      )}
    </div>
    </NewContext.Provider>
  );
}
