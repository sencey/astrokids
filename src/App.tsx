import { lazy, Suspense, useEffect, useState } from 'react';
import { engine } from './audio/engine';
import './styles/tokens.css';
import './styles/base.css';

import { loadTerrain } from './three/data/terrain';

// Default route: start the terrain download now, in parallel with the (lazy) 3D code chunks.
if (!/^#(dev|legacy)$/.test(window.location.hash)) void loadTerrain();

const App3D = lazy(() => import('./ui3d/App3D'));
const LegacyApp = lazy(() => import('./LegacyApp'));
const Harness = lazy(() => import('./dev/Harness'));

type Route = '3d' | 'legacy' | 'dev';
const routeOf = (): Route => (window.location.hash === '#dev' ? 'dev' : window.location.hash === '#legacy' ? 'legacy' : '3d');

// Default: the 3D Moon Base Commander. #legacy = old 2D game, #dev = harness.
export default function App() {
  const [route, setRoute] = useState<Route>(routeOf);
  useEffect(() => {
    const on = () => setRoute(routeOf());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    // Stop any speech if the page is hidden.
    const hide = () => document.hidden && engine.stopVoice();
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    // Browsers block sound until the first tap; unlock on any first gesture.
    const unlock = () => engine.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#000' }} />}>
      {route === 'dev' ? <Harness /> : route === 'legacy' ? <LegacyApp /> : <App3D />}
    </Suspense>
  );
}
