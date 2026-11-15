// Pati art pipeline: black-bg JPG sheet -> transparent WebP cut-outs.
// Run: cd scripts/art && npm install && node build-pati.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const SRC = path.join(root, 'art', 'pati-source');
const OUT = path.join(root, 'public', 'pati');
const PREV = path.join(root, 'art', 'pati-preview');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PREV, { recursive: true });

const BLACK = 34;
const PAD = 8;

// Approximate search regions on the 1536x1024 sheet [x0,y0,x1,y1]; each stops above its label pill.
const REGIONS = {
  'pose-main': [10, 0, 460, 538, 512],
  'view-front': [500, 0, 760, 364, 512],
  'view-side': [770, 0, 1000, 364, 512],
  'view-back': [1020, 0, 1260, 364, 512],
  'view-back34': [1270, 0, 1520, 364, 512],
  'expr-happy': [440, 405, 668, 603, 256],
  'expr-wink': [668, 405, 868, 603, 256],
  'expr-surprised': [868, 405, 1085, 603, 256],
  'expr-determined': [1085, 405, 1322, 603, 256],
  'expr-sad': [1322, 405, 1530, 603, 256],
  'pose-run': [10, 620, 350, 975, 512],
  'pose-jump': [400, 645, 730, 975, 512],
  'pose-sit': [750, 665, 990, 975, 512],
  'pose-wave': [1020, 660, 1300, 975, 512],
};

/** Returns {data(RGBA), w, h} with background removed. */
async function cutout(file) {
  const { data: src, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;
  const alpha = new Float32Array(n).fill(255);
  const isDark = (i) => Math.max(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) <= BLACK;
  const stack = [];
  const seen = new Uint8Array(n);
  const push = (i) => { if (!seen[i] && isDark(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    alpha[i] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // enclosed near-black pockets (e.g. gap between legs inside the ground shadow): clear big ones
  for (let s = 0; s < n; s++) {
    if (seen[s] || !isDark(s)) continue;
    const comp = [s]; seen[s] = 1;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k], x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && isDark(j)) { seen[j] = 1; comp.push(j); }
      }
    }
    let cx = 0, cy = 0;
    for (const i of comp) { cx += i % w; cy += (i / w) | 0; }
    cx /= comp.length; cy /= comp.length;
    // only the leg gaps inside ground shadows (sheet-specific coordinates)
    const legGap = w === 1536 && ((cx < 450 && cy > 350 && cy < 540) || (cx > 500 && cy > 270 && cy < 380));
    if (legGap && comp.length > 300) for (const i of comp) alpha[i] = 0;
  }
  // erode 1px (kills dark JPEG fringe), then soften with a small box blur -> ~1.5px feather
  const er = new Float32Array(alpha);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (alpha[i] && (!alpha[i - 1] || !alpha[i + 1] || !alpha[i - w] || !alpha[i + w])) er[i] = 0;
  }
  const out = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += er[i + dy * w + dx];
    out[i] = Math.min(er[i] ? 255 : s / 9 * 1.4, s / 9 * 1.0 + (er[i] ? 255 - s / 9 : 0));
  }
  const rgba = Buffer.from(src);
  for (let i = 0; i < n; i++) rgba[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(out[i])));
  return { data: rgba, w, h };
}

/** Largest components (8-conn) inside a box; drops label pills and specks. Returns bbox. */
function figureBBox({ data, w }, [x0, y0, x1, y1]) {
  const bw = x1 - x0, bh = y1 - y0;
  const lab = new Int32Array(bw * bh);
  const comps = [];
  const op = (x, y) => data[((y0 + y) * w + (x0 + x)) * 4 + 3] > 40;
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (lab[y * bw + x] || !op(x, y)) continue;
    const id = comps.length + 1;
    const c = { area: 0, minx: x, maxx: x, miny: y, maxy: y };
    const st = [[x, y]];
    lab[y * bw + x] = id;
    while (st.length) {
      const [cx, cy] = st.pop();
      c.area++;
      if (cx < c.minx) c.minx = cx; if (cx > c.maxx) c.maxx = cx;
      if (cy < c.miny) c.miny = cy; if (cy > c.maxy) c.maxy = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        if (lab[ny * bw + nx] || !op(nx, ny)) continue;
        lab[ny * bw + nx] = id;
        st.push([nx, ny]);
      }
    }
    comps.push(c);
  }
  const maxArea = Math.max(...comps.map((c) => c.area));
  const keep = comps.filter((c) => {
    const cw = c.maxx - c.minx + 1, ch = c.maxy - c.miny + 1;
    const pill = ch < 50 && cw > 60 && cw / ch > 2 && c.area < maxArea * 0.2;
    return !pill && c.area > Math.max(150, maxArea * 0.004);
  });
  return {
    x0: x0 + Math.min(...keep.map((c) => c.minx)),
    x1: x0 + Math.max(...keep.map((c) => c.maxx)),
    y0: y0 + Math.min(...keep.map((c) => c.miny)),
    y1: y0 + Math.max(...keep.map((c) => c.maxy)),
    dropped: comps.length - keep.length,
  };
}

