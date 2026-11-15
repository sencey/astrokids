import { useEffect, useRef } from 'react';
import type { L } from '../text';

interface Props {
  lang: L;
  onClose: () => void;
  onSources: () => void;
}

type Bi = { en: string; tr: string };
const b = (en: string, tr: string): Bi => ({ en, tr });

const T = {
  title: b('About this game', 'Oyun hakkında'),
  close: b('Close', 'Kapat'),
  h1: b('What is AstroKids?', 'AstroKids nedir?'),
  p1: b(
    'Kids 7–12 command a base at the Moon’s south pole, on real NASA terrain. The real May 2024 solar storm week drives the missions, and Pati the space dog is your guide.',
    '7–12 yaş çocuklar, gerçek NASA arazisi üzerinde Ay’ın güney kutbunda bir üssü yönetir. Görevleri gerçek Mayıs 2024 güneş fırtınası haftası yönlendirir; rehberin uzay köpeği Pati.',
  ),
  h2: b('Real NASA data', 'Gerçek NASA verisi'),
  d: [
    b('LOLA 20 m/px south-pole terrain (Connecting Ridge)', 'LOLA 20 m/piksel güney kutbu arazisi (Connecting Ridge)'),
    b('PGDA polar illumination and permanently shadowed regions (ice)', 'PGDA kutup aydınlanması ve sürekli gölgeli bölgeler (buz)'),
    b('NASA DONKI space weather (May 2024 superstorm)', 'NASA DONKI uzay havası (Mayıs 2024 süper fırtınası)'),
    b('OSDR RadLab radiation (LRO CRaTER, BioSentinel, ISS, Curiosity RAD)', 'OSDR RadLab radyasyon (LRO CRaTER, BioSentinel, ISS, Curiosity RAD)'),
    b('NASA SVS Moon & Earth textures', 'NASA SVS Ay ve Dünya dokuları'),
  ],
  allSrc: b('See all sources', 'Tüm kaynakları gör'),
  h3: b('Use of Super Intelligence (SI)', 'Süper Zekâ (SZ) kullanımı'),
  si: [
    b('Code and data scripts were largely written by Anthropic Claude models (Claude Sonnet writing, Claude Opus reviewing), then tested and accepted by the team.', 'Kod ve veri betiklerinin büyük kısmını Anthropic Claude modelleri yazdı (Claude Sonnet yazdı, Claude Opus inceledi); ekip test edip onayladı.'),
    b('Pati’s character art and the AstroKids logo are SI-generated images.', 'Pati’nin karakter çizimleri ve AstroKids logosu SZ ile üretilmiş görsellerdir.'),
    b('Pati’s voice is SI-generated with ElevenLabs text-to-speech (voice “Killian”). Browser text-to-speech fills in lines without a recording. The demo video narration uses the same SI voice.', 'Pati’nin sesi ElevenLabs metinden sese ile SZ tarafından üretildi (ses: “Killian”). Kaydı olmayan satırları tarayıcının sesli okuması söyler. Tanıtım videosundaki anlatım da aynı SZ sesidir.'),
    b('NOT SI: all terrain, sunlight, radiation and space-weather numbers come from NASA sources, and the Moon and Earth textures are NASA SVS imagery.', 'SZ DEĞİL: tüm arazi, güneş ışığı, radyasyon ve uzay havası sayıları NASA kaynaklarından gelir; Ay ve Dünya dokuları NASA SVS görüntüleridir.'),
  ],
  h4: b('Privacy', 'Gizlilik'),
  pv: b('No accounts, no personal data, no ads, no tracking. Progress stays on this device.', 'Hesap yok, kişisel veri yok, reklam yok, izleme yok. İlerlemen bu cihazda kalır.'),
  foot: b('NASA Space Apps Challenge 2026 · Build a Junior Astronaut Mission Trainer', 'NASA Space Apps Challenge 2026 · Build a Junior Astronaut Mission Trainer'),
};

export default function AboutPanel({ lang, onClose, onSources }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = (k: Bi) => k[lang];

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="about-backdrop" onClick={onClose}>
      <section className="about-sheet" role="dialog" aria-modal="true" aria-labelledby="about-title" lang={lang} onClick={(e) => e.stopPropagation()}>
        <header className="about-head">
          <h2 id="about-title">{t(T.title)}</h2>
          <button ref={closeRef} type="button" className="about-x" onClick={onClose} aria-label={t(T.close)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
        </header>
        <div className="about-body">
          <h3>{t(T.h1)}</h3>
          <p>{t(T.p1)}</p>
          <h3>{t(T.h2)}</h3>
          <ul>{T.d.map((x) => <li key={x.en}>{t(x)}</li>)}</ul>
          <button type="button" className="btn about-src" onClick={onSources}>{t(T.allSrc)}</button>
          <h3>{t(T.h3)}</h3>
          <ul>{T.si.map((x) => <li key={x.en}>{t(x)}</li>)}</ul>
          <h3>{t(T.h4)}</h3>
          <p>{t(T.pv)}</p>
          <p className="about-foot">{t(T.foot)}</p>
        </div>
      </section>
    </div>
  );
}
