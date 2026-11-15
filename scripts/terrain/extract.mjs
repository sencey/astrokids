// Fetch DEM windows (range reads of NASA PGDA cloud-optimised GeoTIFFs) into data/terrain/raw/*.f32 caches.
import { fromUrl, fromFile } from 'geotiff';
import fs from 'fs';
import path from 'path';
import { SITE } from './site.mjs';

const RAW = path.resolve('../../data/terrain/raw');
fs.mkdirSync(RAW, { recursive: true });

async function window(url, halfWidthM, cx, cy, outName) {
  const t = await fromUrl(url);
  const im = await t.getImage();
  const [ox, oy] = im.getOrigin();
  const [rx, ry] = im.getResolution();
  const x0 = Math.floor((cx - halfWidthM - ox) / rx), x1 = Math.ceil((cx + halfWidthM - ox) / rx);
  const y0 = Math.floor((cy + halfWidthM - oy) / ry), y1 = Math.ceil((cy - halfWidthM - oy) / ry);
  const r = await im.readRasters({ window: [x0, y0, x1, y1], interleave: true });
  const W = x1 - x0, H = y1 - y0;
  const a = Float32Array.from(r);
  fs.writeFileSync(path.join(RAW, outName + '.f32'), Buffer.from(a.buffer));
  const meta = { url, W, H, x0m: ox + x0 * rx, y0m: oy + y0 * ry, resX: rx, resY: ry, fetchedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(RAW, outName + '.json'), JSON.stringify(meta, null, 1));
  console.log(outName, meta);
}
const base = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/';
await window(base + 'LDEM_80S_20MPP_ADJ.TIF', 13000, SITE.cx, SITE.cy, 'dem_inner_20m');
await window(base + 'LDEM_80S_80MPP_ADJ.TIF', 80000, SITE.cx, SITE.cy, 'dem_outer_80m');