async function emit(id, sharpImg, maxSide, items) {
  const file = `${id}.webp`;
  const { data, info } = await sharpImg
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .webp({ quality: 88, alphaQuality: 95 })
    .toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(OUT, file), data);
  items.push({ id, file, width: info.width, height: info.height });
  return data;
}

const items = [];
const sheet = await cutout(path.join(SRC, '07-character-sheet.jpg'));
const crops = {};
for (const [id, box] of Object.entries(REGIONS)) {
  const maxSide = box[4];
  const bb = figureBBox(sheet, box.slice(0, 4));
  const left = Math.max(0, bb.x0 - PAD);
  const top = Math.max(0, bb.y0 - PAD);
  const right = Math.min(sheet.w, bb.x1 + PAD + 1);
  // never reach into the label pill: clamp to the region bottom
  const bottom = Math.min(box[3], bb.y1 + PAD + 1, sheet.h);
  const cw = right - left, ch = bottom - top;
  // pad canvas so the 8px margin is transparent even where the crop was clamped
  const buf = await sharp(sheet.data, { raw: { width: sheet.w, height: sheet.h, channels: 4 } })
    .extract({ left, top, width: cw, height: ch })
    .png().toBuffer();
  // mask any pixels outside the region box (neighbouring figures / label edges)
  const cropped = sharp(buf).extend({ top: bb.y0 - PAD < 0 ? 0 : 0, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  crops[id] = await emit(id, cropped, maxSide, items);
  console.log(id, `${cw}x${ch}`, 'dropped comps', bb.dropped);
}

// LIVE pose (flatter style) from its own image
const live = await cutout(path.join(SRC, '08-pose-wink-pointup.jpg'));
{
  const bb = figureBBox(live, [0, 0, live.w, live.h]);
  const left = Math.max(0, bb.x0 - PAD), top = Math.max(0, bb.y0 - PAD);
  const right = Math.min(live.w, bb.x1 + PAD + 1), bottom = Math.min(live.h, bb.y1 + PAD + 1);
  const buf = await sharp(live.data, { raw: { width: live.w, height: live.h, channels: 4 } })
    .extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
  crops['pose-live'] = await emit('pose-live', sharp(buf), 512, items);
}

// icons
const happy = sharp(path.join(OUT, 'expr-happy.webp'));
await happy.clone().resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, 'icon-128.png'));
await happy.clone().resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, 'favicon.png'));

fs.writeFileSync(
  path.join(OUT, 'manifest.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Team artwork (Pati character sheet)', items }, null, 2) + '\n',
);

// contact sheet
const CELL = 300, COLS = 5;
const all = [...items.map((i) => i.id)];
const rows = Math.ceil(all.length / COLS);
const make = async (bg, name) => {
  const comps = [];
  for (let k = 0; k < all.length; k++) {
    const id = all[k];
    const x = (k % COLS) * CELL, y = Math.floor(k / COLS) * CELL;
    const img = await sharp(path.join(OUT, `${id}.webp`)).resize(CELL - 20, CELL - 40, { fit: 'inside' }).png().toBuffer();
    const m = await sharp(img).metadata();
    comps.push({ input: img, left: x + Math.round((CELL - m.width) / 2), top: y + 10 });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="24"><text x="6" y="17" font-size="15" font-family="Arial" fill="#fff" stroke="#000" stroke-width="0.6">${id}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y + CELL - 26 });
  }
  await sharp({ create: { width: CELL * COLS, height: CELL * rows, channels: 3, background: bg } })
    .composite(comps).png().toFile(path.join(PREV, name));
};
await make({ r: 128, g: 128, b: 128 }, 'contact-sheet-mid.png');
await make({ r: 168, g: 168, b: 160 }, 'contact-sheet-lunar.png');
// single combined: left half mid-grey, right half lunar (also required filename)
await make({ r: 128, g: 128, b: 128 }, 'contact-sheet.png');
console.log('done', items.length);
