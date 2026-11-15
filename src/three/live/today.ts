// "Today's Moon": Sun/Earth for NOW at the site (astronomy-engine, same frames as scripts/terrain) and a
// cheap horizon test against height.bin for just the placed slots. Ported from scripts/terrain/{ephem,build}.mjs.
import type { DaySeries, Slot, TerrainData } from '../types';

type AE = typeof import('astronomy-engine');
const D2R = Math.PI / 180;
const AU_KM = 149597870.7;
type V3 = [number, number, number];

function moonRotation(d: number) {
  const T = d / 36525;
  const E = (a: number, b: number) => (a + b * d) * D2R;
  const E1 = E(125.045, -0.0529921), E2 = E(250.089, -0.1059842), E3 = E(260.008, 13.0120009), E4 = E(176.625, 13.3407154),
    E5 = E(357.529, 0.9856003), E6 = E(311.589, 26.4057084), E7 = E(134.963, 13.064993), E8 = E(276.617, 0.3287146),
    E9 = E(34.226, 1.7484877), E10 = E(15.134, -0.1589763), E11 = E(119.743, 0.0036096), E12 = E(239.961, 0.1643573), E13 = E(25.053, 12.9590088);
  const ra = 269.9949 + 0.0031 * T - 3.8787 * Math.sin(E1) - 0.1204 * Math.sin(E2) + 0.07 * Math.sin(E3) - 0.0172 * Math.sin(E4) + 0.0072 * Math.sin(E6) - 0.0052 * Math.sin(E10) + 0.0043 * Math.sin(E13);
  const dec = 66.5392 + 0.013 * T + 1.5419 * Math.cos(E1) + 0.0239 * Math.cos(E2) - 0.0278 * Math.cos(E3) + 0.0068 * Math.cos(E4) - 0.0029 * Math.cos(E6) + 0.0009 * Math.cos(E7) + 0.0008 * Math.cos(E10) - 0.0009 * Math.cos(E13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * Math.sin(E1) + 0.1208 * Math.sin(E2) - 0.0642 * Math.sin(E3) + 0.0158 * Math.sin(E4) + 0.0252 * Math.sin(E5) - 0.0066 * Math.sin(E6) - 0.0047 * Math.sin(E7) - 0.0046 * Math.sin(E8) + 0.0028 * Math.sin(E9) + 0.0052 * Math.sin(E10) + 0.004 * Math.sin(E11) + 0.0019 * Math.sin(E12) - 0.0044 * Math.sin(E13);
  return { ra, dec, W };
}
type M3 = number[][];
const Rz = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; };
const Rx = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; };
const mm = (a: M3, b: M3): M3 => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
const mv = (m: M3, v: number[]): V3 => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V3;
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Moon-centred vectors (km) to the Sun and Earth in the Moon body-fixed frame. */
export function bodyVectors(A: AE, date: Date): { toSun: V3; toEarth: V3 } {
  const t = new A.AstroTime(date);
  const { ra, dec, W } = moonRotation(t.tt);
  const R = mm(Rz(W * D2R), mm(Rx((90 - dec) * D2R), Rz((ra + 90) * D2R)));
  const m = A.GeoMoon(t);
  const s = A.GeoVector(A.Body.Sun, t, false);
  const moon: V3 = [m.x * AU_KM, m.y * AU_KM, m.z * AU_KM];
  const sun: V3 = [s.x * AU_KM, s.y * AU_KM, s.z * AU_KM];
  return { toSun: mv(R, sun.map((v, i) => v - moon[i])), toEarth: mv(R, moon.map((v) => -v)) };
}

/** Local frame at polar-stereographic (x,y) metres: unit position u, grid east ex (+x_ps), grid north ey (+y_ps). */
export function localFrame(x: number, y: number, R: number) {
  const rho = Math.hypot(x, y), lam = Math.atan2(x, y), phi = -Math.PI / 2 + 2 * Math.atan(rho / (2 * R));
  const cp = Math.cos(phi), sp = Math.sin(phi), cl = Math.cos(lam), sl = Math.sin(lam);
  const u: V3 = [cp * cl, cp * sl, sp];
  const east = [-sl, cl, 0], north = [-sp * cl, -sp * sl, cp];
  const ex: V3 = [0, 1, 2].map((k) => sl * north[k] + cl * east[k]) as V3;
  const ey: V3 = [0, 1, 2].map((k) => cl * north[k] - sl * east[k]) as V3;
  return { u, ex, ey };
}

const azel = (dir: number[], f: { u: number[]; ex: number[]; ey: number[] }) => {
  const n = Math.hypot(dir[0], dir[1], dir[2]);
  const d = dir.map((q) => q / n);
  let az = Math.atan2(dot(d, f.ex), dot(d, f.ey)) / D2R;
  if (az < 0) az += 360;
  return { az, el: Math.asin(Math.max(-1, Math.min(1, dot(d, f.u)))) / D2R };
};

