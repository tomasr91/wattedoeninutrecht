import { canonicalKind, HIDDEN_KIND_MIGRATIONS, kindLabel } from '../domain/kind';
import { childFits } from '../domain/age';
import { distanceFromHome } from '../domain/geo';
import { openInPeriod } from '../domain/series';
import { DEFAULT_NEARBY_KM } from './views/SettingsView';
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import type { Activity, Dataset, Profile } from '../domain/types';
import { makePeriod } from '../domain/filters';
import { defaultProfile } from '../domain/profile';
import { addMonths, dateOf, diffDays, formatLongDate, formatShortDate, todayInAmsterdam, formatDateTime } from '../domain/dates';
import { buildLists, DEFAULT_LIST_OPTIONS, inspirationList, weekendWindow, type ListAudience, type ListItem, type WeekendChoice } from '../domain/views';
import { loadDataset } from './data';
import { load, save } from './storage';
import { DetailSheet } from './components/DetailSheet';
import { IconUser } from './components/Icons';
import { DomTower } from './components/DomTower';
import { AlwaysList, DayList, OngoingList } from './views/ListView';
import { updateSeen, type SeenState } from '../domain/newness';
import { NearContext, NewContext } from './newContext';
import { SettingsSheet } from './views/SettingsView';

type Pane = 'agenda' | 'doorlopend' | 'altijd';
const PANES: Pane[] = ['agenda', 'doorlopend', 'altijd'];
interface ViewState {
  audience: ListAudience;
  weekend: WeekendChoice | null;
  /** Zelf gekozen dag ('YYYY-MM-DD'); sluit de weekendknoppen uit. */
  day: string | null;
}

const DEFAULT_VIEW: ViewState = { audience: 'kinderen', weekend: null, day: null };

