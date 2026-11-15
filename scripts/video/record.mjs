// Records the shots in shots.mjs against the running dev server.
//   node scripts/video/record.mjs [--only S3,S5] [--headless] [--url http://localhost:5173]
// Output: art/video/raw/<id>.webm (+ <id>.png final screenshot) and art/video/raw/meta.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, BASE_URL as DEFAULT_URL } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// Playwright's video recorder wants its own ffmpeg at <browsersPath>/ffmpeg-1013/ffmpeg-win64.exe. We never download it:
// scripts/video/.pw holds a copy of ffmpeg-static (see setup note in assemble.mjs / README in the report).
const pwDir = path.join(here, '.pw');
const pwFfmpeg = path.join(pwDir, 'ffmpeg-1013', 'ffmpeg-win64.exe');
if (!fs.existsSync(pwFfmpeg)) {
  fs.mkdirSync(path.dirname(pwFfmpeg), { recursive: true });
  fs.copyFileSync(path.join(here, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), pwFfmpeg);
}
process.env.PLAYWRIGHT_BROWSERS_PATH = pwDir;
const { chromium } = await import('playwright-core');

const root = path.resolve(here, '..', '..');
const rawDir = path.join(root, 'art', 'video', 'raw');
const recDir = path.join(rawDir, '_rec');
fs.mkdirSync(recDir, { recursive: true });

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const only = opt('only') ? String(opt('only')).split(',') : null;
const baseUrl = (opt('url') || DEFAULT_URL).replace(/\/$/, '');

try { const r = await fetch(baseUrl); if (!r.ok) throw new Error(r.status); }
catch (e) { console.error(`Dev server not reachable at ${baseUrl} (${e.message}). Start it with: npm run dev`); process.exit(1); }

const metaPath = path.join(rawDir, 'meta.json');
const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
const browser = await chromium.launch({ channel: 'msedge', headless: opt('headless') === true });

for (const shot of SHOTS) {
  if (only && !only.includes(shot.id)) continue;
  console.log(`\n=== ${shot.id}: ${shot.name}`);
  const dir = path.join(recDir, shot.id);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
    recordVideo: { dir, size: { width: 1920, height: 1080 } },
  });
  await ctx.addInitScript((lang) => { try { localStorage.setItem('astrakids3d.lang', lang); } catch {} }, shot.lang || 'en');
  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const m = { start: null, arrive: null, end: null };
  const h = {
    page,
    sleep: (ms) => page.waitForTimeout(ms),
    log: (...a) => console.log(`  [${now().toFixed(1)}s]`, ...a),
    goto: (p) => page.goto(baseUrl + p, { waitUntil: 'domcontentloaded' }),
    markStart: () => { m.start = now(); h.log('markStart'); },
    markArrive: (off = 0) => { m.arrive = now() + off; h.log('markArrive'); },
    click: async (x, y) => { await page.mouse.move(x, y, { steps: 8 }); await page.mouse.click(x, y); },
  };
  page.on('console', (c) => { if (c.type() === 'error') console.log('  [console.error]', c.text().slice(0, 160)); });
  page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 160)));
  let ok = true;
  try { await shot.run(h); } catch (e) { ok = false; console.log('  SHOT FAILED:', e.message); }
  m.end = now();
  await page.screenshot({ path: path.join(rawDir, `${shot.id}.png`) }).catch(() => {});
  const vid = page.video();
  await ctx.close(); // finalizes the webm
  const src = await vid.path();
  const dest = path.join(rawDir, `${shot.id}.webm`);
  fs.copyFileSync(src, dest);
  meta[shot.id] = { name: shot.name, target: shot.target, ok, file: `${shot.id}.webm`, start: m.start ?? 0, arrive: m.arrive, end: m.end, duration: m.end };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  console.log(`  -> ${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB) start=${(m.start ?? 0).toFixed(1)}s end=${m.end.toFixed(1)}s ok=${ok}`);
}
await browser.close();
