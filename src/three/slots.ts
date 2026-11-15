import { CONFIG } from './config';
import type { Slot, SlotStats, TerrainData } from './types';

/** 16x16 grid of slots over the map; slope = mean per-cell gradient magnitude inside the slot. */
export function buildSlots(d: TerrainData, maxSlopeDeg: number = CONFIG.maxSlopeDeg, perSide: number = CONFIG.slotsPerSide): Slot[] {
  const n = d.n;
  const cell = d.meta.cellMeters;
  const cells = Math.floor(n / perSide);
  const off = Math.floor((n - cells * perSide) / 2);
  const h = d.height;
  const at = (r: number, c: number) => h[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))];
  const slots: Slot[] = [];
  for (let iy = 0; iy < perSide; iy++) {
    for (let ix = 0; ix < perSide; ix++) {
      const c0 = off + ix * cells;
      const r0 = off + iy * cells;
      let sum = 0;
      let cnt = 0;
      for (let r = r0; r < r0 + cells; r++) {
        for (let c = c0; c < c0 + cells; c++) {
          const gx = (at(r, c + 1) - at(r, c - 1)) / (2 * cell);
          const gz = (at(r + 1, c) - at(r - 1, c)) / (2 * cell);
          sum += Math.atan(Math.hypot(gx, gz));
          cnt++;
        }
      }
      const slopeDeg = (sum / cnt) * (180 / Math.PI);
      slots.push({
        index: iy * perSide + ix,
        ix,
        iy,
        c0,
        r0,
        cells,
        x: (c0 + cells / 2 - 0.5 - (n - 1) / 2) * cell,
        z: (r0 + cells / 2 - 0.5 - (n - 1) / 2) * cell,
        slopeDeg,
        buildable: slopeDeg <= maxSlopeDeg,
      });
    }
  }
  return slots;
}

/** Slots per side of the fine world build grid (~280-320 m spacing on the 18 km map): enough free pads around the commander at the default zoom. */
export const WORLD_SLOTS_PER_SIDE = 56;
/** The fine build grid for the explore-first world; use it as THE slot list (buildings, stats, engine) so every index agrees. Stats: makeStatsGetter(data, slots). */
export const buildWorldSlots = (d: TerrainData, maxSlopeDeg: number = CONFIG.maxSlopeDeg): Slot[] => buildSlots(d, maxSlopeDeg, WORLD_SLOTS_PER_SIDE);

/** Stats for one slot (lazy; cached per terrain+slot by the caller via makeStatsGetter). */
export function computeSlotStats(d: TerrainData, s: Slot): SlotStats {
  const n = d.n;
  const cnt = s.cells * s.cells;
  let illum = 0;
  let psr = 0;
  const litSum = new Array<number>(d.dayCount).fill(0);
  for (let r = s.r0; r < s.r0 + s.cells; r++) {
    for (let c = s.c0; c < s.c0 + s.cells; c++) {
      const i = r * n + c;
      illum += d.illum[i];
      psr += d.psr[i];
      for (let k = 0; k < d.dayCount; k++) litSum[k] += d.lit[k * n * n + i];
    }
  }
  const isPSR = psr / cnt >= 0.5;
  // Distance (m) from slot centre to the nearest permanently shadowed cell.
  let best = Infinity;
  const cx = s.c0 + s.cells / 2;
  const cy = s.r0 + s.cells / 2;
  if (psr > 0 && isPSR) best = 0;
  else {
    for (let i = 0; i < n * n; i++) {
      if (!d.psr[i]) continue;
      const dc = (i % n) - cx;
      const dr = Math.floor(i / n) - cy;
      const q = dc * dc + dr * dr;
      if (q < best) best = q;
    }
    best = Number.isFinite(best) ? Math.sqrt(best) * d.meta.cellMeters : Infinity;
  }
  return {
    illumPct: illum / cnt,
    litPctByDay: litSum.map((v) => v / cnt),
    isPSR,
    slopeDeg: s.slopeDeg,
    distanceToNearestPSRm: best,
  };
}

export function makeStatsGetter(d: TerrainData, slots: Slot[]): (slot: Slot | number) => SlotStats {
  const cache = new Map<number, SlotStats>();
  return (slot) => {
    const s = typeof slot === 'number' ? slots[slot] : slot;
    let v = cache.get(s.index);
    if (!v) {
      v = computeSlotStats(d, s);
      cache.set(s.index, v);
    }
    return v;
  };
}

/** Where the lander is pre-placed: a flat, well-lit buildable slot (flattest/central one if no illumination function is given). */
export function landerSlot(slots: Slot[], illumOf?: (s: Slot) => number): Slot {
  const pool = slots.filter((s) => s.buildable);
  const list = pool.length ? pool : slots;
  let best = list[0];
  let bs = Infinity;
  for (const s of list) {
    // with illumination known: well lit and flat wins; otherwise flat and central
    const score = illumOf ? s.slopeDeg * 3 - illumOf(s) : s.slopeDeg * 40 + Math.hypot(s.x, s.z) * 0.02;
    if (score < bs) {
      bs = score;
      best = s;
    }
  }
  return best;
}

export interface XZ {
  x: number;
  z: number;
}

const cellToWorld = (d: TerrainData, c: number, r: number): XZ => ({
  x: (c - (d.n - 1) / 2) * d.meta.cellMeters,
  z: (r - (d.n - 1) / 2) * d.meta.cellMeters,
});

/** World position of the permanently shadowed cell nearest to the slot centre (null if the map has none). */
export function nearestPSRPoint(d: TerrainData, s: Slot): XZ | null {
  const cx = s.c0 + s.cells / 2;
  const cy = s.r0 + s.cells / 2;
  let best = Infinity;
  let bi = -1;
  for (let i = 0; i < d.n * d.n; i++) {
    if (!d.psr[i]) continue;
    const dc = (i % d.n) - cx;
    const dr = Math.floor(i / d.n) - cy;
    const q = dc * dc + dr * dr;
    if (q < best) {
      best = q;
      bi = i;
    }
  }
  return bi < 0 ? null : cellToWorld(d, bi % d.n, Math.floor(bi / d.n));
}

/** A sunlit "rim" to walk to: the highest ground 0.8-3 km from the slot centre. */
export function rimPoint(d: TerrainData, s: Slot): XZ {
  const cell = d.meta.cellMeters;
  const cx = s.c0 + s.cells / 2;
  const cy = s.r0 + s.cells / 2;
  const rMin = 800 / cell;
  const rMax = 3000 / cell;
  let bh = -Infinity;
  let bi = -1;
  for (let r = Math.max(0, Math.floor(cy - rMax)); r <= Math.min(d.n - 1, Math.ceil(cy + rMax)); r++) {
    for (let c = Math.max(0, Math.floor(cx - rMax)); c <= Math.min(d.n - 1, Math.ceil(cx + rMax)); c++) {
      const dist = Math.hypot(c - cx, r - cy);
      if (dist < rMin || dist > rMax) continue;
      const h = d.height[r * d.n + c];
      if (h > bh) {
        bh = h;
        bi = r * d.n + c;
      }
    }
  }
  return bi < 0 ? { x: s.x + 1500, z: s.z } : cellToWorld(d, bi % d.n, Math.floor(bi / d.n));
}