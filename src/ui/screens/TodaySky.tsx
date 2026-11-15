import { useEffect, useState } from 'react';
import { engine } from '../../audio/engine';
import { formatHoursMinutes } from '../../game/mission';
import { getSkyGuesses, saveSkyGuess } from '../../storage/store';
import type { SkyGuess } from '../../storage/store';
import { useApp } from '../AppContext';
import { liveRuleHolds, loadLive, matchLiveShock, pickEarthCme } from '../data/live';
import type { LiveResult } from '../data/live';
import Pati from '../pati/Pati';
import SkyTrack from '../scene/SkyTrack';
import { biggestFlare, cloudState, fmtUtc } from '../scene/skyMath';
import { BackIcon, PawIcon } from './icons';
import './sky.css';

const H = 3_600_000;
const D = 24 * H;
const dayStart = (ms: number) => Math.floor(ms / D) * D;

/** Screen 10: Today's Sky (LIVE). No resource simulation: just the newest Earth-directed CME and a guess. */
export default function TodaySky({ onBack }: { onBack: () => void }) {
  const { t, lang, mode, say, instruct, stopVoice, repeatShort } = useApp();
  const captain = mode === 'captain';
  const [res, setRes] = useState<LiveResult | null>(null);
  const [guesses, setGuesses] = useState<SkyGuess[] | null>(null);
  const [hours, setHours] = useState(24);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    void loadLive().then((r) => alive && setRes(r));
    void getSkyGuesses().then((g) => alive && setGuesses(g));
    return () => {
      alive = false;
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = res?.status === 'ok' ? res.data : null;
  const isLive = data ? liveRuleHolds(data, now) : false;
  const cme = data ? pickEarthCme(data, now) : null;
  const est = cme?.enlil?.estShockArrivalEarth ?? null;
  const mine = cme && guesses ? guesses.find((g) => g.activityId === cme.activityId) : undefined;
  const shock = data && est ? matchLiveShock(data, est) : null;
  const neverCame = !!est && !shock && now > Date.parse(est) + D;

  // Spoken line once everything is known.
  useEffect(() => {
    if (!res || !guesses) return;
    if (res.status !== 'ok') void say('sky.offline');
    else if (!cme) void say('sky.calm');
    else if (!mine) void instruct('sky.guess', 'sky.guess.hint');
    else if (shock) void say('sky.result');
    else if (neverCame) void say('sky.never');
    else void say('sky.later');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, guesses, !!cme, !!mine]);

  const save = async (guessMs: number) => {
    if (!cme || !est) return;
    const g: SkyGuess = { activityId: cme.activityId, estimate: est, guess: new Date(guessMs).toISOString(), madeAt: new Date().toISOString(), mode };
    engine.sfx('chime');
    await saveSkyGuess(g);
    setGuesses(await getSkyGuesses());
  };

  const cloud = cme && est ? cloudState(now, cme.startTime, est) : null;
  const guessFrac = (iso: string | number) => {
    if (!cme || !est) return null;
    const e = Date.parse(est);
    const s = Date.parse(cme.startTime);
    return Math.min(1, Math.max(0, (Number(typeof iso === 'string' ? Date.parse(iso) : iso) - s) / (e - s)));
  };
  const sliderMs = Math.round(now / H) * H + hours * H;
  const recentFlare = data ? biggestFlare(data.flares.filter((f) => now - Date.parse(f.peakTime) <= 3 * D)) : null;
  const updated = data ? fmtUtc(data.generatedAt, lang) : null;

  // Older guesses whose shock already arrived.
  const past = (guesses ?? [])
    .filter((g) => g.activityId !== cme?.activityId)
    .map((g) => ({ g, actual: data ? matchLiveShock(data, g.estimate) : null }))
    .filter((x) => x.actual);

  const result = (g: SkyGuess, actual: string) => {
    const diffMin = Math.round((Date.parse(actual) - Date.parse(g.guess)) / 60000);
    return (
      <div className="sky-card" key={g.activityId}>
        <p>{t('sky.yourGuess')}: <strong>{fmtUtc(g.guess, lang)}</strong></p>
        <p>{t('sky.arrived')}: <strong>{fmtUtc(actual, lang)}</strong> · {formatHoursMinutes(diffMin)} {diffMin >= 0 ? t('end.late') : t('end.early')}</p>
      </div>
    );
  };

  return (
    <main className="screen skyscreen">
      <div className="stage__hud">
        <div className="hud__side">
          <button type="button" className="btn btn--round btn--ghost" aria-label={t('back')} onPointerDown={() => { stopVoice(); onBack(); }}>
            <BackIcon />
          </button>
        </div>
        <div className="hud__side hud__side--end">
          {captain && isLive && <span className="badge badge--live">{t('badge.live')}</span>}
        </div>
      </div>

      <SkyTrack
        ariaLabel={t('sky')}
        flareClass={recentFlare?.classType}
        cloud={cloud}
        calm={!cme}
        guessAt={mine ? guessFrac(mine.guess) : cme && captain ? guessFrac(sliderMs) : null}
        label={captain && est ? <>≈ {fmtUtc(est, lang)} ±7 h</> : undefined}
      />

      <div className="skyscreen__body">
        <Pati
          pose={!res || res.status !== 'ok' ? 'worried' : cme ? 'alert' : 'happy'}
          outfit={captain ? 'headset' : 'none'}
          label={t('pati')}
          onTap={() => { engine.sfx('bark'); repeatShort(); }}
          glowCollar={!!cme}
        />
        <div className="skyscreen__panel">
          {res && res.status !== 'ok' && <p className="sky-card">{t('sky.offlineText')}</p>}
          {data && !cme && (
            <p className="sky-card">
              {captain ? t('sky.calmText') : ''}
              {captain && recentFlare ? ` ${t('sky.lastFlare')}: ${recentFlare.classType}` : ''}
            </p>
          )}
          {cme && guesses && !mine && !captain && (
            <div className="daypick" role="group" aria-label={t('sky.guess')}>
              {[0, 1, 2].map((n) => (
                <button key={n} type="button" className="btn daypick__btn" aria-label={t(n === 0 ? 'day.today' : n === 1 ? 'day.tomorrow' : 'day.after')}
                  onPointerDown={() => void save(dayStart(now) + n * D + 12 * H)}>
                  <svg viewBox="0 0 60 60" width="56" height="56" aria-hidden="true">
                    <circle cx="30" cy="30" r="14" fill="#ffb938" />
                    {Array.from({ length: n + 1 }, (_, i) => <circle key={i} cx={30 + (i - n / 2) * 14} cy="52" r="4" fill="var(--ink)" />)}
                  </svg>
                </button>
              ))}
            </div>
          )}
          {cme && guesses && !mine && captain && (
            <div className="sky-card">
              <p>{t('sky.guess')}</p>
              <p className="guess__time">{fmtUtc(new Date(sliderMs).toISOString(), lang)}</p>
              <input type="range" className="guess__range" min={0} max={96} step={1} value={hours} aria-label={t('sky.guess')} onChange={(e) => setHours(Number(e.target.value))} />
              <button type="button" className="btn btn--accent" onClick={() => void save(sliderMs)}><PawIcon /> {t('guess.confirm')}</button>
            </div>
          )}
          {cme && mine && (
            <>
              {shock ? result(mine, shock) : (
                <p className="sky-card">{neverCame ? t('sky.neverText') : captain ? t('sky.laterText') : ''}</p>
              )}
            </>
          )}
          {past.map((x) => result(x.g, x.actual!))}
          {updated && <p className="sky-updated">{t('updated')} {updated}{isLive && <> · <span className="badge badge--live">{t('badge.live')}</span></>}</p>}
        </div>
      </div>
    </main>
  );
}
