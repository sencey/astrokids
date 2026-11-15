import { useCallback, useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { applyDay, currentDay, isFinished, setForecastGuess, startMission } from '../../game/mission';
import { RULES, getConfig } from '../../game/rules';
import type { DayResult, MissionState, Mode, ScenarioDay } from '../../game/types';
import type { LineId } from '../../i18n/lines';
import { useApp } from '../AppContext';
import { setDebug } from '../dev/debug';
import { scenario } from '../data/loadScenario';
import Pati from '../pati/Pati';
import type { PatiPose } from '../pati/Pati';
import { Jar } from '../scene/Art';
import GhostHand from '../scene/GhostHand';
import { BallPool, DayDots, SparkleRain, useIdleHelp } from '../scene/parts';
import SkyTrack from '../scene/SkyTrack';
import Stage from '../scene/Stage';
import { biggestFlare, cloudState, fmtUtc, noonUtc } from '../scene/skyMath';
import { useBalls } from '../scene/useBalls';
import type { RoomId } from '../scene/useBalls';
import Notebook from './Notebook';
import { BackIcon, BookIcon, PawIcon } from './icons';
import './day.css';

type Phase = 'morning' | 'distribute' | 'alarm' | 'settle' | 'result' | 'early';
type DayExt = ScenarioDay & { alertOngoing?: boolean };
type Forecast = ScenarioDay['forecasts'][number] & { estShockArrivalEarth: string };

/** The forecast shown in the morning: the nearest upcoming ENLIL arrival, else the most recent one. */
function pickForecast(day: ScenarioDay): Forecast | null {
  const noon = noonUtc(day.date);
  const withEst = day.forecasts.filter((f): f is Forecast => !!f.estShockArrivalEarth);
  if (withEst.length === 0) return null;
  const upcoming = withEst
    .filter((f) => Date.parse(f.estShockArrivalEarth) >= noon - 12 * 3_600_000)
    .sort((a, b) => Date.parse(a.estShockArrivalEarth) - Date.parse(b.estShockArrivalEarth));
  return upcoming[0] ?? withEst.sort((a, b) => Date.parse(b.estShockArrivalEarth) - Date.parse(a.estShockArrivalEarth))[0];
}

interface Props {
  mode: Mode;
  onExit: () => void;
  onFinish: (final: MissionState) => void;
}

/** Screens 5-8: one scene, phases: Sniff -> Distribute -> (Alarm) -> Result. */
export default function DayScreen({ mode, onExit, onFinish }: Props) {
  const { t, lang, say, instruct, replay, repeatShort, stopVoice } = useApp();
  const cfg = getConfig(mode);
  const captain = mode === 'captain';

  const [mission, setMission] = useState<MissionState>(() => startMission(scenario, mode));
  const missionRef = useRef(mission);
  missionRef.current = mission;
  const [phase, setPhase] = useState<Phase>('morning');
  const [sniffed, setSniffed] = useState(false);
  const [pose, setPose] = useState<PatiPose>('happy');
  const [bark, setBark] = useState(0);
  const [crewInside, setCrewInside] = useState(false);
  const [view, setView] = useState({ water: cfg.tankStart, garden: cfg.tankStart, wall: cfg.wallStart, jar: 0, samples: 0 });
  const [played, setPlayed] = useState<{ day: ScenarioDay; result: DayResult } | null>(null);
  const [step, setStep] = useState(0);
  const [guessOpen, setGuessOpen] = useState(false);
  const [guessHours, setGuessHours] = useState(48);
  const [notebook, setNotebook] = useState(false);
  const [warned, setWarned] = useState(false);
  const [crate, setCrate] = useState(false);
  const [alarmLeft, setAlarmLeft] = useState<number>(RULES.common.alarmWindowSeconds.value);
  const [hover, setHover] = useState<RoomId | null>(null);
  const [jarPulse, setJarPulse] = useState(false);
  const choice = useRef<{ loc: 'inside' | 'outside'; tapped: boolean }>({ loc: 'outside', tapped: false });

  const balls = useBalls(cfg.ballsPerDay);
  const countsRef = useRef(balls.counts);
  countsRef.current = balls.counts;

  const live = phase === 'result' || phase === 'early';
  const day: ScenarioDay | null = live ? played?.day ?? null : currentDay(mission) ?? played?.day ?? null;
  const dayIdx = live ? Math.max(0, mission.cursor - 1) : mission.cursor;
  const dayExt = day as DayExt | null;
  const forecast = day ? pickForecast(day) : null;
  const top = day ? biggestFlare(day.flares) : null;

  useEffect(() => {
    setDebug({ step: phase === 'result' ? `result:${step}` : phase, dayIndex: dayIdx });
  }, [phase, step, dayIdx]);
  useEffect(() => () => setDebug({ step: null, dayIndex: null }), []);

  // ---------- Morning ----------
  useEffect(() => {
    if (phase !== 'morning' || !day) return;
    setPose(dayExt?.alertOngoing ? 'alert' : 'happy');
    void instruct('day.sniff', 'day.sniff.hint');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dayIdx]);

  const sniff = () => {
    if (sniffed || phase !== 'morning' || !day) return;
    engine.sfx('bark');
    setBark((b) => b + 1);
    setSniffed(true);
    const soon = forecast && Date.parse(forecast.estShockArrivalEarth) - noonUtc(day.date) < 72 * 3_600_000;
    const alert = !!dayExt?.alertOngoing || !!soon || top?.classType.startsWith('X') === true;
    setPose(alert ? 'alert' : 'happy');
  };

  useEffect(() => {
    if (phase !== 'morning' || !sniffed || !day) return;
    let alive = true;
    const lines: LineId[] = [];
    if (top?.classType.startsWith('X')) lines.push('day.sniff.big');
    else if (top?.classType.startsWith('M')) lines.push('day.sniff.small');
    lines.push(dayExt?.alertOngoing ? 'day.sniff.ongoing' : forecast ? 'day.sniff.alert' : 'day.sniff.calm');
    void (async () => {
      for (const id of lines) {
        if (!alive || !(await say(id))) return;
      }
      if (!alive) return;
      if (captain && forecast && !missionRef.current.forecastGuess) {
        setGuessOpen(true);
        void instruct('day.guess', 'day.guess.hint');
      } else if (!captain) {
        setPhase('distribute');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sniffed, phase, dayIdx]);

  const confirmGuess = () => {
    if (!day || !forecast) return;
    const iso = new Date(noonUtc(day.date) + guessHours * 3_600_000).toISOString();
    setMission((m) => setForecastGuess(m, forecast.simulationId, iso));
    engine.sfx('chime');
    setGuessOpen(false);
    setPose('proud');
  };

  // ---------- Distribute ----------
  useEffect(() => {
    if (phase !== 'distribute') return;
    setPose('happy');
    void (async () => {
      const ok = await instruct('day.distribute', 'day.distribute.hint');
      if (ok && dayIdx === 0) await instruct('day.door', 'day.distribute.hint');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dayIdx]);

  const toggleDoor = () => {
    if (phase !== 'distribute') return;
    engine.sfx('pop');
    setCrewInside((c) => !c);
  };

  const needsAlarm = !!day?.alarmAt && !dayExt?.alertOngoing;

  const busy = useRef(false);
  const resolve = (tapped: boolean) => {
    if (busy.current) return;
    busy.current = true;
    const m = missionRef.current;
    const d = currentDay(m);
    if (!d) return;
    const c = countsRef.current;
    choice.current.tapped = tapped;
    const { nextState, result } = applyDay(m, {
      balls: { water: c.water, garden: c.garden, wall: c.wall },
      location: choice.current.loc,
      alarmTappedInTime: tapped,
    });
    setMission(nextState);
    setPlayed({ day: d, result });
    setView((v) => ({ ...v, wall: result.wallLevel }));
    setStep(0);
    setPhase('result');
  };
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  const confirm = () => {
    if (phase !== 'distribute') return;
    if (balls.free.length > 0 && !warned) {
      setWarned(true);
      engine.sfx('ding');
      void say('day.leftover');
      return;
    }
    engine.sfx('pop');
    const loc = crewInside ? 'inside' : 'outside';
    choice.current = { loc, tapped: false };
    if (needsAlarm && loc === 'outside') setPhase('alarm');
    else resolve(false);
  };

  // ---------- Alarm ----------
  useEffect(() => {
    if (phase !== 'alarm') return;
    setPose('alert');
    engine.sfx('bark');
    void instruct('day.alarm', 'day.alarm.hint');
    if (!captain) return; // playmate: untimed
    let left: number = RULES.common.alarmWindowSeconds.value;
    setAlarmLeft(left);
    const id = window.setInterval(() => {
      left -= 1;
      setAlarmLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        void say('day.alarm.late');
        setPhase('settle');
        window.setTimeout(() => resolveRef.current(false), 1200);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const alarmTap = useCallback(() => {
    if (phase !== 'alarm') return;
    engine.sfx('whoosh');
    setCrewInside(true);
    void say('day.alarm.ok');
    setPhase('settle'); // leaves the alarm effect (clears the timer); resolves right below
    window.setTimeout(() => resolveRef.current(true), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------- Result ----------
  useEffect(() => {
    if (phase !== 'result' || !played) return;
    const { result } = played;
    let timer = 0;
    if (step === 0) {
      engine.sfx('sparkle');
      if (result.exposure !== 'exposed' && result.wallLevel > 0) window.setTimeout(() => engine.sfx('thud'), 900);
      timer = window.setTimeout(() => setStep(1), 3600);
    } else if (step === 1) {
      setView({ water: result.waterAfter, garden: result.gardenAfter, wall: result.wallLevel, jar: result.jarAfter, samples: missionRef.current.samples });
      setJarPulse(true);
      engine.sfx('bubble');
      const resup = result.resupplied.water || result.resupplied.garden;
      if (resup) {
        setCrate(true);
        engine.sfx('crate');
        void say('resupply');
        window.setTimeout(() => setCrate(false), 2400);
      }
      timer = window.setTimeout(() => setStep(2), resup ? 3000 : 2200);
    } else {
      setJarPulse(false);
      const low = result.waterAfter <= Math.ceil(cfg.tankMax * 0.2);
      const worried = result.exposure === 'exposed' && result.band !== 'calm';
      setPose(low ? 'sleepy' : worried ? 'worried' : result.band === 'calm' ? 'happy' : 'proud');
      void (async () => {
        const first = result.band === 'calm' ? 'result.calm' : result.exposure === 'exposed' ? 'result.exposed' : 'result.sheltered';
        if (!(await say(first))) return;
        if (low) {
          if (!(await say('result.sleepy'))) return;
        } else if (choice.current.loc === 'outside') {
          if (!(await say(result.sampleGained ? 'result.sample' : 'result.nosample'))) return;
        }
        void instruct('day.confirm', 'day.confirm.hint');
      })();
    }
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, step, played]);

  const next = () => {
    const m = missionRef.current;
    engine.sfx('pop');
    if (m.outcome === 'earlyReturn') {
      setPhase('early');
      return;
    }
    if (isFinished(m)) {
      stopVoice();
      onFinish(m);
      return;
    }
    balls.reset(cfg.ballsPerDay);
    busy.current = false;
    setSniffed(false);
    setCrewInside(false);
    setWarned(false);
    setGuessOpen(false);
    setPhase('morning');
  };

  useEffect(() => {
    if (phase !== 'early') return;
    setPose('sleepy');
    let alive = true;
    void (async () => {
      await say('early');
      await new Promise((r) => window.setTimeout(r, 1500));
      if (alive) onFinish(missionRef.current);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------- Idle help ----------
  const helpActive = (phase === 'morning' && !guessOpen) || phase === 'distribute' || phase === 'alarm' || (phase === 'result' && step === 2);
  const ghost = useIdleHelp(helpActive && !notebook, `${phase}-${dayIdx}-${sniffed}-${step}`, repeatShort);
  let ghostEl = null;
  if (ghost) {
    if (phase === 'morning') ghostEl = <GhostHand to={sniffed ? '.confirm' : '.pati__collar'} />;
    else if (phase === 'distribute')
      ghostEl = balls.free.length > 0 ? <GhostHand from=".pool .ball" to='[data-room="water"]' /> : <GhostHand to=".confirm" />;
    else if (phase === 'alarm') ghostEl = <GhostHand to=".door" />;
    else if (phase === 'result') ghostEl = <GhostHand to=".confirm" />;
  }

  // ---------- Render ----------
  const lowWater = view.water <= Math.ceil(cfg.tankMax * 0.2);
  const shownPose: PatiPose = lowWater && (pose === 'happy' || pose === 'proud') && phase !== 'alarm' ? 'sleepy' : pose;
  const cloud = sniffed && day && forecast ? cloudState(noonUtc(day.date), forecast.cmeStart, forecast.estShockArrivalEarth) : null;
  const guessAt = (() => {
    if (!guessOpen || !day || !forecast) return null;
    const est = Date.parse(forecast.estShockArrivalEarth);
    const start = forecast.cmeStart ? Date.parse(forecast.cmeStart) : est - 48 * 3_600_000;
    return Math.min(1, Math.max(0, (noonUtc(day.date) + guessHours * 3_600_000 - start) / (est - start)));
  })();

  const showPaw =
    (phase === 'morning' && sniffed && !guessOpen) ||
    phase === 'distribute' ||
    (phase === 'result' && step === 2);
  const goDistribute = () => {
    engine.sfx('pop');
    setPhase('distribute');
  };
  const pawAction = phase === 'distribute' ? confirm : phase === 'morning' ? goDistribute : next;

  const onRoomTap = (room: RoomId) => {
    if (phase === 'alarm') {
      if (room === 'wall') alarmTap();
      return;
    }
    if (phase === 'distribute') balls.tapRoom(room);
  };

  if (!day) return null;
  const inDistribute = phase === 'distribute';

  return (
    <main className="screen dayscreen">
      <Stage
        hud={
          <>
            <div className="hud__side">
              <button type="button" className="btn btn--round btn--ghost" aria-label={t('back')} onPointerDown={() => { stopVoice(); onExit(); }}>
                <BackIcon />
              </button>
              {captain && (
                <button type="button" className="btn btn--round btn--ghost" aria-label={t('notebook')} onPointerDown={() => setNotebook(true)}>
                  <BookIcon />
                </button>
              )}
            </div>
            <div className="hud__center">
              <DayDots total={mission.days.length} index={dayIdx} />
              {captain && <span className="hud__date">{fmtUtc(`${day.date}T00:00:00Z`, lang).replace(/ 00:00 UTC$/, '')}</span>}
            </div>
            <div className="hud__side hud__side--end">
              {showPaw && (
                <button type="button" className="btn btn--accent confirm" aria-label={t('next')} onPointerDown={pawAction}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pawAction(); } }}>
                  <PawIcon />
                </button>
              )}
              <div className="hud__jar">
                <Jar count={view.jar} capacity={cfg.jarCapacity} label={t('jar')} pulse={jarPulse} />
              </div>
            </div>
          </>
        }
        sky={
          <SkyTrack
            ariaLabel={t('sky')}
            flareClass={sniffed ? top?.classType : null}
            cloud={cloud}
            guessAt={guessAt}
            calm={!sniffed}
            label={
              captain && sniffed && forecast ? (
                <span className="clock">
                  <ClockIcon /> â‰ˆ {fmtUtc(forecast.estShockArrivalEarth, lang)} Â±7 h
                </span>
              ) : undefined
            }
          />
        }
        pati={
          <>
            <Pati
              pose={shownPose}
              outfit={captain ? 'headset' : 'none'}
              label={t('pati')}
              onTap={() => { engine.sfx('bark'); setBark((b) => b + 1); replay(); }}
              onCollar={phase === 'morning' ? sniff : undefined}
              collarLabel={t('collar')}
              glowCollar={(phase === 'morning' && !sniffed) || phase === 'alarm'}
              barkKey={bark}
            />
            {inDistribute && (
              <BallPool free={balls.free} selected={balls.selected} setSelected={balls.setSelected} place={balls.place} ballLabel={t('ball')} onHover={setHover} />
            )}
          </>
        }
        water={view.water}
        garden={view.garden}
        tankMax={cfg.tankMax}
        wall={view.wall}
        crewInside={crewInside}
        sampleBag={view.samples > 0}
        assigned={inDistribute ? balls.counts : { water: 0, garden: 0, wall: 0 }}
        armed={inDistribute && balls.selected !== null}
        hover={hover}
        glow={phase === 'alarm' ? 'door' : null}
        onRoomTap={phase === 'distribute' || phase === 'alarm' ? onRoomTap : undefined}
        onDoor={phase === 'distribute' ? toggleDoor : phase === 'alarm' ? alarmTap : undefined}
        solarVisible
      >
        {phase === 'result' && played && step === 0 && (
          <SparkleRain total={played.result.baseSparkle} pass={played.result.dose} focus={choice.current.loc === 'inside' ? 'house' : 'wide'} />
        )}
        {phase === 'result' && step < 2 && (
          <button type="button" className="overlay overlay--tap" aria-label={t('skip')} onPointerDown={() => setStep((s) => Math.min(2, s + 1))} />
        )}
        {phase === 'alarm' && (
          <div className="overlay overlay--alarm" aria-live="assertive">
            {captain && (
              <div className="paw-timer" role="timer" aria-label={t('timer')}>
                {Array.from({ length: RULES.common.alarmWindowSeconds.value }, (_, i) => (
                  <span key={i} className={`paw-timer__paw ${i >= alarmLeft ? 'paw-timer__paw--off' : ''}`} />
                ))}
              </div>
            )}
          </div>
        )}
        {crate && (
          <div className="overlay overlay--clear" aria-hidden="true">
            <svg className="crate" viewBox="0 0 120 110">
              <path d="M60 0 Q20 -4 12 40 H108 Q100 -4 60 0 Z" fill="#fff" opacity="0.9" />
              <rect x="22" y="44" width="76" height="60" rx="8" fill="#b57a3c" stroke="#6b4528" strokeWidth="4" />
              <path d="M22 62 H98 M60 44 V104" stroke="#6b4528" strokeWidth="4" />
            </svg>
          </div>
        )}
        {phase === 'early' && (
          <div className="overlay" aria-hidden="true">
            <svg className="rocket" viewBox="0 0 80 140" width="120">
              <path d="M40 4 Q64 30 62 84 H18 Q16 30 40 4 Z" fill="#f4f4fa" stroke="#aab" strokeWidth="3" />
              <circle cx="40" cy="48" r="10" fill="#243061" />
              <path d="M18 70 L2 100 L18 90 Z M62 70 L78 100 L62 90 Z" fill="var(--accent)" />
              <path d="M28 90 Q40 130 52 90 Z" fill="#ffd36a" />
            </svg>
          </div>
        )}
        {guessOpen && day && forecast && (
          <div className="overlay overlay--guess" role="dialog" aria-label={t('guess.title')}>
            <div className="guess">
              <h2>{t('guess.title')}</h2>
              <p className="guess__time">{fmtUtc(new Date(noonUtc(day.date) + guessHours * 3_600_000).toISOString(), lang)}</p>
              <input
                type="range"
                className="guess__range"
                min={0}
                max={96}
                step={1}
                value={guessHours}
                aria-label={t('guess.title')}
                onChange={(e) => setGuessHours(Number(e.target.value))}
              />
              <button type="button" className="btn btn--accent" onClick={confirmGuess}>
                <PawIcon /> {t('guess.confirm')}
              </button>
            </div>
          </div>
        )}
        {notebook && <Notebook day={day} evening={phase === 'result' && step >= 1} onClose={() => setNotebook(false)} />}
      </Stage>
      {ghostEl}
    </main>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ verticalAlign: '-2px' }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 6 V12 L16 14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

