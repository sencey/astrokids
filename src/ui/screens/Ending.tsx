import { useEffect, useRef, useState } from 'react';
import { earnedBadges } from '../../game/badges';
import type { BadgeId } from '../../game/badges';
import { forecastErrorMinutes, formatHoursMinutes, guessErrorHours, matchShock, summary } from '../../game/mission';
import { getConfig } from '../../game/rules';
import type { MissionState } from '../../game/types';
import { lineText } from '../../i18n/lines';
import type { LineId } from '../../i18n/lines';
import type { UiKey } from '../../i18n/ui';
import { addRun } from '../../storage/store';
import { useApp } from '../AppContext';
import { compare, scenario } from '../data/loadScenario';
import type { CompareInstrument } from '../data/loadScenario';
import Pati from '../pati/Pati';
import { Bowl, Jar, SampleRocks } from '../scene/Art';
import { fmtUtc } from '../scene/skyMath';
import { MapIcon, RetryIcon } from './icons';
import './ending.css';

const BADGE_KEY: Record<BadgeId, UiKey> = {
  patientGuard: 'badge.patientGuard',
  braveExplorer: 'badge.braveExplorer',
  masterGardener: 'badge.masterGardener',
  goodForecaster: 'badge.goodForecaster',
};

/** Screen 9: "What really happened?" Three swipeable panels. */
export default function Ending({ mission, onRetry, onMap }: { mission: MissionState; onRetry: () => void; onMap: () => void }) {
  const { t, say, stopVoice, mode, captionsOn, lang } = useApp();
  const captain = mode === 'captain';
  const cfg = getConfig(mode);
  const [idx, setIdx] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const sum = summary(mission);
  const badges = earnedBadges(mission);

  useEffect(() => {
    void addRun({
      at: new Date().toISOString(),
      scenario: scenario.id,
      mode,
      outcome: mission.outcome,
      summary: { daysPlayed: sum.daysPlayed, totalSparkles: sum.totalSparkles, samples: sum.samples, resupplies: sum.resupplies, daysSheltered: sum.daysSheltered },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ids: LineId[] = [
      idx === 0 ? 'end.week' : idx === 1 ? 'end.reality' : captain ? 'end.lesson.captain' : 'end.lesson.playmate',
    ];
    let alive = true;
    void (async () => {
      if ((await say(ids[0])) && alive && idx === 2 && captain) await say('end.which');
    })();
    return () => {
      alive = false;
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const n = Math.max(0, Math.min(2, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    setIdx(n);
  };

  // ---- forecast vs reality ----
  const played = mission.days.slice(0, mission.results.length);
  const all = played.flatMap((d) => d.forecasts).filter((f) => !!f.estShockArrivalEarth);
  const guessed = mission.forecastGuess ? all.find((f) => f.simulationId === mission.forecastGuess!.simulationId) : undefined;
  const withError = all.find((f) => forecastErrorMinutes(mission.days, f.estShockArrivalEarth!) !== null);
  const fc = guessed ?? withError ?? all[0];
  const est = fc?.estShockArrivalEarth ?? null;
  const err = est ? forecastErrorMinutes(mission.days, est) : null;
  const actual = est ? matchShock(mission.days, est) : null;
  const gErr = guessErrorHours(mission);

  return (
    <main className="screen ending">
      <div className="ending__swipe" ref={scroller} onScroll={(e) => {
        const el = e.currentTarget;
        setIdx(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
      }}>
        {/* 1: your week */}
        <section className="ending__panel" aria-label={t('end.week')}>
          {captain && <h2>{t('end.week')}</h2>}
          <div className="week">
            <div className="week__item"><Jar count={mission.jar} capacity={cfg.jarCapacity} label={t('jar')} /></div>
            <div className="week__item week__bowls">
              <Bowl kind="water" level={mission.water} max={cfg.tankMax} label={t('room.water')} />
              <Bowl kind="food" level={mission.garden} max={cfg.tankMax} label={t('room.garden')} />
            </div>
            <div className="week__item week__rocks"><SampleRocks count={mission.samples} /></div>
            <div className="patch" role="img" aria-label={t('patch')}>
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="56" fill="#1c2e66" stroke="var(--accent)" strokeWidth="6" strokeDasharray="6 4" />
                <circle cx="60" cy="60" r="44" fill="#0e1a3d" />
                <ellipse cx="60" cy="64" rx="12" ry="10" fill="var(--accent-soft)" />
                <circle cx="46" cy="50" r="5" fill="var(--accent-soft)" /><circle cx="56" cy="42" r="5" fill="var(--accent-soft)" />
                <circle cx="68" cy="42" r="5" fill="var(--accent-soft)" /><circle cx="78" cy="50" r="5" fill="var(--accent-soft)" />
              </svg>
              <div className="patch__badges">
                {badges.map((b) => (
                  <span key={b} className={`pbadge pbadge--${b}`} title={t(BADGE_KEY[b])}>
                    <BadgeIcon id={b} />
                    {captain && <small>{t(BADGE_KEY[b])}</small>}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {mission.outcome === 'earlyReturn' && captain && <p className="ending__note">{t('ending.early')}</p>}
          <Pati pose={mission.outcome === 'earlyReturn' ? 'sleepy' : 'proud'} outfit={captain ? 'headset' : 'none'} label={t('pati')} className="ending__pati" />
        </section>

        {/* 2: reality */}
        <section className="ending__panel" aria-label={t('end.reality')}>
          <h2>{t('end.reality')} <span className="badge badge--archive">{t('badge.archive')}</span> <small>{scenario.startDate.slice(0, 7)}</small></h2>
          {compare.instruments.length > 0 ? (
            <div className="jars4">
              {compare.instruments.map((c) => <RatioJar key={c.instrument} c={c} />)}
            </div>
          ) : (
            import.meta.env.DEV && <p className="ending__note">{t('end.moreData')}</p>
          )}
          {compare.instruments.length > 0 && <p className="ending__note">{t('end.ownQuiet')}</p>}
          <div className="fcard">
            {fc && est ? (
              <>
                <p>
                  {t('end.forecast')} <strong>{fmtUtc(est, lang)}</strong>
                  {actual && err !== null ? (
                    <>
                      {' '}— {t('end.arrived')} <strong>{fmtUtc(actual, lang)}</strong> ({formatHoursMinutes(err)} {err >= 0 ? t('end.late') : t('end.early')})
                    </>
                  ) : (
                    <> — {t('end.neverCame')}</>
                  )}
                </p>
                {mission.forecastGuess && gErr !== null && (
                  <p>{t('end.yourGuess')} <strong>{fmtUtc(mission.forecastGuess.guessedArrival, lang)}</strong> ({gErr.toFixed(1)} h)</p>
                )}
              </>
            ) : (
              <p>{t('end.noForecast')}</p>
            )}
          </div>
        </section>

        {/* 3: the lesson */}
        <section className="ending__panel ending__lesson" aria-label={t('end.lesson')}>
          <Pati pose="proud" outfit={captain ? 'headset' : 'none'} label={t('pati')} />
          {(captain || captionsOn) && (
            <blockquote>{lineText(captain ? 'end.lesson.captain' : 'end.lesson.playmate', lang)}</blockquote>
          )}
          {captain && <p className="ending__which">{t('end.which')}</p>}
          <div className="ending__buttons">
            <button type="button" className="btn btn--accent" aria-label={t('retry')} onPointerDown={() => { stopVoice(); onRetry(); }}>
              <RetryIcon /> {captain && t('retry')}
            </button>
            <button type="button" className="btn" aria-label={t('map')} onPointerDown={() => { stopVoice(); onMap(); }}>
              <MapIcon /> {captain && t('map')}
            </button>
          </div>
        </section>
      </div>

      <div className="ending__nav">
        <button type="button" className="btn btn--round btn--ghost" aria-label={t('prev')} disabled={idx === 0} onPointerDown={() => goTo(idx - 1)}>‹</button>
        <div className="dots" aria-hidden="true">
          {[0, 1, 2].map((i) => <span key={i} className={`dots__dot ${i === idx ? 'dots__dot--now' : ''}`} />)}
        </div>
        <button type="button" className="btn btn--round btn--ghost" aria-label={t('nextPanel')} disabled={idx === 2} onPointerDown={() => goTo(idx + 1)}>›</button>
      </div>
    </main>
  );
}


const PLACE_KEY: Record<CompareInstrument['place'], UiKey> = {
  iss: 'place.iss',
  lunarOrbit: 'place.lunarOrbit',
  deepSpace: 'place.deepSpace',
  marsSurface: 'place.marsSurface',
};

/** One jar per detector, filled relative to that detector's OWN quiet day (log scale, quiet day = dashed line). */
function RatioJar({ c }: { c: CompareInstrument }) {
  const { t } = useApp();
  const quiet = 0.14;
  const fill = Math.min(1, quiet + (1 - quiet) * (Math.log10(Math.max(c.ratio, 1)) / Math.log10(400)));
  const h = 70 * fill;
  const rise = c.ratio < 1.5;
  return (
    <figure className="rjar">
      <svg viewBox="0 0 90 100" role="img" aria-label={`${t(PLACE_KEY[c.place])}: ×${c.ratio}`}>
        <path d="M22 6 H68 Q80 10 80 30 V84 Q80 96 68 96 H22 Q10 96 10 84 V30 Q10 10 22 6 Z" fill="var(--glass)" stroke="#dfeaff" strokeWidth="3" />
        <clipPath id={`rj-${c.place}`}><path d="M12 30 V84 Q12 94 22 94 H68 Q78 94 78 84 V30 Z" /></clipPath>
        <rect x="10" y={94 - h} width="70" height={h} fill="var(--spark)" opacity="0.9" clipPath={`url(#rj-${c.place})`} />
        <line x1="10" x2="80" y1={94 - 70 * quiet} y2={94 - 70 * quiet} stroke="#fff" strokeWidth="2" strokeDasharray="4 3" />
      </svg>
      <figcaption>
        <strong>{rise ? t('end.noRise') : `×${Math.round(c.ratio)}`}</strong>
        <span>{t(PLACE_KEY[c.place])}</span>
        <small>{c.instrument}</small>
      </figcaption>
    </figure>
  );
}

function BadgeIcon({ id }: { id: BadgeId }) {
  const paths: Record<BadgeId, JSX.Element> = {
    patientGuard: <path d="M20 4 L34 10 V22 Q34 32 20 38 Q6 32 6 22 V10 Z" fill="var(--accent-soft)" />,
    braveExplorer: <path d="M6 34 L16 12 L24 24 L30 16 L36 34 Z" fill="#b8bccb" />,
    masterGardener: <path d="M20 36 V18 M20 22 Q8 22 8 10 Q20 10 20 22 M20 24 Q32 24 32 12 Q20 12 20 24" stroke="#74d27d" strokeWidth="4" fill="none" strokeLinecap="round" />,
    goodForecaster: <g><circle cx="20" cy="20" r="14" fill="none" stroke="#c9b8ff" strokeWidth="4" /><path d="M20 11 V20 L26 24" stroke="#c9b8ff" strokeWidth="4" fill="none" strokeLinecap="round" /></g>,
  };
  return <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">{paths[id]}</svg>;
}
