import { useEffect, useState } from 'react';

/** The guided first day: which UI element each step points at (data-guide="..." in the markup). */
export const GUIDE_TARGETS = ['chest', 'plan-btn', 'act-keepRunning', 'act-shield', 'go-btn', 'report'] as const;
export const GUIDE_STEPS = GUIDE_TARGETS.length;
export const GUIDE_KEY = 'astrakids3d.guidedDone.v1';

export const readGuideDone = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
};
export const writeGuideDone = (v: boolean): void => {
  try {
    if (v) localStorage.setItem(GUIDE_KEY, '1');
    else localStorage.removeItem(GUIDE_KEY);
  } catch {
    /* private mode: the guide simply shows again */
  }
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A pulsing orange ring around the exact element Pati is talking about. Follows layout changes (flip, resize, sheet). */
export function GuideRing({ target }: { target: string | null }) {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    if (!target) {
      setBox(null);
      return;
    }
    let off = false;
    let scrolled = false;
    const find = (): HTMLElement | null => {
      const els = [...document.querySelectorAll<HTMLElement>(`[data-guide="${target}"]`)];
      return els.find((e) => e.getClientRects().length > 0) ?? null;
    };
    const tick = () => {
      if (off) return;
      const el = find();
      if (!el) {
        setBox((b) => (b === null ? b : null));
        return;
      }
      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      const r = el.getBoundingClientRect();
      // clip to the viewport: an element hidden by its scroller or off-screen gets no ring
      const vis = r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
      const clipped = el.closest<HTMLElement>('.ck-body');
      const cr = clipped?.getBoundingClientRect();
      const inScroller = !cr || (r.bottom > cr.top + 2 && r.top < cr.bottom - 2);
      if (!vis || !inScroller) {
        setBox(null);
        return;
      }
      setBox((b) => (b && Math.abs(b.x - r.left) < 0.5 && Math.abs(b.y - r.top) < 0.5 && Math.abs(b.w - r.width) < 0.5 && Math.abs(b.h - r.height) < 0.5 ? b : { x: r.left, y: r.top, w: r.width, h: r.height }));
    };
    tick();
    const id = window.setInterval(tick, 120);
    return () => {
      off = true;
      window.clearInterval(id);
    };
  }, [target]);
  if (!box) return null;
  return <div className="gd-ring" aria-hidden="true" style={{ left: box.x - 6, top: box.y - 6, width: box.w + 12, height: box.h + 12 }} />;
}
