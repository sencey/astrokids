// Destination picking for the commander: which ground cells are valid targets, and how far they really are.
// Pure functions (no React / three scene), so the UI engineer and the tests can call them directly.
import type { XZ } from './slots';
import type { Slot, TerrainData, TerrainFrame } from './types';

export type DestinationMode = null | 'walk' | 'ice';
export type DestinationRejectReason = 'tooFar' | 'notIce' | 'steep';

export interface DestinationPick {
  slotIndex: number;
  point: [number, number, number];
  isPSR: boolean;
  /** real ground distance from the habitat along the terrain (m) */
  distanceM: number;
  kind: 'rim' | 'ice';
}

/** Reach limits (m) and the steepest ground a walker will cross (degrees). */
export const DEST_LIMITS = { walkM: 2000, iceM: 3000, maxSlopeDeg: 20 } as const;

export type DestinationResult = { ok: true; pick: DestinationPick } | { ok: false; reason: DestinationRejectReason };

/** Real distance along the ground between two map points: a polyline over the heightfield, one sample per cell. */
export function groundDistanceM(frame: TerrainFrame, a: XZ, b: XZ): number {
  const horiz = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(horiz / frame.cell));
  const exag = frame.exag || 1;
  let px = a.x;
  let pz = a.z;
  let py = frame.groundY(px, pz) / exag;
  let sum = 0;
  for (let i = 1; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const z = a.z + ((b.z - a.z) * i) / steps;
    const y = frame.groundY(x, z) / exag;
    sum += Math.hypot(x - px, y - py, z - pz);
    px = x;
    pz = z;
    py = y;
  }
  return sum;
}

/** Local ground slope (degrees) at a map cell, from central differences. */
export function cellSlopeDeg(data: TerrainData, c: number, r: number): number {
  const n = data.n;
  const cell = data.meta.cellMeters;
  const at = (rr: number, cc: number) => data.height[Math.max(0, Math.min(n - 1, rr)) * n + Math.max(0, Math.min(n - 1, cc))];
  const gx = (at(r, c + 1) - at(r, c - 1)) / (2 * cell);
  const gz = (at(r + 1, c) - at(r - 1, c)) / (2 * cell);
  return Math.atan(Math.hypot(gx, gz)) * (180 / Math.PI);
}

/** The building slot that contains a world point (clamped to the grid). */
export function slotIndexAt(slots: Slot[], x: number, z: number, cell: number, n: number): number {
  const perSide = Math.round(Math.sqrt(slots.length));
  const c = x / cell + (n - 1) / 2;
  const r = z / cell + (n - 1) / 2;
  const s0 = slots[0];
  const ix = Math.max(0, Math.min(perSide - 1, Math.floor((c - s0.c0) / s0.cells)));
  const iy = Math.max(0, Math.min(perSide - 1, Math.floor((r - s0.r0) / s0.cells)));
  return iy * perSide + ix;
}

/** Is world point (x,z) a valid destination for this mode, measured from the habitat? */
export function evaluateDestination(
  data: TerrainData,
  frame: TerrainFrame,
  slots: Slot[],
  from: XZ,
  mode: 'walk' | 'ice',
  x: number,
  z: number,
): DestinationResult {
  const n = data.n;
  const cell = frame.cell;
  const cf = x / cell + (n - 1) / 2;
  const rf = z / cell + (n - 1) / 2;
  if (cf < 0 || rf < 0 || cf > n - 1 || rf > n - 1) return { ok: false, reason: 'tooFar' };
  const c = Math.round(cf);
  const r = Math.round(rf);
  const isPSR = data.psr[r * n + c] === 1;
  const limit = mode === 'ice' ? DEST_LIMITS.iceM : DEST_LIMITS.walkM;
  if (mode === 'ice' && !isPSR) return { ok: false, reason: 'notIce' };
  // cheap pre-check, then the real polyline distance
  if (Math.hypot(x - from.x, z - from.z) > limit) return { ok: false, reason: 'tooFar' };
  const distanceM = groundDistanceM(frame, from, { x, z });
  if (distanceM > limit) return { ok: false, reason: 'tooFar' };
  if (mode === 'walk' && cellSlopeDeg(data, c, r) > DEST_LIMITS.maxSlopeDeg) return { ok: false, reason: 'steep' };
  return {
    ok: true,
    pick: {
      slotIndex: slotIndexAt(slots, x, z, cell, n),
      point: [x, frame.groundY(x, z), z],
      isPSR,
      distanceM,
      kind: mode === 'ice' || isPSR ? 'ice' : 'rim',
    },
  };
}
