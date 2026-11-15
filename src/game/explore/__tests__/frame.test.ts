import { describe, expect, it } from 'vitest';
import { fitView, nearestInRange, outingFraming } from '../frame';
import { derivePois } from '../pois';
import { loadReal } from './realData';

const O = { aspect: 0.46, fovDeg: 24, pitchDeg: 35, minDist: 1100, maxDist: 12000, capDist: 9000, heightM: 90 };
const real = loadReal();
const pois = derivePois(real.data, real.home);
const start = { x: real.home.x + 40, z: real.home.z + 24 };

describe('iso fit-to-bounds', () => {
  it('stands farther back for wider bounds and for portrait screens', () => {
    const a = fitView([{ x: 0, z: 0 }, { x: 400, z: 0 }], { ...O, aspect: 1.6 });
    const b = fitView([{ x: 0, z: 0 }, { x: 1600, z: 0 }], { ...O, aspect: 1.6 });
    const c = fitView([{ x: 0, z: 0 }, { x: 400, z: 0 }], { ...O, aspect: 0.46 });
    expect(b.dist).toBeGreaterThan(a.dist);
    expect(c.dist).toBeGreaterThan(a.dist);
    expect(a.x).toBeCloseTo(200);
  });
  it('keeps every point inside the view (bounding circle fits the half-width)', () => {
    const pts = [{ x: 0, z: 0 }, { x: 900, z: -300 }, { x: 300, z: 700 }];
    const v = fitView(pts, { ...O, pad: 1.2 });
    const half = v.dist * Math.tan((O.fovDeg * Math.PI) / 360) * O.aspect;
    for (const p of pts) expect(Math.hypot(p.x - v.x, p.z - v.z)).toBeLessThanOrEqual(half + 1e-6);
  });
  it('clamps to the allowed distance range', () => {
    expect(fitView([{ x: 0, z: 0 }], O).dist).toBe(O.minDist);
    expect(fitView([{ x: 0, z: 0 }, { x: 90000, z: 0 }], O).dist).toBe(O.maxDist);
  });
  it('frames the commander plus the nearest undiscovered places in range, on real data', () => {
    const near = nearestInRange(pois, new Set(), start.x, start.z, 2000);
    expect(near.length).toBeGreaterThanOrEqual(2);
    const f = outingFraming(pois, new Set(), start, 2000, O);
    expect(f.ids.length).toBeGreaterThanOrEqual(2);
    expect(f.ids.length).toBeLessThanOrEqual(3);
    expect(f.dist).toBeGreaterThan(O.minDist);
    expect(f.dist).toBeLessThanOrEqual(O.capDist);
  });
  it('ignores found places and places out of range; falls back to the commander alone', () => {
    const all = new Set(pois.map((p) => p.id));
    expect(outingFraming(pois, all, start, 2000, O).ids).toEqual([]);
    expect(outingFraming(pois, new Set(), start, 100, O).ids).toEqual([]);
    expect(outingFraming(pois, new Set(), start, 100, O).dist).toBe(O.minDist);
  });
});
