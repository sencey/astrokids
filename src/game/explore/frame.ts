// Fit-to-bounds for the isometric explore camera: which places to show at the start of an outing, and how far back to stand. Pure TS.
import { isDiscoverable } from './pois';
import type { Poi } from './pois';

const D2R = Math.PI / 180;

export interface FitView {
  /** point on the ground the camera looks at */
  x: number;
  z: number;
  /** camera distance from that point, metres */
  dist: number;
}

export interface FitOpts {
  aspect: number;
  fovDeg: number;
  pitchDeg: number;
  /** extra room around the points (1.3 = 30%) */
  pad?: number;
  /** height of the things drawn at each point (flags, the commander), metres */
  heightM?: number;
  minDist: number;
  maxDist: number;
}

/** Camera target and distance so that every point is on screen (bounding circle, foreshortened vertically by the pitch). */
export function fitView(points: readonly { x: number; z: number }[], o: FitOpts): FitView {
  const pad = o.pad ?? 1.35;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  let r = 0;
  for (const p of points) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
  const t = Math.tan((o.fovDeg * D2R) / 2);
  const need = Math.max((r * pad) / (t * Math.max(0.2, o.aspect)), ((r * Math.sin(o.pitchDeg * D2R) + (o.heightM ?? 0)) * pad) / t);
  return { x: cx, z: cz, dist: Math.max(o.minDist, Math.min(o.maxDist, need)) };
}

/** Nearest undiscovered points of interest within `rangeM` of (x,z), nearest first. */
export function nearestInRange(pois: readonly Poi[], found: ReadonlySet<string>, x: number, z: number, rangeM: number, max = 3): Poi[] {
  return pois
    .filter((p) => isDiscoverable(p) && !found.has(p.id) && Math.hypot(p.x - x, p.z - z) <= rangeM)
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
    .slice(0, max);
}

/**
 * Start-of-outing framing: the commander plus the nearest 2-3 undiscovered places in range. The first place is always
 * included; the others only while the view still fits under `capDist` (so a far one never shrinks everything to dots).
 */
export function outingFraming(
  pois: readonly Poi[],
  found: ReadonlySet<string>,
  from: { x: number; z: number },
  rangeM: number,
  o: FitOpts & { capDist: number },
): FitView & { ids: string[] } {
  const near = nearestInRange(pois, found, from.x, from.z, rangeM, 3);
  const pts: { x: number; z: number }[] = [from];
  const ids: string[] = [];
  let view = fitView(pts, o);
  for (const p of near) {
    const v = fitView([...pts, p], o);
    if (ids.length > 0 && v.dist > o.capDist) continue;
    pts.push(p);
    ids.push(p.id);
    view = v;
  }
  return { ...view, ids };
}
