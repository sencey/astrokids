import { useEffect } from 'react';
import { engine } from '../../audio/engine';
import { useApp } from '../AppContext';
import { liveRuleHolds } from '../data/live';
import type { LiveResult } from '../data/live';
import Pati from '../pati/Pati';
import { BackIcon } from './icons';
import { GrownUpsDoor } from './ModeSelect';
import './screens.css';

interface Props {
  live: LiveResult | null;
  onArchive: () => void;
  onLive: () => void;
  onGrownUps: () => void;
  onMode: () => void;
}

/** Screen 4: two cards. The LIVE card only blinks when the live rule really holds. */
export default function MissionMap({ live, onArchive, onLive, onGrownUps, onMode }: Props) {
  const { t, mode, instruct, stopVoice, lang } = useApp();
  useEffect(() => {
    void instruct('map.pick');
    return stopVoice;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLive = live?.status === 'ok' && liveRuleHolds(live.data);
  const updated =
    live?.status === 'ok'
      ? new Date(live.data.generatedAt).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

  return (
    <main className="screen map">
      <button type="button" className="btn btn--round btn--ghost map__back" aria-label={t('back')} onPointerDown={onMode}>
        <BackIcon />
      </button>
      <div className="map__row">
        <button
          type="button"
          className="card card--archive"
          aria-label={t('map.archive')}
          onPointerDown={() => {
            engine.sfx('pop');
            onArchive();
          }}
        >
          <div className="album">
            <span className="album__corner album__corner--a" />
            <span className="album__corner album__corner--b" />
            <span className="album__corner album__corner--c" />
            <span className="album__corner album__corner--d" />
            <svg viewBox="0 0 200 120" className="album__pic" aria-hidden="true">
              <rect width="200" height="120" rx="8" fill="#0e1a3d" />
              <circle cx="40" cy="60" r="22" fill="#ffb938" />
              <circle cx="40" cy="60" r="44" fill="rgba(255,150,50,0.28)" />
              <path d="M70 60 H150" stroke="rgba(255,246,214,0.5)" strokeWidth="4" strokeDasharray="2 8" strokeLinecap="round" />
              <g fill="#e8e1f7"><ellipse cx="100" cy="56" rx="18" ry="12" /><ellipse cx="116" cy="52" rx="16" ry="13" /></g>
              <path d="M150 100 A24 24 0 0 1 198 100 Z" fill="var(--cream-2)" />
            </svg>
            <span className="album__stamp" aria-hidden="true">05 · 2024</span>
          </div>
          {mode === 'captain' && (
            <span className="card__title">
              <span className="badge badge--archive">{t('badge.archive')}</span> {t('map.archive')}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`card card--live ${isLive ? 'card--live-on' : ''}`}
          aria-label={t('map.live')}
          onPointerDown={() => {
            engine.sfx('pop');
            onLive();
          }}
        >
          <div className="live__pic">
            <Pati pose={isLive ? 'alert' : 'happy'} label="" glowCollar={isLive} className="live__pati" />
            <svg viewBox="0 0 80 80" className="live__sun" aria-hidden="true">
              <circle cx="40" cy="40" r="16" fill="#ffb938" />
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i} x1="40" y1="12" x2="40" y2="4" stroke="#ffb938" strokeWidth="4" strokeLinecap="round" transform={`rotate(${i * 45} 40 40)`} />
              ))}
            </svg>
          </div>
          {mode === 'captain' && (
            <span className="card__title">
              {isLive && <span className="badge badge--live">{t('badge.live')}</span>} {t('map.live')}
            </span>
          )}
          {!isLive && (
            <span className="card__sub">
              {updated ? `${t('updated')} ${updated}` : t('offline')}
            </span>
          )}
        </button>
      </div>
      <GrownUpsDoor onClick={onGrownUps} />
    </main>
  );
}
