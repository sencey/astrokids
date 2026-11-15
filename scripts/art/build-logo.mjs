// AstroKids logo: black-bg WebP -> transparent cut-out (only border-connected black removed).
// Run: cd scripts/art && node build-logo.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const SRC = path.join(root, 'art', 'brand', 'astrakids-logo-source.webp');
const OUT = path.join(root, 'public', 'brand');
const PREV = path.join(root, 'art', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const BLACK = 24;
const PAD = 8;

const { data: src, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const n = w * h;
const isDark = (i) => Math.max(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]) <= BLACK;
// Thin dark outlines (dog, letters) can touch the black background; flood only through the *core* of dark
// regions (dark mask eroded by R px), then grow the result back by R px inside the dark mask.
const R = 6;
const dark = new Uint8Array(n);
for (let i = 0; i < n; i++) dark[i] = isDark(i) ? 1 : 0;
const erodeSep = (m, r) => {
  const t = new Uint8Array(n), o = new Uint8Array(n);
  for (let y = 0; y < h; y++) { let run = 0; for (let x = 0; x < w; x++) { run = m[y * w + x] ? run + 1 : 0; t[y * w + x] = run; } }
  // horizontal: pixel kept if m on [x-r, x+r]
  const hx = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    let run = 0;
    const row = new Int32Array(w);
    for (let x = 0; x < w; x++) { run = m[y * w + x] ? run + 1 : 0; row[x] = run; }
    for (let x = 0; x < w; x++) hx[y * w + x] = x + r < w && x - r >= 0 && row[x + r] >= 2 * r + 1 ? 1 : 0;
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    const col = new Int32Array(h);
    for (let y = 0; y < h; y++) { run = hx[y * w + x] ? run + 1 : 0; col[y] = run; }
    for (let y = 0; y < h; y++) o[y * w + x] = y + r < h && y - r >= 0 && col[y + r] >= 2 * r + 1 ? 1 : 0;
  }
  return o;
};
const core = erodeSep(dark, R);
const bg = new Uint8Array(n); // 1 = border-connected background
const stack = [];
const seen = new Uint8Array(n);
const pushC = (i) => { if (!seen[i] && core[i]) { seen[i] = 1; stack.push(i); } };
// core is eroded away from the image edge, so seed from core pixels near the border
for (let x = 0; x < w; x++) for (let d = 0; d <= R + 1; d++) { pushC(d * w + x); pushC((h - 1 - d) * w + x); }
for (let y = 0; y < h; y++) for (let d = 0; d <= R + 1; d++) { pushC(y * w + d); pushC(y * w + w - 1 - d); }
while (stack.length) {
  const i = stack.pop();
  bg[i] = 1;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) pushC(i - 1);
  if (x < w - 1) pushC(i + 1);
  if (y > 0) pushC(i - w);
  if (y < h - 1) pushC(i + w);
}
// grow back by R+1 px within the dark mask (8-neighbour)
for (let step = 0; step < R + 1; step++) {
  const add = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (bg[i] || !dark[i]) continue;
    if (bg[i - 1] || bg[i + 1] || bg[i - w] || bg[i + w]) add.push(i);
  }
  for (const i of add) bg[i] = 1;
}
// image-edge dark pixels connected to bg
for (let x = 0; x < w; x++) for (const i of [x, (h - 1) * w + x]) if (dark[i]) bg[i] = 1;
for (let y = 0; y < h; y++) for (const i of [y * w, y * w + w - 1]) if (dark[i]) bg[i] = 1;// soft edge: 1px erode of the opaque region, then 3x3 box blur of alpha restricted near the boundary
const a0 = new Float32Array(n);
for (let i = 0; i < n; i++) a0[i] = bg[i] ? 0 : 255;
const er = new Float32Array(a0);
for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
  const i = y * w + x;
  if (a0[i] && (!a0[i - 1] || !a0[i + 1] || !a0[i - w] || !a0[i + w])) er[i] = 0;
}
const alpha = new Uint8Array(n);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = y * w + x;
  if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { alpha[i] = er[i]; continue; }
  let s = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += er[i + dy * w + dx];
  alpha[i] = Math.round(s / 9);
}
const rgba = Buffer.from(src);
for (let i = 0; i < n; i++) rgba[i * 4 + 3] = alpha[i];

// bbox of meaningful alpha
let x0 = w, y0 = h, x1 = 0, y1 = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (alpha[y * w + x] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
}
x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD);
x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD);
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

// stats: transparent fraction in crop; interior = transparent px not connected to border (should be 0 by construction)
let transparent = 0, interiorTransparent = 0, partial = 0;
for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
  const i = y * w + x;
  if (alpha[i] === 0) { transparent++; if (!bg[i] && er[i] === 0) interiorTransparent++; }
  else if (alpha[i] < 255) partial++;
}
// interior check 2: any near-black (<=BLACK) pixel not in bg set that became alpha 0
let enclosedDarkOpaque = 0;
for (let i = 0; i < n; i++) if (!bg[i] && isDark(i)) enclosedDarkOpaque++;

const base = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).extract({ left: x0, top: y0, width: cw, height: ch });
const png = await base.clone().png().toBuffer();
const make = async (width, name, quality) => {
  const buf = await sharp(png).resize({ width, kernel: 'lanczos3' }).webp({ quality, alphaQuality: 95 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(OUT, name), buf.data);
  console.log(name, `${buf.info.width}x${buf.info.height}`, buf.data.length, 'bytes');
};
await make(720, 'astrakids-logo.webp', 88);
await make(360, 'astrakids-logo@1x.webp', 86);
await sharp({ create: { width: cw + 40, height: ch + 40, channels: 3, background: { r: 128, g: 128, b: 128 } } })
  .composite([{ input: png, left: 20, top: 20 }]).png().toFile(path.join(PREV, 'logo-preview.png'));

console.log(JSON.stringify({
  source: `${w}x${h}`, crop: `${cw}x${ch}`,
  transparentFraction: +(transparent / (cw * ch)).toFixed(4),
  partialAlphaFraction: +(partial / (cw * ch)).toFixed(4),
  interiorTransparentPx: interiorTransparent,
  enclosedDarkPixelsKeptOpaque: enclosedDarkOpaque,
}));

