import { describe, expect, it } from 'vitest';
import { batteryCap, planCosts, resolveDay, startMission } from '../engine';
import { buildingLive } from '../liveStats';
import { NO_PLAN } from '../types';
import type { MoonDay, MoonPlan, MoonSetup, SlotStats } from '../types';

const stats = (lit: number, psr = 500): SlotStats => ({ illumPct: 50, litPctByDay: new Array<number>(15).fill(lit), isPSR: false, slopeDeg: 3, distanceToNearestPSRm: psr });
const setup = (over: Partial<MoonSetup> = {}): MoonSetup => ({ habitat: stats(50), towers: [stats(100), stats(100)], greenhouse: stats(100), cargo: ['batteryBank', 'greenhouse'], ...over });
const day = (): MoonDay => ({ date: '2024-05-08', sparkleBand: 'calm', sparkleRatio: 1, alarmAt: null, alarmKind: null, alertOngoing: false, bandIsAssumption: false, radInstrument: 'LRO CRaTER' });
const plan = (over: Partial<MoonPlan> = {}): MoonPlan => ({ ...NO_PLAN, ...over });
const start = (s = setup()) => startMission(s, [day(), day(), day()]);

describe('explore outing in the moon engine', () => {
  it('plan costs include exploreEnergy in the total', () => {
    const s = start();
    const a = planCosts(s, plan({ keepRunning: true }));
    const b = planCosts(s, plan({ keepRunning: true, exploreEnergy: 3 }));
    expect(b.explore).toBe(3);
    expect(b.total).toBe(a.total + 3);
    expect(b.affordable).toBe(true);
  });
  it('rejects negative, non-finite and unaffordable exploration', () => {
    const s = start();
    expect(planCosts(s, plan({ exploreEnergy: -1 })).affordable).toBe(false);
    expect(planCosts(s, plan({ exploreEnergy: Number.NaN })).affordable).toBe(false);
    expect(planCosts(s, plan({ exploreScience: -2 })).affordable).toBe(false);
    expect(planCosts(s, plan({ exploreEnergy: 999 })).affordable).toBe(false);
    expect(() => resolveDay(s, plan({ exploreEnergy: 999 }))).toThrow();
  });
  it('deducts the energy before the battery cap, never double-counting', () => {
    const s = start(); // 6 start + 12 made = 18 available, cap 20 with the bank
    expect(batteryCap(s.setup)).toBe(20);
    const none = resolveDay(s, plan());
    const four = resolveDay(s, plan({ exploreEnergy: 4 }));
    expect(none.report.energy.leftover).toBe(18);
    expect(four.report.energy.leftover).toBe(14);
    expect(four.nextState.battery).toBe(14);
    expect(four.report.energy.spent.explore).toBe(4);
    expect(four.report.energy.spent.total).toBe(4);
    // a day that would overflow the cap: exploring eats the waste first
    const rich = start(setup({ cargo: ['extraTower', 'batteryBank'], towers: [stats(100), stats(100), stats(100)], greenhouse: null }));
    const noX = resolveDay(rich, plan());
    const x5 = resolveDay(rich, plan({ exploreEnergy: 5 }));
    expect(noX.report.energy.wasted - x5.report.energy.wasted).toBe(Math.min(5, noX.report.energy.wasted));
    expect(x5.nextState.battery).toBeLessThanOrEqual(batteryCap(rich.setup));
  });
  it('adds the science found on foot and reports a source-tagged fact', () => {
    const s = start();
    const { report, nextState } = resolveDay(s, plan({ exploreEnergy: 1, exploreScience: 3, exploreWalkedM: 656, exploreFound: ['Earth lookout'] }));
    expect(report.science.gained).toBe(3);
    expect(nextState.science).toBe(3);
    const f = report.facts.find((x) => x.id === 'explore')!;
    expect(f.en).toBe('Explored 0.66 km, found Earth lookout.');
    expect(f.source).toContain('NASA');
    expect(f.source).toContain('LOLA');
    expect(f.values.science).toBe(3);
  });
  it('days without exploring look exactly as before', () => {
    const { report } = resolveDay(start(), plan());
    expect(report.facts.some((f) => f.id === 'explore')).toBe(false);
    expect(report.energy.spent.explore).toBe(0);
    expect(report.science.gained).toBe(0);
  });
});

describe('buildingLive', () => {
  const s = start();
  it('towers report lit% and energy', () => {
    expect(buildingLive(s, 'solarTower', 0)).toMatchObject({ litPct: 100, energy: 6 });
  });
  it('habitat reports the berm, battery unit the fill, greenhouse the light', () => {
    expect(buildingLive(s, 'habitat')).toMatchObject({ berm: 0 });
    expect(buildingLive(s, 'batteryUnit').fill).toBeCloseTo(6 / 20);
    expect(buildingLive(s, 'greenhouse')).toMatchObject({ litPct: 100, needsGrowLights: false });
    const dim = start(setup({ greenhouse: stats(5) }));
    expect(buildingLive(dim, 'greenhouse').needsGrowLights).toBe(true);
  });
  it('lander and rover are static text keys; no state gives just the id', () => {
    expect(buildingLive(s, 'lander')).toEqual({ id: 'lander', textKey: 'lander' });
    expect(buildingLive(null, 'rover').textKey).toBe('rover');
    expect(buildingLive(null, 'solarTower')).toEqual({ id: 'solarTower' });
  });
});
