// Shot list for the demo video. Each shot is recorded in its own browser context (=> its own webm).
// `run(h)` gets a helper object (see record.mjs). Call h.markStart() when the interesting action begins
// (everything before it is setup / loading and is trimmed away by default), and h.markEnd() when it is over.
// `target` = intended length in seconds in the final video (assemble.mjs uses edit.json to override in/out/speed).

export const BASE_URL = process.env.ASTRO_URL || 'http://localhost:5173';

const HOOKS = () => window.__explore && window.__moon;

/** wait until the world is playable (hooks installed, POIs derived) */
async function ready(h, qs = '?nointro') {
  await h.goto('/' + qs);
  await h.page.waitForFunction(HOOKS, null, { timeout: 120000 });
  await h.page.waitForFunction(() => window.__explore.getState().pois.length > 1, null, { timeout: 30000 });
  await h.page.waitForSelector('.w-hud', { timeout: 30000 });
  await h.sleep(1500);
}

const distTo = (id) =>
  `(() => { const s = window.__explore.getState(); const p = s.pois.find(q => q.id === ${JSON.stringify(id)}); return Math.hypot(s.pos[0]-p.x, s.pos[1]-p.z); })()`;

/** walk to a POI via the DEV hook and wait until the commander stops (or timeout) */
async function walkToPoi(h, id, maxMs = 60000) {
  const t = await h.page.evaluate((id) => { const p = window.__explore.getState().pois.find((q) => q.id === id); if (!p) return null; window.__explore.walkTo([p.x, p.z]); return [p.x, p.z]; }, id);
  h.log(`walkTo ${id}`, t);
  await h.sleep(600);
  await h.page.waitForFunction(() => !window.__explore.getState().moving, null, { timeout: maxMs, polling: 250 }).catch(() => h.log('walk timeout'));
  h.log('state after walk', JSON.stringify(await h.page.evaluate((e) => { const s = window.__explore.getState(); return { pos: s.pos.map(Math.round), found: s.discovered, energyLeft: s.energyLeft, phase: s.phase }; })));
}

