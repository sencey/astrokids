// Dev-only guard: warn when the centre of any button is covered by an unrelated element
// (the bug where the sparkle jar sat on top of the solar panel).
const seen = new Set<string>();

const describe = (el: Element): string => {
  const label = el.getAttribute('aria-label');
  return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${label ? ` [${label}]` : ''}`;
};
const isInteractive = (el: Element) => !!el.closest('button, [role="button"], input, a');

export function runHitTest(): string[] {
  const out: string[] = [];
  document.querySelectorAll<HTMLElement>('button, [role="button"], input, [tabindex="0"]').forEach((el) => {
    if ((el as HTMLButtonElement).disabled) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return; // scrolled away
    if (getComputedStyle(el).pointerEvents === 'none') return;
    const top = document.elementFromPoint(cx, cy);
    if (!top || el.contains(top)) return;
    // Intentional stacking: modal overlays, and interactive pieces layered on Pati.
    if (top.closest('.overlay, [role="dialog"], .ghost')) return;
    if (isInteractive(top) && top.closest('.stage__pati, .pati') && el.closest('.stage__pati, .pati')) return;
    out.push(`${describe(el)} is covered at its centre by ${describe(top)}`);
  });
  return out;
}

export function installHitTest(): () => void {
  let t = 0;
  const warnings: string[] = [];
  (window as unknown as { __patiHitWarnings?: string[] }).__patiHitWarnings = warnings;
  const run = () => {
    for (const w of runHitTest()) {
      if (seen.has(w)) continue;
      seen.add(w);
      warnings.push(w);
      console.warn('[hit-test]', w);
    }
  };
  const schedule = () => {
    window.clearTimeout(t);
    t = window.setTimeout(run, 350);
    window.setTimeout(run, 1500); // after entry animations settle
  };
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    mo.disconnect();
    window.removeEventListener('resize', schedule);
  };
}
