import { describe, expect, it } from 'vitest';
import { EXPLORE } from '../config';
import {
  addWalk,
  createMask,
  dailyMissions,
  decodeProgress,
  discoverNear,
  earnedBadges,
  emptyProgress,
  encodeProgress,
  energyLeft,
  energyUsed,
  exploredFraction,
  isSpent,
  loadProgress,
  MISSION_POOL,
  newOuting,
  packMask,
  rangeLeftM,
  revealDisc,
  saveProgress,
  scienceOf,
  snapToPoi,
  unpackMask,
} from '../explore';
import { derivePois, isDiscoverable, wordCount } from '../pois';
import { planWalk, pointAlong, polyLength } from '../walk';
import { loadReal } from './realData';

const real = loadReal();
const pois = derivePois(real.data, real.home);

describe('pois (real Connecting Ridge data)', () => {
  it('derives 8-12 distinct points with every required field', () => {
    expect(pois.length).toBeGreaterThanOrEqual(8);
    expect(pois.length).toBeLessThanOrEqual(12);
    expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
    for (const p of pois) {
      expect(p.nameTr.length).toBeGreaterThan(2);
      expect(p.nameEn.length).toBeGreaterThan(2);
      expect(wordCount(p.factTr)).toBeLessThanOrEqual(18);
      expect(wordCount(p.factEn)).toBeLessThanOrEqual(18);
      expect(p.source.url).toMatch(/^https:\/\//);
      expect(p.source.name.length).toBeGreaterThan(3);
      expect([1, 2, 3]).toContain(p.science);
      expect(p.grid[0]).toBeGreaterThanOrEqual(0);
      expect(p.grid[1]).toBeLessThan(real.data.n);
    }
  });
  it('has the required kinds', () => {
    const k = (kind: string) => pois.filter((p) => p.kind === kind).length;
    expect(k('ice')).toBeGreaterThanOrEqual(2);
    expect(k('sun')).toBe(1);
    expect(k('rim')).toBe(1);
    expect(k('earth')).toBe(1);
    expect(k('base')).toBe(1);
    expect(k('geology')).toBeGreaterThanOrEqual(2);
  });
  it('ice points really sit in permanent shadow, the sun point in strong light', () => {
    const n = real.data.n;
    for (const p of pois.filter((q) => q.kind === 'ice')) expect(real.data.psr[p.grid[1] * n + p.grid[0]]).toBe(1);
    const sun = pois.find((p) => p.kind === 'sun')!;
    expect(real.data.illum[sun.grid[1] * n + sun.grid[0]]).toBeGreaterThan(60);
  });
  it('every point can be walked to within the range limit and is well spread out', () => {
    for (const p of pois) expect(p.walkM).toBeLessThanOrEqual(EXPLORE.maxPoiWalkM);
    for (let i = 0; i < pois.length; i++) {
      for (let j = i + 1; j < pois.length; j++) expect(Math.hypot(pois[i].x - pois[j].x, pois[i].z - pois[j].z)).toBeGreaterThanOrEqual(EXPLORE.minPoiSpacingM - 1);
    }
  });
  it('keeps ice and sun close and everything within a 6-energy outing', () => {
    const e = (p: { walkM: number }) => Math.ceil(p.walkM / EXPLORE.metersPerEnergy);
    const ice = pois.filter((p) => p.kind === 'ice');
    expect(Math.min(...ice.map((p) => p.walkM))).toBeLessThanOrEqual(1500);
    expect(pois.find((p) => p.kind === 'sun')!.walkM).toBeLessThanOrEqual(1000);
    const real = pois.filter(isDiscoverable);
    expect(real.filter((p) => e(p) <= 2).length).toBeGreaterThanOrEqual(2);
    expect(real.every((p) => e(p) <= 6)).toBe(true);
  });
  it('is deterministic', () => {
    expect(derivePois(real.data, real.home).map((p) => p.id + p.grid.join())).toEqual(pois.map((p) => p.id + p.grid.join()));
  });
});

describe('walk planning', () => {
  const flat = (x: number, z: number) => 0 * x * z;
  it('walks a straight line on flat ground', () => {
    const w = planWalk([0, 0], [300, 400], { heightAt: flat, halfExtent: 9000, maxLenM: 5000 });
    expect(w.stoppedBy).toBeNull();
    expect(w.lengthM).toBeCloseTo(500, 0);
    expect(polyLength(w.points)).toBeCloseTo(500, 0);
  });
  it('stops before a wall steeper than 25 degrees', () => {
    const wall = (x: number) => (x > 200 ? (x - 200) * 1.5 : 0); // ~56 degrees past x=200
    const w = planWalk([0, 0], [600, 0], { heightAt: wall, halfExtent: 9000, maxLenM: 5000 });
    expect(w.stoppedBy).toBe('steep');
    expect(w.lengthM).toBeLessThanOrEqual(210);
    expect(w.lengthM).toBeGreaterThan(150);
  });
  it('allows a gentle 20 degree slope', () => {
    const ramp = (x: number) => x * Math.tan((20 * Math.PI) / 180);
    expect(planWalk([0, 0], [600, 0], { heightAt: ramp, halfExtent: 9000, maxLenM: 5000 }).stoppedBy).toBeNull();
  });
  it('stops at the energy range and at the map edge', () => {
    const r = planWalk([0, 0], [2000, 0], { heightAt: flat, halfExtent: 9000, maxLenM: 750 });
    expect(r.stoppedBy).toBe('range');
    expect(r.lengthM).toBeCloseTo(750, 0);
    const e = planWalk([8000, 0], [12000, 0], { heightAt: flat, halfExtent: 9000, maxLenM: 99999 });
    expect(e.stoppedBy).toBe('edge');
    expect(Math.abs(e.points[e.points.length - 1][0])).toBeLessThanOrEqual(9000 * 0.96);
  });
  it('pointAlong follows the polyline and reports the heading', () => {
    const pts: [number, number][] = [[0, 0], [100, 0], [100, 100]];
    const a = pointAlong(pts, 150);
    expect(a.x).toBeCloseTo(100);
    expect(a.z).toBeCloseTo(50);
    expect(a.heading).toBeCloseTo(0); // +z
    expect(pointAlong(pts, 999).done).toBe(true);
  });
  it('works on the real height map', () => {
    const home = real.home;
    const w = planWalk([home.x, home.z], [home.x + 800, home.z], {
      heightAt: (x, z) => {
        const n = real.data.n;
        const c = Math.round(x / real.data.meta.cellMeters + (n - 1) / 2);
        const r = Math.round(z / real.data.meta.cellMeters + (n - 1) / 2);
        return real.data.height[r * n + c];
      },
      halfExtent: (real.data.n * real.data.meta.cellMeters) / 2,
      maxLenM: 5000,
    });
    expect(w.points.length).toBeGreaterThan(1);
  });
});

describe('energy and outing', () => {
  it('costs 1 energy per started 1000 m', () => {
    expect(energyUsed(0)).toBe(0);
    expect(energyUsed(1)).toBe(1);
    expect(energyUsed(1000)).toBe(1);
    expect(energyUsed(1000.5)).toBe(2);
    expect(energyLeft(4, 2000)).toBe(2);
    expect(energyLeft(2, 5000)).toBe(0);
  });
  it('never walks past the budget and then is spent', () => {
    const o = newOuting(1);
    expect(addWalk(o, 600)).toBe(600);
    expect(rangeLeftM(o.budget, o.walkedM)).toBe(400);
    expect(isSpent(o)).toBe(false);
    expect(addWalk(o, 900)).toBe(400);
    expect(isSpent(o)).toBe(true);
    expect(addWalk(o, 50)).toBe(0);
    expect(energyLeft(o.budget, o.walkedM)).toBe(0);
  });
});

describe('discovery', () => {
  it('discovers within 40 m only, once', () => {
    const p = pois.find((q) => q.kind === 'sun')!;
    expect(discoverNear(pois, new Set(), p.x + 30, p.z).map((q) => q.id)).toEqual(['sun']);
    expect(discoverNear(pois, new Set(), p.x + 60, p.z)).toEqual([]);
    expect(discoverNear(pois, new Set(['sun']), p.x, p.z)).toEqual([]);
  });
  it('the landing site is never a discovery', () => {
    const b = pois.find((q) => q.kind === 'base')!;
    expect(isDiscoverable(b)).toBe(false);
    expect(discoverNear(pois, new Set(), b.x, b.z)).toEqual([]);
  });
  it('snaps near taps to an undiscovered point', () => {
    const p = pois.find((q) => q.kind === 'earth')!;
    expect(snapToPoi(pois, new Set(), p.x + 100, p.z)?.id).toBe('earth');
    expect(snapToPoi(pois, new Set(['earth']), p.x + 100, p.z)).toBeNull();
    expect(snapToPoi(pois, new Set(), p.x + 400, p.z + 400)).toBeNull();
  });
  it('adds up science', () => {
    expect(scienceOf(pois, [])).toBe(0);
    expect(scienceOf(pois, ['earth', 'base'])).toBe(pois.find((q) => q.id === 'earth')!.science);
  });
});

describe('fog of war mask', () => {
  const n = EXPLORE.maskN;
  const extent = 18000;
  it('reveals a disc and counts only new cells', () => {
    const m = createMask(n);
    const a = revealDisc(m, n, extent, 0, 0, 800);
    expect(a).toBeGreaterThan(5);
    expect(revealDisc(m, n, extent, 0, 0, 800)).toBe(0);
    expect(m[(n / 2) * n + n / 2]).toBe(1);
    expect(m[0]).toBe(0);
  });
  it('reports the explored share of the play disc', () => {
    const m = createMask(n);
    expect(exploredFraction(m, n, extent, { x: 0, z: 0 })).toBe(0);
    revealDisc(m, n, extent, 0, 0, EXPLORE.playRadiusM + 500);
    expect(exploredFraction(m, n, extent, { x: 0, z: 0 })).toBe(1);
  });
  it('packs and unpacks losslessly', () => {
    const m = createMask(n);
    revealDisc(m, n, extent, 1500, -2000, 900);
    expect(Array.from(unpackMask(packMask(m), n)!)).toEqual(Array.from(m));
    expect(unpackMask('###', n)).toBeNull();
  });
});

describe('badges', () => {
  const ids = (k: string) => pois.filter((p) => p.kind === k).map((p) => p.id);
  it('awards each rule', () => {
    expect(earnedBadges(pois, [], 0)).toEqual([]);
    expect(earnedBadges(pois, ['sun'], 0)).toEqual(['firstSteps', 'sunChaser']);
    expect(earnedBadges(pois, ['earth'], 0)).toContain('earthSpotter');
    expect(earnedBadges(pois, ids('ice').slice(1), 0)).not.toContain('iceHunter');
    expect(earnedBadges(pois, ids('ice'), 0)).toContain('iceHunter');
    expect(earnedBadges(pois, [], 0.49)).not.toContain('explorer');
    expect(earnedBadges(pois, [], 0.5)).toContain('explorer');
  });
  it('the landing site alone is not a first step', () => {
    expect(earnedBadges(pois, ['base'], 0)).toEqual([]);
  });
});

describe('daily missions', () => {
  it('picks two different missions, the same every time', () => {
    for (let d = 0; d < 60; d++) {
      const [a, b] = dailyMissions(d);
      expect(a.id).not.toBe(b.id);
      expect(dailyMissions(d).map((m) => m.id)).toEqual([a.id, b.id]);
    }
  });
  it('uses the whole pool over time', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 80; d++) dailyMissions(d).forEach((m) => seen.add(m.id));
    expect(seen.size).toBe(MISSION_POOL.length);
  });
  it('tracks progress', () => {
    const walk = MISSION_POOL.find((m) => m.id === 'walk1km')!;
    expect(walk.done({ walkedM: 999, found: [] })).toBe(false);
    expect(walk.done({ walkedM: 1000, found: [] })).toBe(true);
    const ice = MISSION_POOL.find((m) => m.id === 'visitIce')!;
    expect(ice.done({ walkedM: 0, found: pois.filter((p) => p.kind === 'ice').slice(0, 1) })).toBe(true);
  });
});

describe('persistence', () => {
  it('round-trips through a storage object under the v1 key', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const p = emptyProgress();
    revealDisc(p.mask, EXPLORE.maskN, 18000, 500, 500, 1000);
    p.discovered = ['sun', 'earth'];
    p.totalWalkedM = 1234.4;
    saveProgress(p, store);
    expect([...mem.keys()]).toEqual(['astrakids.explore.v1']);
    const q = loadProgress(store);
    expect(q.discovered).toEqual(['sun', 'earth']);
    expect(q.totalWalkedM).toBe(1234);
    expect(Array.from(q.mask)).toEqual(Array.from(p.mask));
  });
  it('survives garbage and a throwing storage', () => {
    expect(decodeProgress('{not json').discovered).toEqual([]);
    expect(decodeProgress(JSON.stringify({ v: 2 })).totalWalkedM).toBe(0);
    expect(decodeProgress(encodeProgress(emptyProgress())).mask.length).toBe(EXPLORE.maskN ** 2);
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadProgress(bad).discovered).toEqual([]);
    expect(() => saveProgress(emptyProgress(), bad)).not.toThrow();
  });
});

