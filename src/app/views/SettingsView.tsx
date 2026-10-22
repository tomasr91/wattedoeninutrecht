import { dateOf } from '../../domain/dates';
import { kidHiddenForUnknownAge } from '../../domain/views';
import type { Activity, Child, Home, Profile, UpdateStatus } from '../../domain/types';
import { kindLabel, NO_KIND } from '../../domain/kind';
import type { ListAudience } from '../../domain/views';
import { addMonths, formatDateTime } from '../../domain/dates';
import { fmtChecked } from '../components/DetailSheet';
import { Sheet } from '../components/Sheet';
import { lookupAddress } from '../geocode';
import { IconInfo } from '../components/Icons';
import { useRef, useState, type ReactNode } from 'react';
import { formatShortDate } from '../../domain/dates';

/** Instellingen: alleen wat nu nodig is — de kinderen en de status van de bronnen. */
export function SettingsSheet({
  profile,
  setProfile,
  today,
  status,
  generatedAt,
  activities,
  initialTab = 'gezin',
  onClose,
}: {
  initialTab?: 'gezin' | 'soorten' | 'verversing';
  activities: Activity[];
  profile: Profile;
  setProfile: (p: Profile) => void;
  today: string;
  status?: UpdateStatus;
  generatedAt?: string;
  onClose: () => void;
}) {
  const p = profile;
  const [tab, setTab] = useState<'gezin' | 'soorten' | 'verversing'>(initialTab);
  const hidden = p.hiddenKinds ?? { kinderen: [], volwassenen: [] };
  const kindsFor = (aud: ListAudience) =>
    [...new Set(activities.filter((a) => (aud === 'kinderen' ? a.audiences.some((x) => x !== 'volwassenen') : a.audiences.includes('volwassenen'))).map(kindLabel))].filter((k) => k !== 'Voorlezen' && k !== NO_KIND).sort((x, y) =>
      x.localeCompare(y, 'nl'),
    );
  const [peek, setPeek] = useState<{ aud: ListAudience; label: string; kinds: string[] } | null>(null);
  const examplesFor = (aud: ListAudience, kinds: string[]) => {
    const seen = new Set<string>();
    return activities
      .filter((a) => !a.isTestData && dateOf(a.end ?? a.start) >= today && (aud === 'kinderen' ? a.audiences.some((x) => x !== 'volwassenen') : a.audiences.includes('volwassenen')))
      .filter((a) => kinds.includes(kindLabel(a)))
      .sort((x, y) => (x.start < y.start ? -1 : 1))
      .filter((a) => !seen.has(a.title) && seen.add(a.title));
  };
  const toggleKind = (aud: ListAudience, k: string) => {
    const cur = hidden[aud];
    setProfile({ ...p, hiddenKinds: { ...hidden, [aud]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } });
  };
  const addChild = () =>
    setProfile({
      ...p,
      children: [...p.children, { id: `kind${Date.now()}`, name: '', birthDate: addMonths(today, -36) }],
    });
  const removeChild = (i: number) => setProfile({ ...p, children: p.children.filter((_, j) => j !== i) });
  const setChild = (i: number, patch: Partial<Child>) =>
    setProfile({ ...p, children: p.children.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <Sheet title="Instellingen" onClose={onClose}>
      <div className="settings">
        <div className="audience-tabs settings-tabs" role="tablist" aria-label="Instellingen">
          {(
            [
              ['gezin', 'Gezin'],
              ['soorten', 'Interesses'],
              ['verversing', 'Bronnen'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'gezin' && (
          <>
        <section className="settings-block" aria-labelledby="set-kids">
          <h3 id="set-kids">Kinderen</h3>
          <p className="small muted">
            Met een geboortedatum rekent de app de leeftijd uit op de dag van elke activiteit. Alles blijft op deze telefoon.
          </p>
          {p.children.map((c, i) => {
            return (
              <div key={c.id} className="child-row">
                <label htmlFor={`child-name-${i}`}>
                  Naam
                  <input id={`child-name-${i}`} type="text" value={c.name} maxLength={20} placeholder={`Kind ${i + 1}`} onChange={(e) => setChild(i, { name: e.target.value })} />
                </label>
                <label htmlFor={`child-birth-${i}`}>
                  Geboortedatum
                  <input
                    id={`child-birth-${i}`}
                    type="date"
                    value={c.birthDate}
                    max={today}
                    onChange={(e) => e.target.value && setChild(i, { birthDate: e.target.value, birthDateEstimated: false })}
                  />
                </label>
                <button className="text-btn small child-remove" onClick={() => removeChild(i)}>
                  Verwijderen
                </button>
              </div>
            );
          })}
          {p.children.length === 0 && <p className="small muted">Geen kinderen ingevuld: de Kinderen-lijst toont dan alles, zonder leeftijdscheck.</p>}
          <button className="btn add-child" onClick={addChild}>
            + Kind toevoegen
          </button>
        </section>

        <HomeBlock home={p.home} onChange={(home) => setProfile({ ...p, home })} nearbyKm={p.nearbyKm ?? DEFAULT_NEARBY_KM} onNearby={(nearbyKm) => setProfile({ ...p, nearbyKm })} />
          </>
        )}

        {tab === 'soorten' && (
          <section className="settings-block">
            <label className="check">
              <input type="checkbox" checked={!!p.showAlways} onChange={(e) => setProfile({ ...p, showAlways: e.target.checked })} /> Vaste uitjes tonen
            </label>
            <p className="small muted">Een extra tabblad met plekken waar je altijd heen kunt: musea, kinderboerderijen, speeltuinen, zwembaden.</p>
          </section>
        )}
        {tab === 'soorten' && (['volwassenen', 'kinderen'] as const).map((aud) => (
          <section key={aud} className="settings-block" aria-labelledby={`set-kinds-${aud}`}>
            <h3 id={`set-kinds-${aud}`}>Wat wil je zien bij {aud === 'kinderen' ? 'Kinderen' : 'Volwassenen'}?</h3>
            <p className="small muted">Tik om aan of uit te zetten. Houd een label ingedrukt voor voorbeelden.</p>
            <div className="chip-wrap">
              {kindsFor(aud)
                .filter((k) => !k.startsWith('Concert'))
                .map((k) => {
                  const off = hidden[aud].includes(k);
                  return (
                    <PressChip key={k} off={off} onTap={() => toggleKind(aud, k)} onHold={() => setPeek({ aud, label: k, kinds: [k] })}>
                      {k}
                    </PressChip>
                  );
                })}
            </div>
            {(() => {
              // Concerten: één chip voor alles, met de genres eronder.
              const concerts = kindsFor(aud).filter((k) => k.startsWith('Concert'));
              if (!concerts.length) return null;
              const allOff = concerts.every((k) => hidden[aud].includes(k));
              const setAll = (off: boolean) =>
                setProfile({
                  ...p,
                  hiddenKinds: { ...hidden, [aud]: off ? [...new Set([...hidden[aud], ...concerts])] : hidden[aud].filter((x) => !concerts.includes(x)) },
                });
              return (
                <div className="concert-set">
                  <PressChip off={allOff} onTap={() => setAll(!allOff)} onHold={() => setPeek({ aud, label: 'Concert', kinds: concerts })}>
                    Concert
                  </PressChip>
                  <div className="chip-wrap genre-wrap">
                    {concerts.map((k) => {
                      const off = hidden[aud].includes(k);
                      return (
                        <PressChip key={k} className="genre-chip" off={off} onTap={() => toggleKind(aud, k)} onHold={() => setPeek({ aud, label: k, kinds: [k] })}>
                          {k === 'Concert' ? 'Zonder genre' : k.slice('Concert · '.length)}
                        </PressChip>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>
        ))}

        {peek &&
          (() => {
            const list = examplesFor(peek.aud, peek.kinds);
            return (
              <div className="peek-backdrop" onClick={() => setPeek(null)}>
                <div className="peek" role="dialog" aria-label={`Voorbeelden ${peek.label}`} onClick={(e) => e.stopPropagation()}>
                  <h3>
                    {peek.label} <span className="num count">{list.length}</span>
                  </h3>
                  <p className="small muted">Voorbeelden bij {peek.aud === 'kinderen' ? 'Kinderen' : 'Volwassenen'}</p>
                  <ul>
                    {list.slice(0, 6).map((a) => (
                      <li key={a.id}>
                        <strong>{a.title}</strong>
                        <span className="small muted">
                          {a.venue.name}
                          {!a.rolling && ` · ${formatShortDate(dateOf(a.start) < today ? today : dateOf(a.start))}`}
                        </span>
                      </li>
                    ))}
                    {!list.length && <li className="small muted">Op dit moment niets.</li>}
                  </ul>
                  <div className="peek-actions">
                    <button className="btn" onClick={() => setPeek(null)}>
                      Sluiten
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        {tab === 'verversing' && !status && <p className="small muted">Nog geen informatie over de updates.</p>}
        {tab === 'verversing' && status && (
          <section className="settings-block" aria-labelledby="set-status">
            <h3 id="set-status">Bronnen en updates</h3>
            <p>
              {status.lastSuccessfulRun ? (
                <>
                  Laatste geslaagde update: <strong>{formatDateTime(status.lastSuccessfulRun)}</strong> ({fmtChecked(status.lastSuccessfulRun, today)}).
                </>
              ) : (
                'Nog geen geslaagde update.'
              )}{' '}
              De agenda wordt elke nacht automatisch bijgewerkt.
            </p>
            {generatedAt && <p className="small muted">{status.totals.active} activiteiten in de dataset.</p>}
            <p className="small muted">App-versie van {formatDateTime(__APP_BUILD__)}{__APP_COMMIT__ ? ` (${__APP_COMMIT__})` : ''}</p>
            <ul className="source-list">
              {status.sources
                .filter((s) => s.enabled)
                .map((s) => {
                  const pending = !s.lastAttempt;
                  return (
                    <li key={s.sourceId} className={pending ? 'is-pending' : s.ok ? 'is-ok' : 'is-bad'}>
                      <span className="source-state" aria-hidden="true" />
                      <div>
                        {s.sourceId === 'handmatig' ? (
                          <ManualSource activities={activities} today={today} />
                        ) : (
                          <strong>{s.sourceName}</strong>
                        )}
                        <div className="small">
                          {pending
                            ? 'Nog niet automatisch opgehaald; gebeurt bij de eerstvolgende nachtelijke update'
                            : s.ok
                              ? `${s.fetched} activiteiten, gelukt ${s.lastSuccess ? fmtChecked(s.lastSuccess, today) : ''}`
                              : `Mislukt bij laatste poging${s.lastSuccess ? `; gegevens van ${fmtChecked(s.lastSuccess, today)} blijven staan` : ''}${s.error ? ` (${s.error})` : ''}`}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
            <KidsHidden activities={activities} today={today} />
          </section>
        )}
      </div>
    </Sheet>
  );
}

/** Thuisadres voor de afstanden in de lijst. */
export const DEFAULT_NEARBY_KM = 5;

const kmLabel = (km: number) => `${String(km).replace('.', ',')} km`;

/** Schuifbalk 0,5–10 km in stappen van 0,5, met een schakelaar om het uit te zetten. */
function NearbySetting({ km, onChange }: { km: number; onChange: (km: number) => void }) {
  const [last, setLast] = useState(km || DEFAULT_NEARBY_KM);
  const on = km > 0;
  return (
    <div className="nearby-set">
      <div className="nearby-head">
        <label className="check">
          <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? last : 0)} /> Dichtbij markeren
        </label>
        {on && <span className="nearby-value num">tot {kmLabel(km)}</span>}
      </div>
      {on && (
        <>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={km}
            aria-label="Dichtbij tot (km)"
            onChange={(e) => {
              const v = Number(e.target.value);
              setLast(v);
              onChange(v);
            }}
          />
          <div className="nearby-scale small muted num">
            <span>0,5 km</span>
            <span>10 km</span>
          </div>
        </>
      )}
    </div>
  );
}

function HomeBlock({ home, onChange, nearbyKm, onNearby }: { home?: Home; onChange: (h?: Home) => void; nearbyKm: number; onNearby: (km: number) => void }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const h = await lookupAddress(q.trim());
      if (h) {
        onChange(h);
        setQ('');
      } else setMsg('Adres niet gevonden. Probeer straat + huisnummer + plaats, of een postcode.');
    } catch {
      setMsg('Zoeken lukte niet. Controleer je verbinding.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="settings-block" aria-labelledby="set-home">
      <h3 id="set-home">Adres voor afstanden</h3>
      {home ? (
        <p>
          Afstanden vanaf <strong>{home.label}</strong>.{' '}
          <button className="text-btn small" onClick={() => onChange(undefined)}>
            Wissen
          </button>
        </p>
      ) : (
        <p className="small muted">Nog geen adres: de lijst toont dan geen afstanden.</p>
      )}
      <form
        className="home-form"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label htmlFor="home-q" className="sr-only">
          Adres of postcode
        </label>
        <input id="home-q" type="text" value={q} placeholder="Straat 1, Utrecht of 3541 AA" autoComplete="street-address" onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="submit" disabled={busy || !q.trim()}>
          {busy ? 'Zoeken…' : home ? 'Wijzig' : 'Zoek'}
        </button>
      </form>
      {msg && <p className="small banner-warn">{msg}</p>}
      {home && <NearbySetting km={nearbyKm} onChange={onNearby} />}
      <p className="small muted">Het adres blijft op deze telefoon. Voor het opzoeken gaat het eenmalig naar PDOK (Kadaster).</p>
    </section>
  );
}

/** "Alternatief verzameld" met een (i) die toont welke bronnen er via deze weg in de app komen. */
function ManualSource({ activities, today }: { activities: Activity[]; today: string }) {
  const [open, setOpen] = useState(false);
  const groups = new Map<string, { n: number; last: string }>();
  for (const a of activities) {
    for (const s of a.sources) {
      if (s.sourceId !== 'handmatig') continue;
      const g = groups.get(s.sourceName) ?? { n: 0, last: '' };
      g.n++;
      if (s.lastChecked > g.last) g.last = s.lastChecked;
      groups.set(s.sourceName, g);
    }
  }
  const list = [...groups.entries()].sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0], 'nl'));
  return (
    <>
      <span className="source-name-row">
        <strong>Alternatief verzameld</strong>
        <button className="info-btn" aria-expanded={open} aria-label="Welke bronnen?" onClick={() => setOpen(!open)}>
          <IconInfo size={18} />
        </button>
      </span>
      {open && (
        <div className="small source-info">
          <p>
            Bronnen die de nachtelijke update niet zelf kan ophalen. Ze zijn bij de officiële bron opgezocht en vastgelegd; Tivoli en
            Leidsche Rijn Centrum worden elke dinsdag opnieuw opgehaald.
          </p>
          <ul>
            {list.map(([name, g]) => (
              <li key={name}>
                <strong>{name}</strong>: {g.n} activiteit{g.n === 1 ? '' : 'en'}, gecontroleerd {fmtChecked(g.last, today)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/** Controlelijst: wat bij Kinderen niet getoond wordt omdat de leeftijd ontbreekt (en de bron ook volwassenen noemt). */
function KidsHidden({ activities, today }: { activities: Activity[]; today: string }) {
  const [open, setOpen] = useState(false);
  const seen = new Set<string>();
  const list = activities
    .filter((a) => !a.isTestData && dateOf(a.end ?? a.start) >= today && kidHiddenForUnknownAge(a))
    .sort((x, y) => (x.start < y.start ? -1 : 1))
    .filter((a) => !seen.has(a.title.toLowerCase()) && seen.add(a.title.toLowerCase()));
  if (!list.length) return null;
  return (
    <div className="kids-hidden small">
      <span className="source-name-row">
        <span>
          Niet getoond bij Kinderen (geen leeftijd): <strong className="num">{list.length}</strong>
        </span>
        <button className="info-btn" aria-expanded={open} aria-label="Toon de lijst" onClick={() => setOpen(!open)}>
          <IconInfo size={18} />
        </button>
      </span>
      {open && (
        <ul className="kids-hidden-list">
          {list.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.title}
              </a>{' '}
              <span className="muted">· {a.sources[0].sourceName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Label-chip: tikken zet aan of uit, ingedrukt houden toont voorbeelden. */
function PressChip({ off, onTap, onHold, className = '', children }: { off: boolean; onTap: () => void; onHold: () => void; className?: string; children: ReactNode }) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const start = () => {
    held.current = false;
    timer.current = window.setTimeout(() => {
      held.current = true;
      onHold();
    }, 450);
  };
  const stop = () => window.clearTimeout(timer.current);
  return (
    <button
      className={`kind-chip ${className} ${off ? 'is-off' : ''}`}
      aria-pressed={!off}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) held.current = false;
        else onTap();
      }}
    >
      {children}
    </button>
  );
}
