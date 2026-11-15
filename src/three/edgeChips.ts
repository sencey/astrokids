// Screen-edge indicators for places the commander has not found yet: a round chip with a kind icon and the distance,
// pinned to the edge of the screen (inside a safe inset so it never sits under the HUD). Plain DOM, at most one per place (<= 9).
import type { Poi, PoiKind } from '../game/explore/pois';

const COLOR: Record<PoiKind, string> = { ice: '#5ec8ff', sun: '#ffc933', rim: '#ff8a4a', earth: '#6fa8ff', geology: '#c3a4ff', base: '#ffffff' };
const ICON: Record<PoiKind, string> = {
  ice: '<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  rim: '<path d="M3 19l6-11 4 6 3-4 5 9z"/>',
  earth: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c-3 3-3 13 0 16M12 4c3 3 3 13 0 16"/>',
  geology: '<path d="M12 3l8 9-8 9-8-9z"/>',
  base: '<circle cx="12" cy="12" r="6"/>',
};

export interface Chip {
  poi: Poi;
  el: HTMLButtonElement;
  rot: HTMLElement;
  label: HTMLElement;
  shown: boolean;
  text: string;
  x: number;
  y: number;
  rotDeg: number;
}

/** Accessible name, e.g. Ice crater, 3.2 km: walk there / Buz krateri, 3,2 km: oraya yürü. */
export function chipName(poi: Pick<Poi, 'nameTr' | 'nameEn'>, km: string, lang: 'tr' | 'en'): string {
  return lang === 'tr' ? `${poi.nameTr}, ${km}: oraya yürü` : `${poi.nameEn}, ${km}: walk there`;
}

export function makeChip(poi: Poi, lang: 'tr' | 'en', onTap: () => void): Chip {
  const c = COLOR[poi.kind];
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', chipName(poi, '', lang));
  el.style.cssText = 'position:absolute;left:0;top:0;width:48px;height:64px;margin:0;padding:0;border:0;background:none;display:none;pointer-events:auto;touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:transparent;will-change:transform';
  el.innerHTML =
    `<span data-rot style="position:absolute;left:0;top:0;width:48px;height:48px"><span style="position:absolute;left:18px;top:-5px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid ${c}"></span></span>` +
    `<span style="position:absolute;left:4px;top:4px;width:40px;height:40px;box-sizing:border-box;border-radius:50%;background:rgba(8,12,26,.9);border:2px solid ${c};box-shadow:0 2px 8px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center">` +
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[poi.kind]}</svg></span>` +
    `<span data-label style="position:absolute;left:-6px;right:-6px;top:48px;text-align:center;font:700 11px/14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;white-space:nowrap"></span>`;
  const disc = el.children[1] as HTMLElement;
  el.addEventListener('focus', () => {
    if (el.matches(':focus-visible')) disc.style.boxShadow = '0 0 0 3px #fff,0 0 0 6px #ffd24a';
  });
  el.addEventListener('blur', () => {
    disc.style.boxShadow = '0 2px 8px rgba(0,0,0,.55)';
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap();
  });
  return { poi, el, rot: el.querySelector('[data-rot]') as HTMLElement, label: el.querySelector('[data-label]') as HTMLElement, shown: false, text: '', x: -999, y: -999, rotDeg: 0 };
}

export interface SafeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
/** Portrait phones: 120 px top, 110 px bottom, 70 px right (HUD buttons). Landscape: tighter top/bottom. */
export function safeInsets(w: number, h: number): SafeInsets {
  return h > w ? { top: 120, bottom: 110, left: 12, right: 70 } : { top: 70, bottom: 80, left: 12, right: 70 };
}

/** "0,8 km" (tr) / "0.8 km" (en) */
export function formatKm(m: number, lang: 'tr' | 'en'): string {
  const s = (Math.round(m / 100) / 10).toFixed(1);
  return `${lang === 'tr' ? s.replace('.', ',') : s} km`;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Parts of the screen covered by HUD buttons that chips must stay clear of (the bottom-left gear block on landscape; on portrait the right inset already covers the gear column). */
export function safeBlocks(w: number, h: number): Rect[] {
  return h > w ? [] : [{ x0: 0, y0: h - 170, x1: 120, y1: h }];
}

/**
 * Where a chip goes for a place at screen position (px,py): null = on screen (no chip); otherwise the chip's centre,
 * clamped to the safe rectangle along the line from its centre to the place, and the arrow angle in degrees.
 * A chip that would cover a blocked rect slides to the nearest free spot along the safe edge (right of it, or above it).
 */
export function placeChip(px: number, py: number, w: number, h: number, ins: SafeInsets, blocks: Rect[] = [], onScreenMargin = 28): { x: number; y: number; deg: number } | null {
  if (px >= onScreenMargin && px <= w - onScreenMargin && py >= onScreenMargin && py <= h - onScreenMargin) return null;
  const hw = 24; // half chip width; the chip box is x-24..x+24, y-24..y+40 (label under the disc)
  const top = ins.top + 24;
  const bottom = h - ins.bottom - 40;
  const left = ins.left + hw;
  const right = w - ins.right - hw;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const dx = px - cx;
  const dy = py - cy;
  let s = 1;
  if (dx > 1e-6) s = Math.min(s, (right - cx) / dx);
  else if (dx < -1e-6) s = Math.min(s, (left - cx) / dx);
  if (dy > 1e-6) s = Math.min(s, (bottom - cy) / dy);
  else if (dy < -1e-6) s = Math.min(s, (top - cy) / dy);
  let x = cx + dx * s;
  let y = cy + dy * s;
  const hit = (b: Rect, X: number, Y: number) => X + hw > b.x0 && X - hw < b.x1 && Y + 40 > b.y0 && Y - 24 < b.y1;
  for (const b of blocks) {
    if (!hit(b, x, y)) continue;
    const options: [number, number][] = [
      [b.x1 + hw + 4, y], // slide right
      [x, b.y0 - 40 - 4], // slide up
    ];
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const [ox, oy] of options) {
      if (ox < left || ox > right || oy < top || oy > bottom || blocks.some((k) => hit(k, ox, oy))) continue;
      const d = Math.abs(ox - x) + Math.abs(oy - y);
      if (d < bd) {
        bd = d;
        best = [ox, oy];
      }
    }
    if (best) [x, y] = best;
  }
  return { x, y, deg: (Math.atan2(py - y, px - x) * 180) / Math.PI + 90 };
}
