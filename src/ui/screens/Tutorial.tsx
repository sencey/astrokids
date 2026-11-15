import { useCallback, useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { getConfig } from '../../game/rules';
import { useApp } from '../AppContext';
import { setDebug } from '../dev/debug';
import Pati from '../pati/Pati';
import type { PatiPose } from '../pati/Pati';
import { Jar } from '../scene/Art';
import GhostHand from '../scene/GhostHand';
import { BallPool, SparkleRain, useIdleHelp } from '../scene/parts';
import SkyTrack from '../scene/SkyTrack';
import Stage from '../scene/Stage';
import { useBalls } from '../scene/useBalls';
import type { RoomId } from '../scene/useBalls';
import { FrameAnim, FrameStill } from './FrameArt';
import './tutorial.css';

type Step = 'intro' | 'frame' | 'frameAnim' | 'panel' | 'fetch' | 'water' | 'garden' | 'wall' | 'alarm' | 'rain' | 'end';

const cfg = getConfig('playmate');
const DRAG_ROOM: Partial<Record<Step, RoomId>> = { water: 'water', garden: 'garden', wall: 'wall' };

/** Screen 2: about 88 s, cannot fail. A long-press on Pati skips it from the 2nd launch on. */
export default function Tutorial({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const { t, instruct, say, replay, repeatShort, seenTutorial } = app;
  const [step, setStep] = useState<Step>('intro');
  const stepRef = useRef<Step>('intro');
  const [pose, setPose] = useState<PatiPose>('happy');
  const [bark, setBark] = useState(0);
  const [water, setWater] = useState(cfg.tankStart);
  const [garden, setGarden] = useState(cfg.tankStart);
  const [wall, setWall] = useState(0);
  const [jar, setJar] = useState(0);
  const [crewInside, setCrewInside] = useState(false);
  const [droop, setDroop] = useState(0);
  const [fetched, setFetched] = useState(0);
  const [hover, setHover] = useState<RoomId | null>(null);
  const [jarPulse, setJarPulse] = useState(false);

  const go = useCallback((s: Step) => {
    stepRef.current = s;
    setStep(s);
  }, []);

  const balls = useBalls(3, {
    accept: (room) => DRAG_ROOM[stepRef.current] === room,
    onAssign: (room) => {
      if (room === 'water') {
        engine.sfx('bubble');
        setWater((w) => Math.min(cfg.tankMax, w + 1));
        window.setTimeout(() => go('garden'), 900);
      } else if (room === 'garden') {
        engine.sfx('chime');
        setGarden((g) => Math.min(cfg.tankMax, g + 1));
        window.setTimeout(() => go('wall'), 900);
      } else {
        engine.sfx('thud');
        setWall(1);
        setPose('happy');
        window.setTimeout(() => go('alarm'), 1100);
      }
    },
  });

  const active = step !== 'frameAnim' && step !== 'fetch' && step !== 'rain' && step !== 'end';
  const ghost = useIdleHelp(active, step, repeatShort);

  useEffect(() => {
    setDebug({ step, dayIndex: null });
    return () => setDebug({ step: null });
  }, [step]);

  // Step scripts. Each step is cancelled if the child moves on.
  useEffect(() => {
    let live = true;
    const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
    const run = async () => {
      switch (step) {
        case 'intro':
          setPose('happy');
          await instruct('tut.intro', 'tut.intro.hint');
          break;
        case 'frame':
          await instruct('tut.frame', 'tut.frame.hint');
          break;
        case 'frameAnim': {
          engine.sfx('chime');
          setBark((b) => b + 1);
          const spoke = say('tut.frame.done');
          await wait(5200);
          await spoke;
          if (live) go('panel');
          break;
        }
        case 'panel':
          await instruct('tut.panel', 'tut.panel.hint');
          break;
        case 'fetch': {
          const speech = say('tut.fetch');
          for (let i = 1; i <= 3 && live; i++) {
            await wait(600);
            if (!live) return;
            engine.sfx('pop');
            setFetched(i);
          }
          await speech;
          if (live) go('water');
          break;
        }
        case 'water':
          await instruct('tut.water', 'tut.drag.hint');
          break;
        case 'garden':
          await instruct('tut.garden', 'tut.drag.hint');
          break;
        case 'wall':
          await instruct('tut.wall', 'tut.drag.hint');
          break;
        case 'alarm':
          setPose('alert');
          engine.sfx('bark');
          await instruct('tut.alarm', 'tut.alarm.hint');
          break;
        case 'rain': {
          engine.sfx('whoosh');
          await wait(900);
          if (!live) return;
          engine.sfx('sparkle');
          await wait(1800);
          if (!live) return;
          engine.sfx('thud');
          setJar(2);
          setJarPulse(true);
          setPose('proud');
          await wait(1800);
          if (live) go('end');
          break;
        }
        case 'end': {
          setDroop(0.5);
          setPose('worried');
          await say('tut.end');
          if (!live) return;
          await wait(500);
          if (live) onDone();
          break;
        }
      }
    };
    void run();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const patiTap = () => {
    engine.sfx('bark');
    setBark((b) => b + 1);
    if (stepRef.current === 'intro') {
      window.setTimeout(() => stepRef.current === 'intro' && go('frame'), 700);
    } else {
      replay();
    }
  };

  const doorOrWall = () => {
    if (stepRef.current !== 'alarm') return;
    engine.sfx('whoosh');
    setCrewInside(true);
    go('rain');
  };

  const onRoomTap = (room: RoomId) => {
    if (room === 'wall' && stepRef.current === 'alarm') doorOrWall();
    else balls.tapRoom(room);
  };

  const dragStep = DRAG_ROOM[step];
  const glow =
    step === 'panel' ? 'solar' : step === 'alarm' ? 'door' : dragStep ?? null;
  const visibleFree = balls.free.slice(0, fetched);

  let ghostEl = null;
  if (ghost) {
    if (step === 'intro') ghostEl = <GhostHand to=".pati__main" />;
    else if (step === 'frame') ghostEl = <GhostHand to=".tut-frame" />;
    else if (step === 'panel') ghostEl = <GhostHand to=".solar" />;
    else if (dragStep) ghostEl = <GhostHand from=".pool .ball" to={`[data-room="${dragStep}"]`} />;
    else if (step === 'alarm') ghostEl = <GhostHand to=".door" />;
  }

  return (
    <main className="screen tutorial">
      <Stage
        hud={
          <>
            <div className="hud__side" />
            <div className="hud__side hud__side--end">
              <div className="hud__jar">
                <Jar count={jar} capacity={cfg.jarCapacity} label={t('jar')} pulse={jarPulse} />
              </div>
            </div>
          </>
        }
        sky={
          <SkyTrack
            ariaLabel={t('sky')}
            calm={step !== 'alarm' && step !== 'rain'}
            flareClass={step === 'alarm' || step === 'rain' ? 'M5.0' : null}
            cloud={step === 'alarm' || step === 'rain' ? { progress: step === 'rain' ? 0.8 : 0.5, widthFrac: 0.3 } : null}
          />
        }
        pati={
          <>
            <Pati
              pose={pose}
              label={t('pati')}
              onTap={patiTap}
              onLongPress={seenTutorial ? () => { app.stopVoice(); onDone(); } : undefined}
              barkKey={bark}
              glowCollar={step === 'alarm'}
            />
            <BallPool
              free={visibleFree}
              selected={balls.selected}
              setSelected={balls.setSelected}
              place={balls.place}
              ballLabel={t('ball')}
              onHover={setHover}
            />
          </>
        }
        water={water}
        garden={garden}
        tankMax={cfg.tankMax}
        wall={wall}
        droop={droop}
        crewInside={crewInside}
        assigned={balls.counts}
        armed={balls.selected !== null}
        hover={hover}
        glow={glow}
        onRoomTap={onRoomTap}
        onDoor={step === 'alarm' ? doorOrWall : undefined}
        onSolar={step === 'panel' ? () => go('fetch') : undefined}
        solarVisible={step !== 'intro' && step !== 'frame' && step !== 'frameAnim'}
      >
        {(step === 'frame' || step === 'frameAnim') && (
          <div className="overlay">
            {step === 'frame' ? (
              <button type="button" className="tut-frame" aria-label={t('frame')} onPointerDown={() => go('frameAnim')}>
                <FrameStill />
              </button>
            ) : (
              <div className="tut-anim">
                <FrameAnim />
              </div>
            )}
          </div>
        )}
        {step === 'rain' && <SparkleRain total={6} pass={2} focus="house" />}
      </Stage>
      {ghostEl}
    </main>
  );
}

