import type { Activity, Child, Profile, UpdateStatus } from '../../domain/types';
import { kindLabel } from '../../domain/kind';
import type { ListAudience } from '../../domain/views';
import { ageOnDate, birthDateFromAge, formatAge } from '../../domain/age';
import { formatLongDate } from '../../domain/dates';
import { BIKE_MAX_KM } from '../../domain/views';
import { fmtChecked } from '../components/DetailSheet';
import { Sheet } from '../components/Sheet';

/** Instellingen: alleen wat nu nodig is — de kinderen en de status van de bronnen. */
export function SettingsSheet({
  profile,
  setProfile,
  today,
  status,
  generatedAt,
  activities,
  onClose,
}: {
  activities: Activity[];
  profile: Profile;
  setProfile: (p: Profile) => void;
  today: string;
  status?: UpdateStatus;
  generatedAt?: string;
  onClose: () => void;
}) {
  const p = profile;
  const hidden = p.hiddenKinds ?? { kinderen: [], volwassenen: [] };
  const kindsFor = (aud: ListAudience) =>
    [...new Set(activities.filter((a) => (aud === 'kinderen' ? a.audiences.some((x) => x !== 'volwassenen') : a.audiences.includes('volwassenen'))).map(kindLabel))].sort((x, y) =>
      x.localeCompare(y, 'nl'),
    );
  const toggleKind = (aud: ListAudience, k: string) => {
    const cur = hidden[aud];
    setProfile({ ...p, hiddenKinds: { ...hidden, [aud]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } });
  };
  const setChild = (i: number, patch: Partial<Child>) =>
    setProfile({ ...p, children: p.children.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <Sheet title="Gezin en bronnen" onClose={onClose}>
      <div className="settings">
        <section className="settings-block" aria-labelledby="set-kids">
          <h3 id="set-kids">Kinderen</h3>
          <p className="small muted">
            Met een geboortedatum rekent de app de leeftijd uit op de dag van elke activiteit. Alles blijft op deze telefoon.
          </p>
          {p.children.map((c, i) => {
            const age = ageOnDate(c.birthDate, today);
            return (
              <div key={c.id} className="child-row">
                <label htmlFor={`child-name-${i}`}>
                  Naam
                  <input id={`child-name-${i}`} type="text" value={c.name} maxLength={20} onChange={(e) => setChild(i, { name: e.target.value || `Kind ${i + 1}` })} />
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
                <label htmlFor={`child-age-${i}`}>
                  Of leeftijd (jaar)
                  <input
                    id={`child-age-${i}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={17}
                    step={0.5}
                    value={Math.round((age.totalMonths / 12) * 2) / 2}
                    onChange={(e) => {
                      const yrs = Number(e.target.value.replace(',', '.'));
                      if (Number.isFinite(yrs) && yrs >= 0) setChild(i, { birthDate: birthDateFromAge(Math.round(yrs * 12), today), birthDateEstimated: true });
                    }}
                  />
                </label>
                <p className="small child-age">
                  Nu {formatAge(age)}
                  {c.birthDateEstimated && ' · geboortedatum geschat uit leeftijd'}
                </p>
              </div>
            );
          })}
        </section>

        {(['volwassenen', 'kinderen'] as const).map((aud) => (
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

        <section className="settings-block" aria-labelledby="set-rules">
          <h3 id="set-rules">Hoe de lijst werkt</h3>
          <ul className="plain-list small">
            <li>Fietsafstand: alles in Leidsche Rijn en de stad Utrecht, plus wat binnen {BIKE_MAX_KM} km van Leidsche Rijn Centrum ligt.</li>
            <li>Dit weekend en Volgend weekend: zaterdag en zondag. Bij Volwassenen telt ook de vrijdagavond mee (vanaf 18:00).</li>
            <li>Bij Kinderen verdwijnt wat voor allebei te jong of te oud is. Voorlezen wordt niet getoond.</li>
            <li>Komt eraan: jaarlijkse momenten (Koningsdag, intochten, kerst in Leidsche Rijn Centrum, festivals) die binnen acht weken vallen maar nog niet in de agenda staan.</li>
            <li>Doorlopend: exposities, speurtochten en alles wat twee weken of langer loopt. Veeg opzij (of tik op "Doorlopend") om ze te zien.</li>
          </ul>
        </section>

        {status && (
          <section className="settings-block" aria-labelledby="set-status">
            <h3 id="set-status">Bronnen en updates</h3>
            <p>
              {status.lastSuccessfulRun ? (
                <>
                  Laatste geslaagde update: <strong>{formatLongDate(status.lastSuccessfulRun.slice(0, 10))}</strong> ({fmtChecked(status.lastSuccessfulRun, today)}).
                </>
              ) : (
                'Nog geen geslaagde update.'
              )}{' '}
              De agenda wordt elke maandagochtend automatisch bijgewerkt.
            </p>
            {generatedAt && <p className="small muted">{status.totals.active} activiteiten in de dataset.</p>}
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
                            ? 'Nog niet automatisch opgehaald; gebeurt bij de eerstvolgende wekelijkse update'
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
