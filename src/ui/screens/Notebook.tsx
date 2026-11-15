import { useApp } from '../AppContext';
import { biggestFlare, fmtUtc } from '../scene/skyMath';
import type { ScenarioDay } from '../../game/types';

type DayExt = ScenarioDay & { alarmKind?: 'measured' | 'model' | null; alertOngoing?: boolean };

/** Captain-only data notebook: the day's real numbers, each tagged ARCHIVE with its source. */
export default function Notebook({ day, evening, onClose }: { day: ScenarioDay; evening: boolean; onClose: () => void }) {
  const { t, lang } = useApp();
  const d = day as DayExt;
  const flares = [...d.flares].sort((a, b) => Date.parse(a.peakTime) - Date.parse(b.peakTime));
  const top = biggestFlare(d.flares);
  const archive = <span className="badge badge--archive">{t('badge.archive')}</span>;
  const src = d.provenance.map((p) => `${p.sourceId}: ${p.sourceUrl}`);

  return (
    <div className="overlay notebook" role="dialog" aria-modal="true" aria-label={t('notebook')}>
      <div className="notebook__page">
        <div className="notebook__head">
          <h2>{t('notebook')} · {d.date}</h2>
          <button type="button" className="btn btn--round" aria-label={t('close')} onClick={onClose} autoFocus>
            ✕
          </button>
        </div>
        <section>
          <h3>{t('nb.flares')} {archive}</h3>
          <p>
            {top && <strong>{t('nb.biggest')}: {top.classType} · {fmtUtc(top.peakTime, lang)}</strong>}
          </p>
          <ul className="notebook__list notebook__list--cols">
            {flares.map((f) => (
              <li key={f.peakTime}>{f.classType} · {fmtUtc(f.peakTime, lang)}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t('nb.forecast')} {archive}</h3>
          {d.forecasts.length === 0 && <p>{t('nb.none')}</p>}
          <ul className="notebook__list">
            {d.forecasts.map((f) => (
              <li key={f.simulationId}>
                {f.estShockArrivalEarth ? (
                  <>
                    {t('nb.arrival')}: {fmtUtc(f.estShockArrivalEarth, lang)} (±7 h) · Kp {f.kp90 ?? '–'}–{f.kp180 ?? '–'}
                  </>
                ) : (
                  <>{t('nb.noEarth')}</>
                )}
                <small> · {f.simulationId}</small>
              </li>
            ))}
          </ul>
        </section>
        {evening ? (
          <>
            <section>
              <h3>{t('nb.sep')} {archive}</h3>
              <ul className="notebook__list">
                {d.sepEvents.length === 0 && <li>{t('nb.none')}</li>}
                {d.sepEvents.map((s) => (
                  <li key={s.eventTime + s.instrument}>{fmtUtc(s.eventTime, lang)} · {s.instrument}</li>
                ))}
              </ul>
              {d.alarmAt && (
                <p>
                  {t('nb.alarm')}: {fmtUtc(d.alarmAt, lang)} ·{' '}
                  <em>{d.alarmKind === 'model' ? t('nb.model') : t('nb.measured')}</em>
                </p>
              )}
              {d.alertOngoing && <p>{t('nb.ongoing')}</p>}
            </section>
            <section>
              <h3>{t('nb.shock')} {archive}</h3>
              <ul className="notebook__list">
                {d.shocks.length === 0 && <li>{t('nb.none')}</li>}
                {d.shocks.map((s) => (
                  <li key={s.eventTime}>{fmtUtc(s.eventTime, lang)} · {s.location}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3>{t('nb.band')} {archive}</h3>
              <p>
                {d.sparkleRatio !== null ? `×${d.sparkleRatio} ` : '– '}
                {d.radInstrument ? `(${d.radInstrument}, ${t('nb.vsQuiet')})` : ''}
                {d.bandIsAssumption ? ` · ${t('nb.assumed')}` : ''}
              </p>
            </section>
          </>
        ) : (
          <p className="notebook__later">{t('nb.later')}</p>
        )}
        <section>
          <h3>{t('nb.sources')}</h3>
          <ul className="notebook__list notebook__src">
            {src.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