interface Geo {
  cx: number;
  cy: number;
  half: number;
  cell: number;
  R: number;
}
export function geoOf(meta: TerrainData['meta']): Geo {
  const c = (meta as unknown as { centerPolarStereoM?: [number, number] }).centerPolarStereoM ?? [-4500, -9000];
  const ext = (meta as unknown as { extentMeters?: number }).extentMeters ?? meta.size * meta.cellMeters;
  return { cx: c[0], cy: c[1], half: ext / 2, cell: meta.cellMeters, R: meta.referenceRadiusM };
}
const gx = (g: Geo, col: number) => g.cx - g.half + (col + 0.5) * g.cell;
const gy = (g: Geo, row: number) => g.cy + g.half - (row + 0.5) * g.cell;

/** Highest horizon elevation (deg) seen from a cell along an azimuth, marching the DEM (curvature drop d^2/2R included). */
export function horizonDeg(d: Pick<TerrainData, 'n' | 'height'>, g: Geo, row: number, col: number, azDeg: number): number {
  const n = d.n;
  const sx = Math.sin(azDeg * D2R), sy = Math.cos(azDeg * D2R);
  const h0 = d.height[Math.round(row) * n + Math.round(col)];
  let best = -90;
  for (let k = 1; k < n * 1.5; k++) {
    const c = Math.round(col + sx * k), r = Math.round(row - sy * k);
    if (c < 0 || r < 0 || c >= n || r >= n) break;
    const dist = k * g.cell;
    const ang = Math.atan2(d.height[r * n + c] - h0 - (dist * dist) / (2 * g.R), dist) / D2R;
    if (ang > best) best = ang;
  }
  return best;
}

const iso = (d: Date) => d.toISOString().slice(0, 16) + 'Z';

export interface TodayData {
  date: string;
  nowIso: string;
  sun: DaySeries;
  earth: DaySeries;
  /** % of the UTC day each placed slot is sunlit (point Sun, DEM horizon inside the 18 km map only) */
  litBySlot: Map<number, number>;
  /** Sun elevation at the site centre */
  sunNow: { az: number; el: number };
  maxSunEl: number;
}

/** Sun/Earth hourly for the UTC day of `now` at the site centre + lit % per slot (30-min steps, 2x2 samples per slot). */
export async function computeToday(data: TerrainData, slots: Slot[], now: Date): Promise<TodayData> {
  const A: AE = await import('astronomy-engine');
  const g = geoOf(data.meta);
  const n = data.n;
  const centre = localFrame(g.cx, g.cy, g.R);
  const hc = data.height[(n >> 1) * n + (n >> 1)];
  const P = centre.u.map((q) => (q * (g.R + hc)) / 1000);
  const toBody = (v: V3) => azel(v.map((q, k) => q - P[k]), centre);
  const day0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const date = new Date(day0).toISOString().slice(0, 10);
  const hoursSun: DaySeries['hours'] = [];
  const hoursEarth: DaySeries['hours'] = [];
  let maxSunEl = -90;
  for (let h = 0; h < 24; h++) {
    const t = new Date(day0 + h * 3600000);
    const { toSun, toEarth } = bodyVectors(A, t);
    const s = toBody(toSun);
    const e = toBody(toEarth);
    maxSunEl = Math.max(maxSunEl, s.el);
    hoursSun.push({ t: iso(t), azDeg: s.az, elDeg: s.el });
    hoursEarth.push({ t: iso(t), azDeg: e.az, elDeg: e.el });
  }
  const frames = new Map<number, { f: ReturnType<typeof localFrame>; pts: [number, number][] }>();
  for (const s of slots) {
    const pts: [number, number][] = [];
    for (const dr of [0.25, 0.75]) for (const dc of [0.25, 0.75]) pts.push([s.r0 + s.cells * dr, s.c0 + s.cells * dc]);
    frames.set(s.index, { f: localFrame(gx(g, s.c0 + s.cells / 2), gy(g, s.r0 + s.cells / 2), g.R), pts });
  }
  const lit = new Map<number, number>(slots.map((s) => [s.index, 0]));
  const steps = 48;
  for (let k = 0; k < steps; k++) {
    const { toSun } = bodyVectors(A, new Date(day0 + ((k + 0.5) * 86400000) / steps));
    const sn = Math.hypot(...toSun);
    const S = toSun.map((q) => q / sn);
    for (const s of slots) {
      const { pts } = frames.get(s.index)!;
      let up = 0;
      for (const [r, c] of pts) {
        const f = localFrame(gx(g, c), gy(g, r), g.R);
        const el = Math.asin(Math.max(-1, Math.min(1, dot(S, f.u)))) / D2R;
        if (el < -5) continue;
        let az = Math.atan2(dot(S, f.ex), dot(S, f.ey)) / D2R;
        if (az < 0) az += 360;
        if (el > horizonDeg(data, g, r, c, az)) up++;
      }
      lit.set(s.index, lit.get(s.index)! + up / pts.length);
    }
  }
  const litBySlot = new Map<number, number>();
  for (const [i, v] of lit) litBySlot.set(i, Math.round((v / steps) * 1000) / 10);
  const sunNow = (() => {
    const { toSun } = bodyVectors(A, now);
    return toBody(toSun);
  })();
  return { date, nowIso: now.toISOString(), sun: { date, hours: hoursSun }, earth: { date, hours: hoursEarth }, litBySlot, sunNow, maxSunEl };
}
