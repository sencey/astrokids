/** Dev-only: warns in the console when a big Pati pose or an overlay button overlaps the dock, cards or HUD. */
const OBSTACLES = '.m3d-bar > *, .m3d-dock, .m3d-time, .c3d-panel, .c3d-sheet, .ck, .m3d-gauges, .m3d-tools, .m3d-dest, .m3d-warn, .xp-bar, .xp-card, .xp-strip';
const HUD_TOP = '.m3d-top .m3d-bubble, .m3d-top .m3d-pati, .m3d-top .m3d-lang, .m3d-top .xp-strip';

const visible = (el: Element): DOMRect | null => {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return null;
  const r = el.getBoundingClientRect();
  return r.width > 2 && r.height > 2 ? r : null;
};
const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
const name = (el: Element) => (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName.toLowerCase());

export function installLayoutCheck(): () => void {
  const seen = new Set<string>();
  const run = () => {
    const msgs: string[] = [];
    const vp = `${window.innerWidth}x${window.innerHeight}`;
    const obstacles = [...document.querySelectorAll(OBSTACLES)].map((e) => [e, visible(e)] as const).filter((x): x is readonly [Element, DOMRect] => x[1] !== null);
    for (const pose of document.querySelectorAll('.pati-pose')) {
      const pr = visible(pose);
      if (!pr) continue;
      for (const [e, r] of obstacles) if (hit(pr, r)) msgs.push(`[layout ${vp}] Pati pose overlaps .${name(e)}`);
    }
    const buttons = [...document.querySelectorAll('.m3d-tools > .rb, .m3d-chiplabel')].map((e) => [e, visible(e)] as const).filter((x): x is readonly [Element, DOMRect] => x[1] !== null);
    for (const [e, r] of buttons) {
      for (const h of document.querySelectorAll(HUD_TOP)) {
        const hr = visible(h);
        if (hr && hit(r, hr)) msgs.push(`[layout ${vp}] overlay button .${name(e)} overlaps .${name(h)}`);
      }
      if (r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) msgs.push(`[layout ${vp}] overlay button .${name(e)} is off-screen`);
    }
    for (const m of msgs) {
      if (seen.has(m)) continue;
      seen.add(m);
      console.warn(m);
    }
  };
  const id = window.setInterval(run, 1500);
  window.addEventListener('resize', run);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('resize', run);
  };
}
