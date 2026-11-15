import { useCallback, useState } from 'react';
import AboutPanel from './AboutPanel';
import { EXPLORE } from '../../game/explore/config';
import { PATI_ART_SI_GENERATED } from '../pati/config';
import { patiImg } from '../pati/PatiAvatar';
import { assetUrl } from '../../three/data/terrain';
import { PlayIcon } from '../icons';
import type { L } from '../text';
import './title.css';

interface Props {
  lang: L;
  setLang: (l: L) => void;
  reduceMotion?: boolean;
  onStart: () => void;
  onSources: () => void;
}

const T = {
  title: { tr: 'MOON BASE COMMANDER', en: 'MOON BASE COMMANDER' },
  h1full: { tr: 'AstroKids — Moon Base Commander', en: 'AstroKids — Moon Base Commander' },
  sub: { tr: 'Ay’ın güney kutbunda gerçek bir göreve liderlik et', en: 'Lead a real mission at the Moon’s south pole' },
  bubble: { tr: 'Merhaba Komutan! Ben Pati. Ay’ı keşfetmeye hazır mısın?', en: 'Hi Commander! I’m Pati. Ready to explore the Moon?' },
  start: { tr: 'Göreve başla', en: 'Start mission' },
  cont: { tr: 'Göreve devam et', en: 'Continue mission' },
  how: { tr: 'Nasıl oynanır', en: 'How to play' },
  h1: { tr: 'Dokun, yürü', en: 'Tap to walk' },
  h2: { tr: 'Buz ve güneş bul', en: 'Find ice & sunlight' },
  h3: { tr: 'İnşa et, güvende kal', en: 'Build & stay safe' },
  built: { tr: 'Gerçek NASA verisiyle', en: 'Built with real NASA data' },
  c1: { tr: 'LOLA Ay arazisi', en: 'LOLA Moon terrain' },
  c2: { tr: 'Mayıs 2024 güneş fırtınası (DONKI)', en: 'May 2024 solar storm (DONKI)' },
  c3: { tr: 'LRO radyasyon (CRaTER)', en: 'LRO radiation (CRaTER)' },
  srcLabel: { tr: 'Veri kaynaklarını göster', en: 'Show data sources' },
  places: { tr: 'yer', en: 'places' },
  walked: { tr: 'yürüdün', en: 'walked' },
  langLabel: { tr: 'Dil', en: 'Language' },
  about: { tr: 'Oyun hakkında', en: 'About this game' },
  patiAlt: { tr: 'Pati el sallıyor', en: 'Pati is waving' },
} as const;

/** Saved exploration progress (same key the scene writes); null when there is none. */
function readSaved(): { found: number; km: number } | null {
  try {
    const raw = localStorage.getItem(EXPLORE.storageKey);
    if (!raw) return null;
    const j = JSON.parse(raw) as { v?: number; discovered?: unknown; walked?: unknown };
    if (j.v !== 1) return null;
    const found = Array.isArray(j.discovered) ? j.discovered.filter((x) => typeof x === 'string').length : 0;
    const walked = typeof j.walked === 'number' && j.walked > 0 ? j.walked : 0;
    if (found === 0 && walked < 50) return null;
    return { found, km: walked / 1000 };
  } catch {
    return null;
  }
}

