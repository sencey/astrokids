import { describe, expect, it } from 'vitest';
import { makePlaceholder } from '../data/placeholder';
import { heightRaw, makeFrame, sampleSeries, skyVec } from '../math';
import { roverProgress, walkProgress } from '../Actors';
import { buildSlots, landerSlot, makeStatsGetter, nearestPSRPoint, rimPoint } from '../slots';
import { sunSetDate } from '../../ui3d/mission/Panels';

const data = makePlaceholder();

describe('math', () => {
  it('skyVec: north horizon is -z, east is +x, zenith is +y', () => {
    const n = skyVec(0, 0);
    expect(n[2]).toBeCloseTo(-1);
    expect(skyVec(90, 0)[0]).toBeCloseTo(1);
    expect(skyVec(0, 90)[1]).toBeCloseTo(1);
  });
  it('sampleSeries interpolates and wraps azimuth', () => {
    const s = [{ date: 'a', hours: [{ t: 0, azDeg: 350, elDeg: 0 }, { t: 1, azDeg: 10, elDeg: 2 }] }];
    const m = sampleSeries(s, 0, 6);
    expect(m.az).toBeCloseTo(0, 5);
    expect(m.el).toBeCloseTo(1, 5);
  });
  it('heightRaw matches grid at cell centres', () => {
    const cell = data.meta.cellMeters;
    const x = (10 - (data.n - 1) / 2) * cell;
    const z = (20 - (data.n - 1) / 2) * cell;
    expect(heightRaw(data, cell, x, z)).toBeCloseTo(data.height[20 * data.n + 10], 3);
    expect(Math.abs(makeFrame(data, 2).groundY(0, 0))).toBeLessThan(5000);
  });
});

describe('placeholder + slots', () => {
  it('has the contract shapes', () => {
    expect(data.height.length).toBe(256 * 256);
    expect(data.lit.length).toBe(data.dayCount * 256 * 256);
    expect(data.sun.length).toBe(15);
    expect(data.placeholder).toBe(true);
    expect(data.psr.some((v) => v === 1)).toBe(true);
  });
  it('builds 256 slots with a buildable lander slot and consistent stats', () => {
    const slots = buildSlots(data);
    expect(slots.length).toBe(256);
    expect(slots.filter((s) => s.buildable).length).toBeGreaterThan(10);
    expect(data.psr.reduce((a, v) => a + v, 0)).toBeGreaterThan(500);
    const get = makeStatsGetter(data, slots);
    const st = get(landerSlot(slots));
    expect(st.litPctByDay.length).toBe(15);
    expect(st.illumPct).toBeGreaterThanOrEqual(0);
    expect(st.illumPct).toBeLessThanOrEqual(100);
    const psr = slots.map((s) => get(s)).find((x) => x.isPSR);
    if (psr) expect(psr.distanceToNearestPSRm).toBe(0);
  });
  it('a stricter slope threshold never allows more slots', () => {
    expect(buildSlots(data, 3).filter((s) => s.buildable).length).toBeLessThanOrEqual(buildSlots(data, 30).filter((s) => s.buildable).length);
  });
});

describe('mission helpers', () => {
  const slots = buildSlots(data);
  it('finds an ice point and a rim point', () => {
    const s = landerSlot(slots);
    const ice = nearestPSRPoint(data, s);
    expect(ice).not.toBeNull();
    const rim = rimPoint(data, s);
    expect(Math.hypot(rim.x - s.x, rim.z - s.z)).toBeGreaterThan(500);
  });
  it('rover and walker go out and come home; recall brings the walker home early', () => {
    expect(roverProgress(0)).toBe(0);
    expect(roverProgress(0.5)).toBeCloseTo(1, 1);
    expect(roverProgress(1)).toBeCloseTo(0, 5);
    expect(walkProgress(0.5, null)).toBeCloseTo(1, 1);
    expect(walkProgress(0.8, 0.4)).toBe(0);
  });
  it('sunSetDate finds the last day with the Sun up', () => {
    const mk = (date: string, el: number) => ({ date, hours: [{ elDeg: el }] });
    expect(sunSetDate([mk('a', 1), mk('b', 2), mk('c', -1), mk('d', -2)])).toBe('b');
    expect(sunSetDate([mk('a', 1), mk('b', 2)])).toBeNull();
  });
});