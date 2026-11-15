// The old 2D game (#legacy). Lazy-loaded from App.tsx so the default 3D route never downloads it.
import { useEffect, useState } from 'react';
import { AppProvider, Caption, useApp } from './ui/AppContext';
import { loadLive } from './ui/data/live';
import type { LiveResult } from './ui/data/live';
import DayScreen from './ui/screens/DayScreen';
import Ending from './ui/screens/Ending';
import GrownUps from './ui/screens/GrownUps';
import MissionMap from './ui/screens/MissionMap';
import ModeSelect from './ui/screens/ModeSelect';
import TodaySky from './ui/screens/TodaySky';
import Tutorial from './ui/screens/Tutorial';
import Wake from './ui/screens/Wake';
import type { MissionState } from './game/types';
import { parseDeepLink } from './ui/dev/deepLink';
import type { DeepLink } from './ui/dev/deepLink';
import { setDebug } from './ui/dev/debug';
import { installHitTest } from './ui/dev/hitTest';

type Screen = 'wake' | 'tutorial' | 'mode' | 'map' | 'day' | 'ending' | 'sky' | 'grownups';

function Router({ deep }: { deep: DeepLink | null }) {
  const { markTutorialSeen, setMode, mode, stopVoice } = useApp();
  const [screen, setScreen] = useState<Screen>(deep?.screen ?? 'wake');
  const [back, setBack] = useState<Screen>('map');
  const [runKey, setRunKey] = useState(0);
  const [final, setFinal] = useState<MissionState | null>(deep?.final ?? null);
  const [live, setLive] = useState<LiveResult | null>(null);

  useEffect(() => {
    setDebug({ screen, mode });
  }, [screen, mode]);

  useEffect(() => {
    if (screen === 'map') void loadLive().then(setLive);
  }, [screen]);

  const openGrownUps = (from: Screen) => {
    stopVoice();
    setBack(from);
    setScreen('grownups');
  };

  switch (screen) {
    case 'wake':
      return <Wake onWake={() => setScreen('tutorial')} />;
    case 'tutorial':
      return (
        <Tutorial
          onDone={() => {
            markTutorialSeen();
            setScreen('mode');
          }}
        />
      );
    case 'mode':
      return (
        <ModeSelect
          onPick={(m) => {
            setMode(m);
            setScreen('map');
          }}
          onGrownUps={() => openGrownUps('mode')}
        />
      );
    case 'map':
      return (
        <MissionMap
          live={live}
          onMode={() => { stopVoice(); setScreen('mode'); }}
          onArchive={() => {
            stopVoice();
            setRunKey((k) => k + 1);
            setScreen('day');
          }}
          onLive={() => { stopVoice(); setScreen('sky'); }}
          onGrownUps={() => openGrownUps('map')}
        />
      );
    case 'day':
      return (
        <DayScreen
          key={runKey}
          mode={mode}
          onExit={() => setScreen('map')}
          onFinish={(m) => {
            setFinal(m);
            setScreen('ending');
          }}
        />
      );
    case 'ending':
      return final ? (
        <Ending
          mission={final}
          onRetry={() => {
            setRunKey((k) => k + 1);
            setScreen('day');
          }}
          onMap={() => setScreen('map')}
        />
      ) : null;
    case 'sky':
      return <TodaySky onBack={() => setScreen('map')} />;
    case 'grownups':
      return <GrownUps skipGate={!!deep && deep.screen === 'grownups'} onBack={() => setScreen(deep && back === 'map' ? 'map' : back)} />;
  }
}

export default function LegacyApp() {
  const [deep] = useState(() => parseDeepLink());
  useEffect(() => (import.meta.env.DEV ? installHitTest() : undefined), []);
  return (
    <AppProvider initialMode={deep?.mode}>
      <div className="app">
        <Router deep={deep} />
        <Caption />
      </div>
    </AppProvider>
  );
}
