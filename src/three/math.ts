import type { DaySeries, TerrainData, TerrainFrame } from './types';

export const DEG = Math.PI / 180;

/** Unit vector pointing at (azimuth from grid north clockwise, elevation). x east, y up, z south. */
export function skyVec(azDeg: number, elDeg: number): [number, number, number] {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

function lerpAngleDeg(a: number, b: number, f: number): number {
  let d = (((b - a) % 360) + 540) % 360 - 180;
  if (d === -180) d = 180;
  return (a + d * f + 360) % 360;
}

/** Sample a per-day hourly series at fractional day + hour (0..24). Works for any number of samples per day. */
export function sampleSeries(series: DaySeries[], day: number, hour: number): { az: number; el: number } {
  const di = Math.max(0, Math.min(series.length - 1, Math.floor(day)));
  const cur = series[di].hours;
  const pos = (Math.max(0, Math.min(24, hour)) / 24) * cur.length;
  const i = Math.min(cur.length - 1, Math.floor(pos));
  const f = pos - i;
  const a = cur[i];
  let b = cur[i + 1];
  if (!b) b = series[di + 1]?.hours[0] ?? a;
  return { az: lerpAngleDeg(a.azDeg, b.azDeg, f), el: a.elDeg + (b.elDeg - a.elDeg) * f };
}

export function heightRaw(d: Pick<TerrainData, 'n' | 'height'>, cell: number, x: number, z: number): number {
  const n = d.n;
  const cf = Math.max(0, Math.min(n - 1.001, x / cell + (n - 1) / 2));
  const rf = Math.max(0, Math.min(n - 1.001, z / cell + (n - 1) / 2));
  const c = Math.floor(cf);
  const r = Math.floor(rf);
  const fc = cf - c;
  const fr = rf - r;
  const h = d.height;
  const a = h[r * n + c];
  const b = h[r * n + c + 1];
  const e = h[(r + 1) * n + c];
  const f = h[(r + 1) * n + c + 1];
  return a * (1 - fc) * (1 - fr) + b * fc * (1 - fr) + e * (1 - fc) * fr + f * fc * fr;
}

export function makeFrame(d: TerrainData, exag: number): TerrainFrame {
  const cell = d.meta.cellMeters;
  let sum = 0;
  for (let i = 0; i < d.height.length; i++) sum += d.height[i];
  const baseH = sum / d.height.length;
  return {
    n: d.n,
    cell,
    extent: d.n * cell,
    exag,
    baseH,
    groundY: (x, z) => (heightRaw(d, cell, x, z) - baseH) * exag,
  };
}
