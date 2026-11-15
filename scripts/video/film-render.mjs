// Deterministic frame renderer for the cinematic film (film.html -> art/video/film/frames/%05d.png).
//   node scripts/video/film-render.mjs [--from N] [--to N] [--every K] [--scene 1..8] [--t sec[,sec..]] [--cam px,py,pz,lx,ly,lz[,fov]]
//        [--out dir] [--url http://localhost:5173] [--headless false]
// Examples:  full render        node scripts/video/film-render.mjs
//            scene preview      node scripts/video/film-render.mjs --scene 4 --every 6 --out art/video/film/preview
//            single stills      node scripts/video/film-render.mjs --t 5.2,9.4 --out art/video/film/preview
// Then:      node scripts/video/film-encode.mjs      (composite + grade + audio -> art/video/astrakids-film.mp4)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pwDir = path.join(here, '.pw');
const pwFfmpeg = path.join(pwDir, 'ffmpeg-1013', 'ffmpeg-win64.exe');
if (!fs.existsSync(pwFfmpeg)) {
  fs.mkdirSync(path.dirname(pwFfmpeg), { recursive: true });
  fs.copyFileSync(path.join(here, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'), pwFfmpeg);
}
process.env.PLAYWRIGHT_BROWSERS_PATH = pwDir;
const { chromium } = await import('playwright-core');

const root = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const FPS = 30;
const DURATION = 26.5;
const SCENES = [[0, 3.0], [3.0, 8.2], [8.2, 10.3], [10.3, 13.6], [13.6, 16.8], [16.8, 20.6], [20.6, 22.5], [22.5, 26.5]];
const baseUrl = String(opt('url', 'http://localhost:5173')).replace(/\/$/, '');
const outDir = path.resolve(root, String(opt('out', 'art/video/film/frames')));
fs.mkdirSync(outDir, { recursive: true });

const total = Math.round(DURATION * FPS);
let from = Number(opt('from', 0));
let to = Number(opt('to', total - 1));
const sc = opt('scene');
if (sc) { const [a, b] = SCENES[Number(sc) - 1]; from = Math.round(a * FPS); to = Math.round(b * FPS) - 1; }
const every = Number(opt('every', 1));
let frames = [];
const tList = opt('t');
if (tList) frames = String(tList).split(',').map((s) => ({ name: `t${Number(s).toFixed(2)}`, t: Number(s) }));
else for (let i = from; i <= to; i += every) frames.push({ name: String(i).padStart(5, '0'), t: i / FPS });

const browser = await chromium.launch({
  channel: 'msedge',
  headless: opt('headless', 'true') !== 'false',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-device-scale-factor=1'],
});
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', (c) => { if (c.type() === 'error' || c.type() === 'warning') console.log('  [console.' + c.type() + ']', c.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 300)));
await page.goto(`${baseUrl}/film.html`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__film, null, { timeout: 60000 });
await page.evaluate(() => window.__film.ready);
const cam = opt('cam');
if (cam) {
  const v = String(cam).split(',').map(Number);
  await page.evaluate((v) => { window.__dbg = { p: v.slice(0, 3), l: v.slice(3, 6), fov: v[6] || 40 }; }, v);
}
const ovs = opt('ov');
if (ovs) await page.evaluate((o) => { window.__ov = { sun: o.includes('sun'), ice: o.includes('ice') }; }, String(ovs));
const dur = await page.evaluate(() => window.__film.duration);
console.log(`film duration ${dur}s, rendering ${frames.length} frame(s) -> ${outDir}`);
const t0 = Date.now();
let n = 0;
for (const f of frames) {
  await page.evaluate((t) => window.__film.seek(t), f.t);
  await page.screenshot({ path: path.join(outDir, `${f.name}.png`), omitBackground: true });
  n++;
  if (n % 15 === 0 || n === frames.length) console.log(`  ${n}/${frames.length}  t=${f.t.toFixed(2)}  ${((Date.now() - t0) / n / 1000).toFixed(2)} s/frame`);
}
await browser.close();
console.log('done');

