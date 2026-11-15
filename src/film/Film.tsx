// Film page: one canvas (R3F, frameloop "never") + HTML overlays, both pure functions of the film clock t.
// window.__film = { duration, seek(t) } is the only entry point used by scripts/video/film-render.mjs.
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/lexend/latin-700.css';
import '@fontsource/saira-stencil-one/latin-400.css';
import { DURATION, T } from './timeline';
import { World, worldApi } from './World';
import { Overlays } from './overlays';

interface FilmApi {
  duration: number;
  ready: Promise<void>;
  seek(t: number): Promise<void>;
}
declare global {
  interface Window {
    __film?: FilmApi;
  }
}

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

export function Film() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let last = -1;
    const api: FilmApi = {
      duration: DURATION,
      ready: worldApi.ready.then(() => document.fonts.ready.then(() => undefined)),
      async seek(tt: number) {
        await api.ready;
        flushSync(() => setT(tt));
        // sequential frames advance with the true dt; a jump replays a short run-up so stateful gaits (Pati) settle
        if (last < 0 || Math.abs(tt - last) > 1.5 / 30 + 1e-6 || tt < last) worldApi.warmup(tt);
        worldApi.render(tt);
        last = tt;
        await raf();
        await raf();
      },
    };
    window.__film = api;
  }, []);
  const visibleCanvas = t >= T.s2 - 0.001;
  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, visibility: visibleCanvas ? 'visible' : 'hidden' }}>
        <Canvas
          frameloop="never"
          dpr={1}
          shadows
          gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
          camera={{ fov: 40, near: 0.1, far: 400000 }}
          style={{ width: 1920, height: 1080 }}
        >
          <World />
        </Canvas>
      </div>
      <Overlays t={t} />
    </div>
  );
}
