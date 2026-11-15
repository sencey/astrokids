import fs from 'fs';
import path from 'path';
import { fromFile } from 'geotiff';
export const RAW = path.resolve('../../data/terrain/raw');

export function loadWin(name) {
  const m = JSON.parse(fs.readFileSync(path.join(RAW, name + '.json'), 'utf8'));
  const b = fs.readFileSync(path.join(RAW, name + '.f32'));
  m.data = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  return m;
}
// Bilinear sample in PS metres from a window loaded by loadWin (pixel-centre convention, area-registered).
// Returns NaN outside.
export function sampleWin(w, x, y) {
  const fx = (x - w.x0m) / w.resX - 0.5, fy = (y - w.y0m) / w.resY - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= w.W - 1 || j >= w.H - 1) return NaN;
  const tx = fx - i, ty = fy - j, d = w.data, W = w.W;
  const a = d[j * W + i], b = d[j * W + i + 1], c = d[(j + 1) * W + i], e = d[(j + 1) * W + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
}
// Product GeoTIFF (int16 + scale/offset) -> window object, full raster.
export async function loadTif(file, scale, offset) {
  const im = await (await fromFile(file)).getImage();
  const [ox, oy] = im.getOrigin(); const [rx, ry] = im.getResolution();
  const r = await im.readRasters({ interleave: true });
  return { W: im.getWidth(), H: im.getHeight(), x0m: ox, y0m: oy, resX: rx, resY: ry, raw: r, scale, offset };
}
