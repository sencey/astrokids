// Contact sheet:  node scripts/video/film-sheet.mjs <out.jpg> <cols> <tileWidth> <dir> [prefix-or-substring]
//   or            node scripts/video/film-sheet.mjs <out.jpg> <cols> <tileWidth> --files a.png b.png ...
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const [out, colsS, wS, ...rest] = process.argv.slice(2);
const cols = Number(colsS);
const w = Number(wS);
let files;
if (rest[0] === '--files') files = rest.slice(1);
else {
  const dir = rest[0];
  const sub = rest[1] ?? '';
  files = fs.readdirSync(dir).filter((f) => f.endsWith('.png') && f.includes(sub)).sort().map((f) => path.join(dir, f));
}
if (!files.length) throw new Error('no input files');
const h = Math.round((w * 9) / 16 / 2) * 2;
const rows = Math.ceil(files.length / cols);
const inputs = files.flatMap((f) => ['-i', f]);
let fc = files.map((_, i) => `[${i}:v]scale=${w}:${h}:flags=bilinear,format=rgb24[s${i}]`).join(';');
const rowLabels = [];
for (let r = 0; r < rows; r++) {
  const idx = [];
  for (let c = 0; c < cols; c++) { const i = r * cols + c; idx.push(i < files.length ? `[s${i}]` : null); }
  const labels = idx.map((l, c) => l ?? `[b${r}_${c}]`);
  idx.forEach((l, c) => { if (!l) fc += `;color=c=black:s=${w}x${h}:d=1,format=rgb24[b${r}_${c}]`; });
  fc += `;${labels.join('')}hstack=inputs=${cols}[r${r}]`;
  rowLabels.push(`[r${r}]`);
}
fc += `;${rowLabels.join('')}vstack=inputs=${rows}[o]`;
const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log('wrote', out);
