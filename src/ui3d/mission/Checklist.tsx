import { useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { AlbumIcon } from '../icons';
import type { L } from '../text';
import { mt } from './text';
import type { MKey } from './text';

const SHEET_Q = '(orientation: portrait) and (max-width: 699px)';
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(SHEET_Q);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const isSheet = () => window.matchMedia(SHEET_Q).matches;

export type CkPage = 1 | 2 | 3;
const TABS: { n: CkPage; key: MKey }[] = [
  { n: 1, key: 'tabBrief' },
  { n: 2, key: 'tabPlan' },
  { n: 3, key: 'tabReport' },
];

/**
 * The cuff checklist: a spiral-bound page of white suit fabric. Briefing, Plan and Report are its pages 1-2-3.
 * Landscape/desktop: docked on the right. Portrait phone: a bottom sheet whose ring strip is the grab handle (tap or drag).
 */
export function Checklist({ lang, shown, enabled, away, expanded, onExpand, onTab, onAlbum, children }: {
  lang: L;
  shown: CkPage;
  /** which page tabs can be opened right now */
  enabled: CkPage[];
  /** slid off-screen (time-lapse, picking on the map) */
  away: boolean;
  expanded: boolean;
  onExpand: (v: boolean) => void;
  onTab: (p: CkPage) => void;
  /** opens the album (places + badges); omitted while there is no exploration data */
  onAlbum?: () => void;
  children: ReactNode;
}) {
  const drag = useRef<{ y: number; id: number } | null>(null);
  const sheet = useSyncExternalStore(subscribe, isSheet, () => false);
  return (
    <aside className="ck" data-away={away} data-expanded={expanded} aria-label={mt('checklist', lang)} aria-hidden={away} {...(away ? { inert: '' } : {})} data-guide="checklist">
      {!sheet ? (
        <div className="ck-rings" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      ) : (
      <button
        className="ck-rings"
        aria-expanded={expanded}
        aria-label={expanded ? mt('listClose', lang) : mt('listOpen', lang)}
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          const dy = e.clientY - d.y;
          if (Math.abs(dy) < 12) onExpand(!expanded);
          else onExpand(dy < 0);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          // the pointer path handles mouse/touch; Enter/Space arrive as clicks with detail 0
          if (e.key === 'ArrowUp') onExpand(true);
          if (e.key === 'ArrowDown') onExpand(false);
        }}
        onClick={(e) => {
          if (e.detail === 0) onExpand(!expanded);
        }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} />
        ))}
      </button>
      )}
      <div className="ck-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.n} role="tab" className={`ck-tab ${shown === t.n ? 'on' : ''}`} aria-selected={shown === t.n} disabled={!enabled.includes(t.n) && shown !== t.n} onClick={() => onTab(t.n)}>
            <b>{t.n}</b>
            <span>{mt(t.key, lang)}</span>
          </button>
        ))}
        {onAlbum && (
          <button className="ck-album" onClick={onAlbum} aria-label={mt('album', lang)} title={mt('album', lang)}>
            <AlbumIcon />
          </button>
        )}
      </div>
      <div className="ck-page" key={shown} role="tabpanel">
        {children}
      </div>
    </aside>
  );
}
