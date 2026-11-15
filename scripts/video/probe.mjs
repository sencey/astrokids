// Dev helper: prints the DEV hook state (pois, day info) so shots can be tuned. node scripts/video/probe.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', headless: false });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await ctx.addInitScript(() => localStorage.setItem('astrakids3d.lang', 'en'));
const p = await ctx.newPage();
p.on('console', (m) => m.type() === 'error' && console.log('[console.error]', m.text().slice(0, 200)));
await p.goto('http://localhost:5173/?nointro');
await p.waitForFunction(() => window.__explore && window.__moon, null, { timeout: 90000 });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const s = window.__explore.getState();
  return { pos: s.pos, phase: s.phase, pois: s.pois.map((q) => [q.id, q.kind, Math.round(q.x), Math.round(q.z), q.walkM]), world: window.__moon.world(), st: Object.keys(window.__moon.state()), days: (window.__moon.state().mission||window.__moon.state()).days?.map((d, i) => [i, d.date, d.sparkleBand, d.alarmAt, d.alertOngoing]) };
});
console.log(JSON.stringify(info, null, 1));
await b.close();