const ic = { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export default function TitleScreen({ lang, setLang, reduceMotion, onStart, onSources }: Props) {
  const [about, setAbout] = useState(false);
  const closeAbout = useCallback(() => {
    setAbout(false);
    window.setTimeout(() => document.querySelector<HTMLButtonElement>('.ts-about')?.focus(), 0);
  }, []);
  const saved = readSaved();
  const t = <K extends keyof typeof T>(k: K) => T[k][lang];
  const progress = saved
    ? lang === 'tr'
      ? `${saved.found} ${T.places.tr} · ${saved.km.toFixed(1)} km ${T.walked.tr}`
      : `${saved.found} ${T.places.en} · ${saved.km.toFixed(1)} km ${T.walked.en}`
    : null;

  return (
    <div className="ts-root" data-reduce={reduceMotion ? 'true' : 'false'} lang={lang}>
      <div className="ts-scrim" aria-hidden="true" />

      <div className="ts-top ts-in" style={{ ['--i' as string]: 0 }}>
        <button type="button" className="ts-about" onClick={() => setAbout(true)} aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r="0.6" fill="currentColor" /></svg>
          <span>{t('about')}</span>
        </button>
        <div className="ts-lang" role="group" aria-label={t('langLabel')}>
          <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} aria-label="English" onClick={() => setLang('en')}>EN</button>
          <button type="button" className={lang === 'tr' ? 'on' : ''} aria-pressed={lang === 'tr'} aria-label="Türkçe" onClick={() => setLang('tr')}>TR</button>
        </div>
      </div>

      <header className="ts-head ts-in" style={{ ['--i' as string]: 1 }}>
        <h1 className="ts-vh">{t('h1full')}</h1>
        <div className={`ts-logo-wrap${PATI_ART_SI_GENERATED ? ' pati-wm' : ''}`}>
          <img
            className="ts-logo"
            src={assetUrl('brand/astrakids-logo@1x.webp')}
            srcSet={`${assetUrl('brand/astrakids-logo@1x.webp')} 360w, ${assetUrl('brand/astrakids-logo.webp')} 720w`}
            sizes="(orientation: landscape) 38vw, 82vw"
            width={720}
            height={545}
            alt="AstroKids"
            draggable={false}
          />
        </div>
        <p className="ts-tag" aria-hidden="true">{t('title')}</p>
        <p className="ts-sub">{t('sub')}</p>
      </header>

      <div className="ts-pati ts-in" style={{ ['--i' as string]: 2 }}>
        <p className="ts-bubble">{t('bubble')}</p>
        <div className={`ts-fig${PATI_ART_SI_GENERATED ? ' pati-wm' : ''}`}>
          <img className="ts-pati-img" src={patiImg('pose-wave')} alt={t('patiAlt')} draggable={false} />
        </div>
      </div>

      <div className="ts-act ts-in" style={{ ['--i' as string]: 3 }}>
        <button type="button" className="btn primary ts-start" onClick={onStart} aria-label={saved ? `${t('cont')}. ${progress ?? ''}` : t('start')}>
          <PlayIcon /> <span>{saved ? t('cont') : t('start')}</span>
        </button>
        {progress && <p className="ts-progress">{progress}</p>}
      </div>

      <section className="ts-how ts-in" style={{ ['--i' as string]: 4 }} aria-label={t('how')}>
        <ul>
          <li>
            <svg {...ic}><circle cx="26" cy="8" r="4" fill="currentColor" /><path d="M26 14l-4 12 8 6 2 10M22 26l-8 4M26 17l8 6M22 26l-5 16" /></svg>
            <span>{t('h1')}</span>
          </li>
          <li>
            <svg {...ic}><path d="M14 5v18M5 14h18M8 8l12 12M20 8L8 20" /><circle cx="35" cy="35" r="7" fill="currentColor" /><path d="M35 22v3M35 45v3M22 35h3M45 35h3M26 26l2 2M42 42l2 2M44 26l-2 2M28 42l-2 2" /></svg>
            <span>{t('h2')}</span>
          </li>
          <li>
            <svg {...ic}><path d="M8 40V24a16 14 0 0 1 32 0v16zM8 30h32M20 40v-6h8v6" /></svg>
            <span>{t('h3')}</span>
          </li>
        </ul>
      </section>

      <button type="button" className="ts-built ts-in" style={{ ['--i' as string]: 5 }} onClick={onSources} aria-label={`${t('built')}. ${t('srcLabel')}`}>
        <span className="ts-built-h">{t('built')}</span>
        <span className="ts-chips">
          <span>{t('c1')}</span>
          <span>{t('c2')}</span>
          <span>{t('c3')}</span>
        </span>
      </button>

      {about && (
        <AboutPanel
          lang={lang}
          onClose={closeAbout}
          onSources={() => {
            setAbout(false);
            onSources();
          }}
        />
      )}
    </div>
  );
}
