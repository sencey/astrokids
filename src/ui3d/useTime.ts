import { useCallback, useEffect, useState } from 'react';
import type { MutableRefObject } from 'react';
import { CONFIG } from '../three/config';
import type { TimeState } from '../three/Sky';

/** Time lives in a ref (read by the 3D loop every frame); React state only mirrors it for the sliders. */
export function useTime(ref: MutableRefObject<TimeState>, dayCount: number) {
  const [disp, setDisp] = useState({ day: ref.current.day, hour: Math.floor(ref.current.hour) });
  const [playing, setPlaying] = useState(false);
  const sync = useCallback(() => setDisp({ day: Math.floor(ref.current.day), hour: Math.floor(ref.current.hour) }), [ref]);

  const set = useCallback(
    (day: number, hour: number) => {
      ref.current = { day: Math.max(0, Math.min(dayCount - 1, day)), hour: Math.max(0, Math.min(23.99, hour)) };
      sync();
    },
    [ref, dayCount, sync],
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let { day, hour } = ref.current;
      hour += (dt * 24) / CONFIG.secondsPerDayPlay;
      while (hour >= 24) {
        hour -= 24;
        day = (day + 1) % dayCount;
      }
      ref.current = { day, hour };
      if (now - lastUi > 120) {
        lastUi = now;
        sync();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, dayCount, ref, sync]);

  return { disp, playing, setPlaying, set };
}