export function App() {
  const today = todayInAmsterdam();
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfileState] = useState<Profile>(() => {
    const p = load<Profile>('profile', defaultProfile(today));
    const d = defaultProfile(today);
    const hiddenKinds = p.hiddenKinds ?? d.hiddenKinds!;
    let version = p.hiddenKindsVersion ?? 1;
    for (const m of HIDDEN_KIND_MIGRATIONS) {
      if (m.version <= version) continue;
      hiddenKinds.volwassenen = [...new Set([...hiddenKinds.volwassenen, ...m.volwassenen])].filter((k) => !m.remove?.test(k));
      hiddenKinds.kinderen = hiddenKinds.kinderen.filter((k) => !m.remove?.test(k));
      version = m.version;
    }
    // Verborgen labels die inmiddels zijn samengevoegd, omzetten naar het nieuwe label.
    hiddenKinds.kinderen = [...new Set(hiddenKinds.kinderen.map(canonicalKind))];
    hiddenKinds.volwassenen = [...new Set(hiddenKinds.volwassenen.map(canonicalKind))];
    return { ...d, ...p, hiddenKinds, hiddenKindsVersion: version };
  });
  const [view, setViewState] = useState<ViewState>(() => {
    const v = load<Partial<ViewState> & { onlyWeekend?: boolean }>('view', DEFAULT_VIEW);
    const day = v.day && v.day >= today ? v.day : null;
    return { audience: v.audience ?? DEFAULT_VIEW.audience, weekend: day ? null : v.weekend ?? (v.onlyWeekend ? 'dit' : null), day };
  });
  const [pane, setPane] = useState<Pane>('agenda');
  const [slide, setSlide] = useState<'' | 'from-left' | 'from-right'>('');
  const [detail, setDetail] = useState<{ a: Activity; others: Activity[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<false | 'gezin' | 'verversing'>(false);

  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    loadDataset().then((d) => {
      const { state, fresh: f } = updateSeen(load<SeenState | null>('seen', null), d.activities.map((a) => a.id), today);
      save('seen', state);
      setFresh(f);
      setData(d);
    }, (e: Error) => setError(e.message));
  }, []);

  // Zonder kinderen in de instellingen is de app alleen voor volwassenen: geen keuze Kinderen/Volwassenen.
  const hasKids = profile.children.length > 0;
  const audience: ListAudience = hasKids ? view.audience : 'volwassenen';
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
  const period = useMemo(() => (view.day ? { from: view.day, to: view.day } : makePeriod('drie-maanden', today)), [today, view.day]);
  const lists = useMemo(
    () =>
      data
        ? buildLists(
            data.activities,
            {
              ...DEFAULT_LIST_OPTIONS,
              audience: audience,
              weekend: view.weekend,
              onlyBike: false,
              hiddenKinds: profile.hiddenKinds?.[audience] ?? [],
            },
            { today, period, children: profile.children, home: profile.home },
          )
        : null,
    [data, view, today, period, profile.children, profile.hiddenKinds, profile.home],
  );
  const datedCount = lists ? lists.days.reduce((n, d) => n + d.items.length, 0) : 0;
  // Vaste uitjes zonder einddatum (museum, doolhof, vaste avonden): inspiratie, los van de agenda.
  const always = useMemo<ListItem[]>(() => {
    if (!data) return [];
    const hidden = new Set((profile.hiddenKinds?.[audience] ?? []).map(canonicalKind));
    // Met een gekozen weekend of datum: alleen wat op een van die dagen open is of plaatsvindt.
    const sel = view.day ? { from: view.day, to: view.day } : view.weekend ? weekendWindow(view.weekend, today, audience) : undefined;
    return inspirationList(data.activities, audience)
      .filter((a) => !hidden.has(kindLabel(a)))
      .filter((a) => !sel || openInPeriod(a.recurrenceNote, sel.from, sel.to))
      .map((a) => ({
        activity: a,
        day: today,
        fits: audience === 'kinderen' && profile.children.length ? childFits(a, profile.children, today) : undefined,
        km: distanceFromHome(a.venue, profile.home),
        others: [],
      }));
  }, [data, audience, today, view.day, view.weekend, profile.children, profile.hiddenKinds, profile.home]);
  const expected = (data?.expected ?? []).filter((e) => e.audience === 'beide' || e.audience === audience);

  const goTo = (p: Pane) => {
    if (p === pane) return;
    setSlide(PANES.indexOf(p) > PANES.indexOf(pane) ? 'from-right' : 'from-left');
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
      const i = PANES.indexOf(pane) + (dx < 0 ? 1 : -1);
      if (i >= 0 && i < PANES.length) goTo(PANES[i]);
    }
  };

  const open = (i: ListItem) => setDetail({ a: i.activity, others: i.others });
  const lastRun = data?.status.lastSuccessfulRun;
  const staleDays = lastRun ? diffDays(dateOf(lastRun), today) : undefined;
  const wk = view.weekend ? weekendWindow(view.weekend, today, audience) : undefined;
  const scope = view.day
    ? formatLongDate(view.day)
    : wk
    ? [
        wk.fridayEvening ? `${formatShortDate(wk.fridayEvening)} (avond)` : '',
        wk.from === wk.to ? `${formatShortDate(wk.from)}` : `${formatShortDate(wk.from)} en ${formatShortDate(wk.to)}`,
      ]
        .filter(Boolean)
        .join(', ')
    : `${formatShortDate(period.from)} – ${formatShortDate(period.to)}`;
  const who = audience === 'kinderen' ? 'voor de kinderen' : 'voor volwassenen';

  return (
    <NewContext.Provider value={fresh}>
    <NearContext.Provider value={profile.home ? profile.nearbyKm ?? DEFAULT_NEARBY_KM : 0}>
    <div className="app">
      <header className="masthead">
        <span className="masthead-art" aria-hidden="true">
          <DomTower height={180} line />
        </span>
        <div className="masthead-inner">
          <div className="brand">
            <DomTower height={54} />
            <div>
              <h1>Uit in 030</h1>
              <p className="brand-sub">Ontdek. Kies. Ga.</p>
            </div>
          </div>
          <button className="icon-btn on-brand" onClick={() => setSettingsOpen('gezin')} aria-label="Instellingen">
            <IconUser size={20} />
          </button>
        </div>
      </header>

      <div className="controls">
        <div className="controls-inner">
          {hasKids && (
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
                aria-selected={audience === id}
                className={audience === id ? 'is-on' : ''}
                onClick={() => {
                  setView({ audience: id });
                  window.scrollTo({ top: 0 });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          )}

          <div className="toggle-row">
            {(
              [
                ['dit', 'Dit weekend'],
                ['volgend', 'Volgend weekend'],
              ] as const
            ).map(([w, label]) => (
              <button key={w} className={`toggle ${view.weekend === w ? 'is-on' : ''}`} aria-pressed={view.weekend === w} onClick={() => setView({ weekend: view.weekend === w ? null : w, day: null })}>
                {label}
              </button>
            ))}
            <span className={`toggle date-toggle ${view.day ? 'is-on' : ''}`}>
              <span aria-hidden="true">{view.day ? formatShortDate(view.day) : '📅 Datum'}</span>
              <input
                type="date"
                aria-label="Kies een datum"
                min={today}
                max={addMonths(today, 3)}
                value={view.day ?? ''}
                onChange={(e) => setView({ day: e.target.value || null, weekend: null })}
              />
              {view.day && (
                <button className="date-clear" aria-label="Datum wissen" onClick={() => setView({ day: null })}>
                  ×
                </button>
              )}
            </span>
          </div>

          <div className="pane-tabs" role="tablist" aria-label="Weergave">
            <button role="tab" aria-selected={pane === 'agenda'} className={pane === 'agenda' ? 'is-on' : ''} onClick={() => goTo('agenda')}>
              Agenda <span className="num count">{lists ? datedCount : ''}</span>
            </button>
            <button role="tab" aria-selected={pane === 'doorlopend'} className={pane === 'doorlopend' ? 'is-on' : ''} onClick={() => goTo('doorlopend')}>
              Doorlopend <span className="num count">{lists ? lists.ongoing.length + expected.length : ''}</span>
            </button>
            <button role="tab" aria-selected={pane === 'altijd'} className={pane === 'altijd' ? 'is-on' : ''} onClick={() => goTo('altijd')}>
              Altijd <span className="num count">{data ? always.length : ''}</span>
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
          <div key={`${pane}-${audience}`} className={`pane ${slide}`}>
            <p className="scope small muted">
              {who[0].toUpperCase() + who.slice(1)}, {pane === 'altijd' ? (view.day || view.weekend ? `vaste uitjes, open ${scope}` : 'kan altijd: vaste uitjes zonder einddatum') : scope}
            </p>
            {pane === 'agenda' ? (
              <DayList lists={lists} today={today} onOpen={open} empty={`Niets gevonden ${who} in deze periode.`} />
            ) : pane === 'altijd' ? (
              <AlwaysList items={always} onOpen={open} empty={`Nog geen vaste uitjes ${who}.`} />
            ) : (
              <OngoingList lists={lists} today={today} onOpen={open} expected={expected} empty={`Geen doorlopend aanbod ${who} in deze periode.`} />
            )}
            <footer className="list-foot small muted">
              {lastRun && <p>Laatst ververst: {formatDateTime(lastRun)}</p>}
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
          initialTab={settingsOpen}
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
    </NearContext.Provider>
    </NewContext.Provider>
  );
}
