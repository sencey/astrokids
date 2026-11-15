import type { MissionStats } from '../../game/explore/explore';
import { AlbumIcon, BoltIcon, CheckIcon, CloseIcon, FlagIcon, IceIcon, MedalIcon, StarIcon, SunIcon, WalkIcon } from '../icons';
import { PatiPose } from '../pati/PatiAvatar';
import type { L } from '../text';
import { badgeName, BADGES, isDiscoverable, missionText, poiFact, poiName, poiSourceLine } from './exploreData';
import type { BadgeId, Mission, Poi } from './exploreData';
import { mt } from './text';

/** First-run welcome: one card over the 3D scene, one primary button. */
export function WelcomeCard({ lang, onStart }: { lang: L; onStart: () => void }) {
  return (
    <>
      <div className="c3d-overlay">
        <div className="c3d-panel xp-welcome" role="dialog" aria-label={mt('welcomeCard', lang)}>
          <p className="xp-welcome-line">{mt('welcomeCard', lang)}</p>
          <button className="btn primary" onClick={onStart} autoFocus>
            {mt('welcomeGo', lang)}
          </button>
        </div>
      </div>
      <PatiPose id="pose-wave" lang={lang} center />
    </>
  );
}

const missionIcon = (m: Mission) => {
  if (/ice/i.test(m.id)) return <IceIcon />;
  if (/sun/i.test(m.id)) return <SunIcon />;
  if (/walk/i.test(m.id)) return <WalkIcon />;
  return <FlagIcon />;
};

/** Today's missions as checkable lines (top-left, under Pati's bubble). */
export function MissionStrip({ lang, missions, stats }: { lang: L; missions: readonly Mission[]; stats: MissionStats }) {
  if (missions.length === 0) return null;
  return (
    <section className="xp-strip" aria-label={mt('missionsTitle', lang)}>
      <ul>
        {missions.map((m) => {
          const done = m.done(stats);
          return (
            <li key={m.id} className={done ? 'done' : ''}>
              <span className="xp-box" aria-hidden="true">{done && <CheckIcon />}</span>
              <span className="xp-mic" aria-hidden="true">{missionIcon(m)}</span>
              <span className="xp-mtxt">{missionText(m, lang)}</span>
              {done && <span className="xp-sr"> ({mt('missionDone', lang)})</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Bottom bar of the outing: energy left + the one primary button. */
export function ExploreBar({ lang, budget, left, ending, onHome }: { lang: L; budget: number; left: number; ending: boolean; onHome: () => void }) {
  const n = Math.max(0, Math.min(budget, Math.round(left)));
  return (
    <div className="xp-bar">
      <span className="chip bolts xp-pill" role="status" aria-label={`${mt('energyLeft', lang)} ${n}`}>
        {Array.from({ length: Math.min(budget, 8) }, (_, i) => (
          <BoltIcon key={i} className={i < n ? '' : 'off'} />
        ))}
      </span>
      <button className="btn primary compact" onClick={onHome} disabled={ending}>
        {mt('goHome', lang)}
      </button>
    </div>
  );
}

/** A newly found place: name, one sentence, source, stars. The child closes it with one tap. */
export function DiscoveryCard({ lang, poi, onClose }: { lang: L; poi: Poi; onClose: () => void }) {
  return (
    <div className="xp-card-wrap">
      <section className="xp-card" role="dialog" aria-label={`${mt('discoverNew', lang)} ${poiName(poi, lang)}`}>
        <header>
          <FlagIcon className="xp-card-ic" />
          <div>
            <small>{mt('discoverNew', lang)}</small>
            <h2>{poiName(poi, lang)}</h2>
          </div>
          <span className="chip gives xp-stars" role="img" aria-label={`+${poi.science} ${mt('gaugeStars', lang)}`}>
            <b>+</b>
            {Array.from({ length: poi.science }, (_, i) => (
              <StarIcon key={i} className="gv-star" />
            ))}
          </span>
        </header>
        <p className="xp-fact">{poiFact(poi, lang)}</p>
        <p className="xp-src">
          {mt('sourceLabel', lang)}: {poiSourceLine(poi, lang)}
        </p>
        <button className="btn primary compact" onClick={onClose} autoFocus>
          {mt('discoverOk', lang)}
        </button>
      </section>
    </div>
  );
}

/** Album: places (lit / unlit) and badges (big icons). */
export function AlbumPanel({ lang, pois, found, earned, onClose }: { lang: L; pois: readonly Poi[]; found: ReadonlySet<string>; earned: ReadonlySet<BadgeId>; onClose: () => void }) {
  const places = pois.filter(isDiscoverable);
  const count = places.filter((p) => found.has(p.id)).length;
  return (
    <div className="c3d-modal" onClick={onClose}>
      <div className="c3d-sheet xp-album" role="dialog" aria-label={mt('album', lang)} onClick={(e) => e.stopPropagation()}>
        <h2>
          <AlbumIcon /> {mt('album', lang)}
        </h2>
        <h3>
          {mt('albumPlaces', lang)} {count}/{places.length}
        </h3>
        <ul className="xp-places">
          {places.map((p) => {
            const on = found.has(p.id);
            return (
              <li key={p.id} className={on ? 'lit' : ''}>
                <FlagIcon aria-hidden="true" />
                <span>{on ? poiName(p, lang) : mt('albumUnknown', lang)}</span>
              </li>
            );
          })}
        </ul>
        <h3>{mt('albumBadges', lang)}</h3>
        <ul className="xp-badges">
          {BADGES.map((b) => (
            <li key={b.id} className={earned.has(b.id) ? 'lit' : ''}>
              <MedalIcon aria-hidden="true" />
              <span>{badgeName(b.id, lang)}</span>
              {!earned.has(b.id) && <small>{lang === 'tr' ? b.hintTr : b.hintEn}</small>}
            </li>
          ))}
        </ul>
        <button className="btn primary compact" onClick={onClose}>
          <CloseIcon /> {mt('close', lang)}
        </button>
      </div>
    </div>
  );
}
