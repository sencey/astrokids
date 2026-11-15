import { useState } from 'react';
import { engine } from '../../audio/engine';
import { useApp } from '../AppContext';
import Pati from '../pati/Pati';
import './wake.css';

/** Screen 1: tap the sleeping dog. This tap is also what unlocks browser audio. */
export default function Wake({ onWake }: { onWake: () => void }) {
  const { t } = useApp();
  const [awake, setAwake] = useState(false);

  const wake = () => {
    if (awake) return;
    engine.unlock();
    setAwake(true);
    // The unlock happens in the gesture; the bark may need a moment for the context to run.
    window.setTimeout(() => engine.sfx('bark'), 60);
    window.setTimeout(onWake, 1100);
  };

  return (
    <main className="screen wake">
      <div className={`wake__capsule ${awake ? 'wake__capsule--lit' : ''}`}>
        <div className="wake__window" aria-hidden="true" />
        <div className="wake__pati">
          <Pati pose={awake ? 'happy' : 'sleeping'} label={t('wake.pati')} onTap={wake} onCollar={undefined} />
          {!awake && (
            <svg className="wake__paw" viewBox="0 0 64 64" aria-hidden="true">
              <ellipse cx="32" cy="42" rx="14" ry="12" fill="var(--accent-soft)" />
              <ellipse cx="14" cy="28" rx="6" ry="8" fill="var(--accent-soft)" />
              <ellipse cx="26" cy="16" rx="6" ry="8" fill="var(--accent-soft)" />
              <ellipse cx="40" cy="16" rx="6" ry="8" fill="var(--accent-soft)" />
              <ellipse cx="52" cy="28" rx="6" ry="8" fill="var(--accent-soft)" />
            </svg>
          )}
        </div>
        <div className="wake__bed" aria-hidden="true" />
      </div>
    </main>
  );
}
