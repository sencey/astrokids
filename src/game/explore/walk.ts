// Tap-to-move path planning on the height map: a straight line sampled over the ground. Pure TS.
import { EXPLORE } from './config';

export type XZ = readonly [number, number];

export interface WalkPlan {
  /** polyline in world metres, starting at `from`; the last point is where the walk really ends */
  points: XZ[];
  lengthM: number;
  /** the walk ended before the tapped spot */
  stoppedBy: 'steep' | 'edge' | 'range' | null;
}

export interface WalkOpts {
  /** ground height in metres at world x,z (any consistent datum) */
  heightAt: (x: number, z: number) => number;
  /** half of the map extent in metres; walks stop inside this square */
  halfExtent: number;
  /** longest walk allowed (energy left) */
  maxLenM: number;
  slopeLimitDeg?: number;
  /** sampling step in metres (default 30) */
  stepM?: number;
}

/** Straight walk from -> to. Stops at the last sample before ground steeper than the limit, at the map edge, or when the range runs out. */
export function planWalk(from: XZ, to: XZ, o: WalkOpts): WalkPlan {
  const limit = Math.tan(((o.slopeLimitDeg ?? EXPLORE.slopeLimitDeg) * Math.PI) / 180);
  const step = o.stepM ?? 30;
  const edge = o.halfExtent * 0.96;
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const total = Math.hypot(dx, dz);
  const points: XZ[] = [from];
  if (total < 1e-6) return { points, lengthM: 0, stoppedBy: null };
  const ux = dx / total;
  const uz = dz / total;
  let stoppedBy: WalkPlan['stoppedBy'] = null;
  let prevH = o.heightAt(from[0], from[1]);
  let d = 0;
  while (d < total) {
    const nd = Math.min(total, d + step);
    const x = from[0] + ux * nd;
    const z = from[1] + uz * nd;
    if (Math.abs(x) > edge || Math.abs(z) > edge) {
      stoppedBy = 'edge';
      break;
    }
    if (nd > o.maxLenM) {
      stoppedBy = 'range';
      break;
    }
    const h = o.heightAt(x, z);
    if (Math.abs(h - prevH) / (nd - d) > limit) {
      stoppedBy = 'steep';
      break;
    }
    prevH = h;
    d = nd;
    points.push([x, z]);
  }
  // when stopped by range, walk the remaining metres up to the limit if the ground allows (the last sample is below)
  if (stoppedBy === 'range' && o.maxLenM - d > 1) {
    const nd = o.maxLenM;
    const x = from[0] + ux * nd;
    const z = from[1] + uz * nd;
    if (Math.abs(o.heightAt(x, z) - prevH) / (nd - d) <= limit) {
      points.push([x, z]);
      d = nd;
    }
  }
  return { points, lengthM: d, stoppedBy };
}

/** Length of a polyline. */
export function polyLength(pts: readonly XZ[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** Point `dist` metres along a polyline, plus the heading (radians, atan2(dx, dz)) of the segment it lies on. */
export function pointAlong(pts: readonly XZ[], dist: number): { x: number; z: number; heading: number; done: boolean } {
  let left = Math.max(0, dist);
  let hd = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dz = pts[i][1] - pts[i - 1][1];
    const seg = Math.hypot(dx, dz);
    if (seg > 1e-9) hd = Math.atan2(dx, dz);
    if (left <= seg && seg > 1e-9) {
      const k = left / seg;
      return { x: pts[i - 1][0] + dx * k, z: pts[i - 1][1] + dz * k, heading: hd, done: false };
    }
    left -= seg;
  }
  const last = pts[pts.length - 1];
  return { x: last[0], z: last[1], heading: hd, done: true };
}

/** Thin out a dense breadcrumb trail (keeps the ends) so the way home stays short. */
export function thin(pts: readonly XZ[], minGapM: number): XZ[] {
  if (pts.length < 3) return pts.slice();
  const out: XZ[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const l = out[out.length - 1];
    if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= minGapM) out.push(pts[i]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
