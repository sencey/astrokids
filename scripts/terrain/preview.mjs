import { fromFile } from 'geotiff';
import { PNG } from 'pngjs';
import fs from 'fs';
import { loadWin, sampleWin, RAW, loadTif } from './lib.mjs';
import { SITE } from './site.mjs';
const inner = loadWin('dem_inner_20m');
const ill = await loadTif(RAW + '/AVGVISIB_85S_060M_201608.TIF');
const psr = await loadTif(RAW + '/LPSR_85S_060M_201608.TIF');
const h = {}; for (const v of psr.raw) h[v] = (h[v] || 0) + 1; console.log('psr values', h);
const N = 256, cell = 2 * SITE.half / N;
const png = new PNG({ width: N, height: N });
let nPsr = 0, nZero = 0, both = 0;
const H = new Float32Array(N * N);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = SITE.cx - SITE.half + (j + .5) * cell, y = SITE.cy + SITE.half - (i + .5) * cell;
  H[i * N + j] = sampleWin(inner, x, y);
}
let mn = 1e9, mx = -1e9; for (const v of H) { mn = Math.min(mn, v); mx = Math.max(mx, v); } console.log('elev', mn, mx);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = SITE.cx - SITE.half + (j + .5) * cell, y = SITE.cy + SITE.half - (i + .5) * cell;
  const pi = Math.floor((x - ill.x0m) / ill.resX), pj = Math.floor((y - ill.y0m) / ill.resY);
  const iv = ill.raw[pj * ill.W + pi] * 4e-5 * 100, pv = psr.raw[pj * psr.W + pi];
  const k = (i * N + j) * 4;
  const e = (H[i * N + j] - mn) / (mx - mn) * 255;
  png.data[k] = e; png.data[k + 1] = e; png.data[k + 2] = e; png.data[k + 3] = 255;
  if (pv > 0) { nPsr++; png.data[k] = 0; png.data[k + 1] = 0; png.data[k + 2] = 255; }
  if (iv == 0) nZero++;
  if (iv == 0 && pv > 0) both++;
  if (iv > 40) { png.data[k] = 255; png.data[k+1]=255; png.data[k+2]=0; }
}
console.log({ nPsr, nZero, both });
fs.writeFileSync(process.argv[2], PNG.sync.write(png));
