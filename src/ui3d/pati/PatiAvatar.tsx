import { useEffect, useState } from 'react';
import { assetUrl } from '../../three/data/terrain';
import { PatiFace } from '../icons';
import type { L } from '../text';
import { PATI_ART_SI_GENERATED } from './config';
import type { PatiMood, PatiPoseId } from './mood';

const EXPR_FILE: Record<PatiMood, string> = {
  happy: 'expr-happy',
  wink: 'expr-wink',
  surprised: 'expr-surprised',
  determined: 'expr-determined',
  sad: 'expr-sad',
};

const MOOD_ALT: Record<PatiMood, { tr: string; en: string }> = {
  happy: { tr: 'Pati mutlu', en: 'Pati is happy' },
  wink: { tr: 'Pati göz kırpıyor', en: 'Pati is winking' },
  surprised: { tr: 'Pati şaşkın', en: 'Pati is surprised' },
  determined: { tr: 'Pati kararlı', en: 'Pati is determined' },
  sad: { tr: 'Pati üzgün', en: 'Pati is sad' },
};

const POSE_ALT: Record<PatiPoseId, { tr: string; en: string }> = {
  'pose-main': { tr: 'Pati parmağıyla gösteriyor', en: 'Pati is pointing' },
  'pose-run': { tr: 'Pati koşuyor', en: 'Pati is running' },
  'pose-jump': { tr: 'Pati sevinçle zıplıyor', en: 'Pati is jumping for joy' },
  'pose-sit': { tr: 'Pati oturuyor', en: 'Pati is sitting' },
  'pose-wave': { tr: 'Pati el sallıyor', en: 'Pati is waving' },
  'pose-live': { tr: 'Pati göz kırpıp başparmağını kaldırıyor', en: 'Pati winks and gives a thumbs up' },
  'expr-sad': { tr: 'Pati üzgün', en: 'Pati is sad' },
};

export const patiImg = (id: string) => assetUrl(`pati/${id}.webp`);

/** Corner avatar: an expression picked from the game state, cross-fading on change, with a tiny idle bob. */
export function PatiAvatar({ mood, lang, big = false, talking = false, onClick }: { mood: PatiMood; lang: L; big?: boolean; /** Pati is speaking: a soft ring pulses around the avatar */ talking?: boolean; onClick?: () => void }) {
  const [cur, setCur] = useState<PatiMood>(mood);
  const [prev, setPrev] = useState<PatiMood | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (mood === cur) return;
    setPrev(cur);
    setCur(mood);
    const t = window.setTimeout(() => setPrev(null), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);
  const cls = `m3d-pati pati-av${big ? ' big' : ''}${PATI_ART_SI_GENERATED ? ' pati-wm' : ''}${talking ? ' talking' : ''}`;
  const inner = failed ? (
    <PatiFace />
  ) : (
    <span className="pati-av-bob">
      {prev && <img key={`p-${prev}`} className="pati-av-img out" src={patiImg(EXPR_FILE[prev])} alt="" aria-hidden="true" draggable={false} />}
      <img key={`c-${cur}`} className={`pati-av-img${prev ? ' in' : ''}`} src={patiImg(EXPR_FILE[cur])} alt={MOOD_ALT[cur][lang]} draggable={false} onError={() => setFailed(true)} />
    </span>
  );
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button className={cls} onClick={onClick} aria-label="Pati">
      {inner}
    </button>
  );
}

/** A big decorative pose next to a card. Slides/fades in; at most ~36% of the screen height. */
export function PatiPose({ id, lang, side = 'right', alt = false, over = false, small = false, center = false }: { id: PatiPoseId; lang: L; side?: 'left' | 'right'; alt?: boolean; over?: boolean; small?: boolean; /** a centred card is on screen: keep clear of it */ center?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span key={id} className={`pati-pose ${side}${over ? ' over' : ''}${small ? ' small' : ''}${center ? ' center-stage' : ''}${PATI_ART_SI_GENERATED ? ' pati-wm' : ''}`} aria-hidden={alt ? undefined : true}>
      <img src={patiImg(id)} alt={alt ? POSE_ALT[id][lang] : ''} draggable={false} onError={() => setFailed(true)} />
    </span>
  );
}
