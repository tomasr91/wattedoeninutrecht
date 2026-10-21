import type { Activity, Child, Home, Profile, UpdateStatus } from '../../domain/types';
import { kindLabel } from '../../domain/kind';
import type { ListAudience } from '../../domain/views';
import { addMonths, formatDateTime } from '../../domain/dates';
import { fmtChecked } from '../components/DetailSheet';
import { Sheet } from '../components/Sheet';
import { lookupAddress } from '../geocode';
import { useState } from 'react';

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
    [...new Set(activities.filter((a) => (aud === 'kinderen' ? a.audiences.some((x) => x !== 'volwassenen') : a.audiences.includes('volwassenen'))).map(kindLabel))].sort((x, y) =>
      x.localeCompare(y, 'nl'),
    );
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
              ['verversing', 'Updates'],
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

        <HomeBlock home={p.home} onChange={(home) => setProfile({ ...p, home })} />
          </>
        )}

        {tab === 'soorten' && (['volwassenen', 'kinderen'] as const).map((aud) => (
          <section key={aud} className="settings-block" aria-labelledby={`set-kinds-${aud}`}>
            <h3 id={`set-kinds-${aud}`}>Soorten bij {aud === 'kinderen' ? 'Kinderen' : 'Volwassenen'}</h3>
            <p className="small muted">Tik om een soort te verbergen of weer te tonen. Doorgestreept = verborgen.</p>
            <div className="chip-wrap">
              {kindsFor(aud).map((k) => {
                const off = hidden[aud].includes(k);
                return (
                  <button key={k} className={`kind-chip ${off ? 'is-off' : ''}`} aria-pressed={!off} onClick={() => toggleKind(aud, k)}>
                    {k}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

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
            <p className="small muted">App-versie: {formatDateTime(__APP_BUILD__)}{__APP_COMMIT__ ? ` (${__APP_COMMIT__})` : ''}</p>
            <ul className="source-list">
              {status.sources
                .filter((s) => s.enabled)
                .map((s) => {
                  const pending = !s.lastAttempt;
                  return (
                    <li key={s.sourceId} className={pending ? 'is-pending' : s.ok ? 'is-ok' : 'is-bad'}>
                      <span className="source-state" aria-hidden="true" />
                      <div>
                        <strong>{s.sourceName}</strong>
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
          </section>
        )}
      </div>
    </Sheet>
  );
}

/** Thuisadres voor de afstanden in de lijst. */
function HomeBlock({ home, onChange }: { home?: Home; onChange: (h?: Home) => void }) {
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
      <p className="small muted">Het adres blijft op deze telefoon. Voor het opzoeken gaat het eenmalig naar PDOK (Kadaster).</p>
    </section>
  );
}
