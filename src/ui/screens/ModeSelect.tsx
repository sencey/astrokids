import { useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import type { Mode } from '../../game/types';
import { useApp } from '../AppContext';
import Pati from '../pati/Pati';
import type { Outfit } from '../pati/Pati';
import { useIdleHelp } from '../scene/parts';
import GhostHand from '../scene/GhostHand';
import './screens.css';

/** Screen 3: two picture cards, no age labels. Pati puts on his outfit when a card is tapped. */
export default function ModeSelect({ onPick, onGrownUps }: { onPick: (m: Mode) => void; onGrownUps: () => void }) {
  const { t, instruct, repeatShort, setMode, stopVoice } = useApp();
  const [picked, setPicked] = useState<Mode | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    void instruct('mode.pick', 'mode.pick.hint');
    return () => {
      window.clearTimeout(timer.current);
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ghost = useIdleHelp(picked === null, 'mode', repeatShort);

  const pick = (m: Mode) => {
    if (picked) return;
    setPicked(m);
    setMode(m);
    engine.sfx('pop');
    engine.sfx('bark');
    timer.current = window.setTimeout(() => onPick(m), 1300);
  };

  const card = (m: Mode, outfit: Outfit) => (
    <button
      type="button"
      className={`card card--mode card--${m} ${picked === m ? 'card--picked' : ''}`}
      aria-label={t(m === 'playmate' ? 'mode.playmate' : 'mode.captain')}
      onPointerDown={() => pick(m)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick(m);
        }
      }}
    >
      <div className="card__pati">
        <Pati pose={picked === m ? 'proud' : 'happy'} outfit={picked === m ? outfit : 'none'} label="" />
      </div>
      <div className={`card__hint card__hint--${m}`} aria-hidden="true">
        {m === 'playmate' ? <BallIcon /> : <HeadsetIcon />}
      </div>
      <span className="card__title">{t(m === 'playmate' ? 'mode.playmate' : 'mode.captain')}</span>
    </button>
  );

  return (
    <main className="screen mode">
      <div className="mode__row">
        {card('playmate', 'ball')}
        {card('captain', 'headset')}
      </div>
      <GrownUpsDoor onClick={onGrownUps} />
      {ghost && <GhostHand to=".card--playmate" />}
    </main>
  );
}

export function GrownUpsDoor({ onClick }: { onClick: () => void }) {
  const { t } = useApp();
  return (
    <button type="button" className="grownups-door" aria-label={t('grownups')} onClick={onClick}>
      <svg viewBox="0 0 40 52" aria-hidden="true">
        <rect x="4" y="4" width="32" height="44" rx="14" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="28" cy="28" r="3" fill="currentColor" />
      </svg>
    </button>
  );
}

const BallIcon = () => (
  <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="var(--spark)" stroke="#e0a800" strokeWidth="3" /><path d="M16 26 Q30 16 44 26" stroke="#fff6c7" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
);
const HeadsetIcon = () => (
  <svg viewBox="0 0 60 60"><path d="M10 38 V30 a20 20 0 0 1 40 0 V38" fill="none" stroke="#9fb0ff" strokeWidth="5" strokeLinecap="round" /><rect x="6" y="34" width="12" height="18" rx="6" fill="#9fb0ff" /><rect x="42" y="34" width="12" height="18" rx="6" fill="#9fb0ff" /></svg>
);
