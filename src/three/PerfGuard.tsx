import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { getTier, getTierSpec, stepDownTier } from './config';

const SHOW_FPS = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fps');
/** Ignore the first seconds (shader compile, texture upload) and the seconds after a step (new shadow map, new mesh). */
const WARMUP_S = 5;
const SETTLE_S = 4;
const LOW_FPS = 30;
const LOW_SECONDS = 3;

/**
 * Adaptive quality + dev FPS overlay (`?fps`). Lives inside the main Canvas.
 * Counts frames in 1 s windows; 3 windows in a row under 30 fps = step the quality tier down once
 * (high -> medium -> low), then wait SETTLE_S before judging again. Forced with ?tier=... = never steps.
 * Frames longer than 0.5 s (hidden tab, debugger pause) are ignored.
 */
export function PerfGuard() {
  const gl = useThree((s) => s.gl);
  const st = useRef({ t: 0, frames: 0, warm: WARMUP_S, bad: 0, fps: 0, shown: 0 });
  const el = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!SHOW_FPS) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;padding:3px 7px;border-radius:6px;background:rgba(0,0,0,.72);color:#9fe870;font:11px/1.3 monospace;pointer-events:none;white-space:pre';
    document.body.appendChild(d);
    el.current = d;
    return () => {
      d.remove();
      el.current = null;
    };
  }, []);

  useFrame((_, dt) => {
    const s = st.current;
    if (dt > 0.5) {
      s.t = 0;
      s.frames = 0;
      return;
    }
    s.t += dt;
    s.frames++;
    if (s.t < 1) return;
    s.fps = s.frames / s.t;
    s.t = 0;
    s.frames = 0;
    if (s.warm > 0) {
      s.warm -= 1;
      s.bad = 0;
    } else if (s.fps < LOW_FPS) {
      if (++s.bad >= LOW_SECONDS && stepDownTier()) {
        s.bad = 0;
        s.warm = SETTLE_S;
      }
    } else {
      s.bad = 0;
    }
    const d = el.current;
    if (d) {
      const i = gl.info.render;
      d.textContent = `${s.fps.toFixed(0)} fps  tier ${getTier()}${s.warm > 0 ? ' (settling)' : ''}\nDPR ${gl.getPixelRatio().toFixed(2)} (cap ${getTierSpec().dpr})  ${gl.domElement.width}x${gl.domElement.height}\ncalls ${i.calls}  tris ${i.triangles}  geom ${gl.info.memory.geometries}  tex ${gl.info.memory.textures}`;
    }
  });
  return null;
}