export const SHOTS = [
  {
    id: 'S1',
    name: 'title',
    target: 4,
    lang: 'en',
    async run(h) {
      await h.goto('/');
      await h.page.waitForSelector('.ts-root', { timeout: 60000 });
      await h.page.waitForSelector('.ts-start', { timeout: 30000 });
      h.markStart(); // title cascade (ts-in) plays right after load
      await h.sleep(4500);
    },
  },
  {
    id: 'S2',
    name: 'arrive + walk to sunny peak',
    target: 6,
    lang: 'en',
    async run(h) {
      await ready(h);
      h.markStart();
      await h.sleep(1500); // Pati speech bubble + commander idle
      // walk ~220 m toward the sunny peak (about 8 s), camera follows; the commander keeps going while we stop recording
      const t = await h.page.evaluate(() => { const s = window.__explore.getState(); const p = s.pois.find((q) => q.id === 'sun'); const d = Math.hypot(p.x - s.pos[0], p.z - s.pos[1]); const k = Math.min(1, 220 / d); const tgt = [s.pos[0] + (p.x - s.pos[0]) * k, s.pos[1] + (p.z - s.pos[1]) * k]; window.__explore.walkTo(tgt); return tgt; });
      h.log('walk toward sun', t);
      await h.sleep(7000);
    },
  },
  {
    id: 'S3',
    name: 'discovery: ice crater',
    target: 5,
    lang: 'en',
    async run(h) {
      await ready(h);
      h.markStart();
      await h.page.evaluate(() => window.__explore.setPatiTalking(true)).catch(() => {});
      // walk to the ice crater; discovery fires on arrival (event 'discover'/'ice')
      const p = await h.page.evaluate(() => window.__explore.getState().pois.find((q) => q.id === 'ice-1'));
      h.log('ice-1 at', p.x, p.z);
      await h.page.evaluate((p) => window.__explore.walkTo([p.x, p.z]), p);
      await h.page.waitForFunction(() => window.__explore.getState().discovered.includes('ice-1'), null, { timeout: 90000, polling: 250 }).catch(() => h.log('ice-1 not discovered in time'));
      h.markArrive();
      await h.page.waitForSelector('.m3d-card, .c3d-card, [role=dialog]', { timeout: 5000 }).catch(() => h.log('no discovery card selector found'));
      await h.sleep(3500);
    },
  },
  {
    id: 'S4',
    name: 'build a solar tower on a sunny pad',
    target: 5,
    lang: 'en',
    async run(h) {
      await ready(h);
      // setup (trimmed): the build button only appears after goal 1 (find a place). Walk to the Earth-view spot, dismiss the card.
      await walkToPoi(h, 'earth', 150000);
      await h.page.getByRole('button', { name: /got it|anladÄ±m/i }).click({ timeout: 8000 }).catch(() => h.log('no Got it button'));
      await h.sleep(1500);
      h.markStart();
      const btn = h.page.locator('.w-primary[data-act="build"]');
      await btn.waitFor({ timeout: 15000 }).catch(() => h.log('no build primary button'));
      await h.sleep(800);
      await btn.click();
      h.log('build mode on');
      await h.sleep(1800);
      // find a pad label ("â˜€ NN%") and click just below it (inside the pad patch)
      // pads are usually ~1 km away: the visible edge chip ("100% . 0.9 km") points at the nearest one; tap it
      const chipPos = await h.page.evaluate(() => {
        const c = [...document.querySelectorAll('button')].find((b) => b.querySelector('[data-label]') && b.style.display !== 'none' && /%/.test(b.querySelector('[data-label]').textContent));
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left + 24, y: r.top + 24, t: c.querySelector('[data-label]').textContent };
      });
      h.log('pad chip', JSON.stringify(chipPos));
      const pads = await h.page.evaluate(() => [...document.querySelectorAll('span')].filter((e) => /^â˜€\s*\d+%$/.test(e.textContent.trim())).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom + 14, pct: parseInt(e.textContent.replace(/\D/g, ''), 10) }; }));
      h.log('visible pads', JSON.stringify(pads));
      if (pads.length) {
        pads.sort((a, b) => b.pct - a.pct);
        await h.click(pads[0].x, pads[0].y);
      } else if (chipPos) {
        await h.click(chipPos.x, chipPos.y);
      } else h.log('NO PAD OR CHIP FOUND');
      // commander walks to the pad (time-lapsed in assembly), crate lands, tower rises
      await h.page.waitForFunction(() => window.__moon.state().placed.some((p) => p.id === 'solarTower'), null, { timeout: 120000, polling: 300 }).catch(() => h.log('tower not placed in time'));
      h.markArrive(-3.5); // the build animation (crate + tower) started ~3.5 s before the build is registered
      h.log('placed', JSON.stringify(await h.page.evaluate(() => window.__moon.state().placed)));
      await h.sleep(2500);
    },
  },
  {
    id: 'S5',
    name: 'storm alarm, run home, safe',
    target: 6,
    lang: 'en',
    async run(h) {
      await ready(h);
      // advance to a storm day (May 9 2024 has a real DONKI alarm): end day 0, next day. Done before markStart so it is trimmed.
      await h.page.evaluate(async () => { await window.__moon.endDay(); });
      await h.sleep(800);
      await h.page.evaluate(async () => { await window.__moon.nextDay(); });
      await h.sleep(2500);
      h.log('world', JSON.stringify(await h.page.evaluate(() => window.__moon.world())));
      // go outside a bit (alarm only fires when away from base)
      await h.page.evaluate(() => { const s = window.__explore.getState(); const p = s.pois.find((q) => q.id === 'sun'); const d = Math.hypot(p.x - s.pos[0], p.z - s.pos[1]); const k = Math.min(1, 250 / d); window.__explore.walkTo([s.pos[0] + (p.x - s.pos[0]) * k, s.pos[1] + (p.z - s.pos[1]) * k]); });
      await h.sleep(800);
      await h.page.waitForFunction(() => !window.__explore.getState().moving, null, { timeout: 30000, polling: 250 }).catch(() => {});
      h.markStart();
      await h.page.evaluate(() => window.__moon.fireAlarm());
      await h.sleep(300);
      h.log('alarm', await h.page.evaluate(() => window.__moon.world().alarm));
      await h.sleep(1500); // banner + red glow + Pati warning
      // child taps the big "run home" button (real click); fall back to the hook
      const home = h.page.locator('.w-primary');
      if (await home.count()) await home.click(); else await h.page.evaluate(() => window.__explore.goHome());
      await h.page.waitForFunction(() => window.__moon.world().alarm === 'safe' || window.__moon.world().alarm === 'late', null, { timeout: 40000, polling: 250 }).catch(() => h.log('did not get home in time'));
      h.log('alarm result', await h.page.evaluate(() => window.__moon.world().alarm));
      await h.sleep(2200);
    },
  },
];

