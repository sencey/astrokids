import { useEffect, useRef, useState } from 'react';
import Ball from './Ball';
import type { RoomId } from './useBalls';

/** Day dots: no text, filled = played, ring = today. */
export function DayDots({ total, index }: { total: number; index: number }) {
  return (
    <div className="dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`dots__dot ${i < index ? 'dots__dot--done' : i === index ? 'dots__dot--now' : ''}`} />
      ))}
    </div>
  );
}

interface RainProps {
  total: number;
  pass: number;
  focus: 'house' | 'wide';
}
/** Sparkle rain: `pass` sparkles reach the crew (and the jar); the rest bounce off. */
export function SparkleRain({ total, pass, focus }: RainProps) {
  return (
    <div className="rain" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const passes = Math.floor(((i + 1) * pass) / Math.max(total, 1)) > Math.floor((i * pass) / Math.max(total, 1));
        const left = focus === 'house' ? 66 + ((i * 37) % 26) : 6 + ((i * 53) % 88);
        return (
          <span
            key={i}
            className={`rain__p ${passes ? '' : 'rain__p--bounce'}`}
            style={{
              left: `${left}%`,
              animationDelay: `${(i % 6) * 0.22 + Math.floor(i / 6) * 0.1}s`,
              ['--drop' as string]: 'clamp(160px, 38vh, 330px)',
              ['--side' as string]: `${(i % 2 ? 1 : -1) * (30 + (i % 4) * 14)}px`,
            }}
          />
        );
      })}
    </div>
  );
}

interface PoolProps {
  free: number[];
  selected: number | null;
  setSelected: (i: number | null) => void;
  place: (i: number, room: RoomId) => boolean;
  ballLabel: string;
}
/** The balls Pati has brought. Hover state is lifted so rooms can highlight. */
export function BallPool({ free, selected, setSelected, place, ballLabel, onHover }: PoolProps & { onHover: (r: RoomId | null) => void }) {
  return (
    <div className="pool">
      {free.map((i) => (
        <Ball key={i} index={i} selected={selected === i} label={ballLabel} onSelect={setSelected} onDrop={place} onHover={onHover} />
      ))}
    </div>
  );
}

/**
 * Inactivity help: after 6 s repeat a shorter instruction, after 12 s show the ghost hand.
 * `resetKey` restarts the timers (e.g. when the step changes). Any pointerdown also restarts.
 */
export function useIdleHelp(active: boolean, resetKey: unknown, onShort: () => void) {
  const [ghost, setGhost] = useState(false);
  const short = useRef(onShort);
  short.current = onShort;
  useEffect(() => {
    setGhost(false);
    if (!active) return;
    let t1 = 0;
    let t2 = 0;
    const arm = () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setGhost(false);
      t1 = window.setTimeout(() => short.current(), 6000);
      t2 = window.setTimeout(() => setGhost(true), 12000);
    };
    arm();
    window.addEventListener('pointerdown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [active, resetKey]);
  return ghost;
}
