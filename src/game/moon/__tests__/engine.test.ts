import { describe, expect, it } from 'vitest';
import {
  baseDose,
  batteryCap,
  doseAmount,
  greenhouseCost,
  iceTripCost,
  missionSucceeded,
  planCosts,
  resolveDay,
  startMission,
  summarize,
  towerEnergy,
  walkCost,
} from '../engine';
import { buildMoonDays, loadMoonDays } from '../scenario';
import { liveDayFromToday } from '../live';
import { listMoonRules, MOON_RULES } from '../rules';
import { NO_PLAN } from '../types';
import type { MoonDay, MoonPlan, MoonSetup, SlotStats } from '../types';

const stats = (lit: number | number[], distanceToNearestPSRm = 500): SlotStats => ({
  illumPct: 50,
  litPctByDay: Array.isArray(lit) ? lit : new Array<number>(15).fill(lit),
  isPSR: false,
  slopeDeg: 3,
  distanceToNearestPSRm,
});
const setup = (over: Partial<MoonSetup> = {}): MoonSetup => ({
  habitat: stats(50, 500),
  towers: [stats(100), stats(100)],
  greenhouse: stats(100),
  cargo: ['batteryBank', 'greenhouse'],
  ...over,
});
const withGh = (over: Partial<MoonSetup> = {}) => setup({ greenhouse: stats(100), ...over });
const day = (over: Partial<MoonDay> = {}): MoonDay => ({
  date: '2024-05-08',
  sparkleBand: 'calm',
  sparkleRatio: 1,
  alarmAt: null,
  alarmKind: null,
  alertOngoing: false,
  bandIsAssumption: false,
  radInstrument: 'LRO CRaTER',
  ...over,
});
const plan = (over: Partial<MoonPlan> = {}): MoonPlan => ({ ...NO_PLAN, ...over });
const calmDays = (n: number) => Array.from({ length: n }, () => day());

describe('energy', () => {
  it('tower makes round(6 x lit% / 100)', () => {
    expect(towerEnergy(stats(76), 0)).toBe(5);
    expect(towerEnergy(stats(4), 0)).toBe(0);
    expect(towerEnergy(stats(9.5), 0)).toBe(1);
    expect(towerEnergy(stats([100, 20]), 1)).toBe(1);
  });

  it('battery cap carries over and the rest is wasted', () => {
    const s0 = startMission(setup({ cargo: ['extraTower', 'greenhouse'], towers: [stats(100), stats(100), stats(100)], greenhouse: stats(100) }), calmDays(2));
    expect(batteryCap(s0.setup)).toBe(8);
    const { nextState, report } = resolveDay(s0, plan({ keepRunning: true }));
    // 6 start + 18 produced - 2 running = 22; keeps 8, wastes 14
    expect(report.energy.leftover).toBe(22);
    expect(nextState.battery).toBe(8);
    expect(report.energy.wasted).toBe(14);
    expect(report.events).toContain('batteryFull');
  });

  it('battery bank raises the cap to 20', () => {
    const s0 = startMission(setup(), calmDays(3));
    expect(batteryCap(s0.setup)).toBe(20);
    const s1 = resolveDay(s0, plan({ keepRunning: true })).nextState; // 6+12-2 = 16
    expect(s1.battery).toBe(16);
    expect(resolveDay(s1, plan({ keepRunning: true })).nextState.battery).toBe(20);
  });

  it('cannot spend more than available; a dark day is flagged', () => {
    const s0 = startMission(setup({ towers: [stats(0), stats(0)] }), calmDays(2));
    // available = 6 battery
    expect(planCosts(s0, plan({ shield: true, keepRunning: true, iceTrip: true })).affordable).toBe(false);
    expect(() => resolveDay(s0, plan({ shield: true, keepRunning: true, iceTrip: true }))).toThrow(RangeError);
    expect(resolveDay(s0, plan()).report.events).toContain('darkDay');
  });

  it('running inside costs 2, with a walk 3; not paid = -3 life', () => {
    const s0 = startMission(setup(), calmDays(2));
    expect(planCosts(s0, plan({ keepRunning: true })).running).toBe(2);
    expect(planCosts(s0, plan({ keepRunning: true, scienceWalk: 'rim' })).running).toBe(3);
    expect(resolveDay(s0, plan({ keepRunning: true })).report.life.after).toBe(14 - 4);
    const off = resolveDay(s0, plan()).report.life;
    expect(off.notRunningPenalty).toBe(3);
    expect(off.after).toBe(14 - 3 - 4);
  });
});

describe('actions', () => {
  it('cold habitat (<20% lit) adds 1 to keep-base-running', () => {
    const s0 = startMission(setup({ habitat: stats(10, 500) }), calmDays(2));
    expect(planCosts(s0, plan({ keepRunning: true })).running).toBe(3);
    expect(planCosts(s0, plan({ keepRunning: true, scienceWalk: 'rim' })).running).toBe(4);
    expect(planCosts(s0, plan()).running).toBe(0);
  });

  it('ice trip costs 2 + 1 per started km', () => {
    expect(iceTripCost(stats(50, 0))).toBe(2);
    expect(iceTripCost(stats(50, 1))).toBe(3);
    expect(iceTripCost(stats(50, 1000))).toBe(3);
    expect(iceTripCost(stats(50, 1001))).toBe(4);
    expect(iceTripCost(stats(50, 2500))).toBe(5);
    const s0 = startMission(setup({ habitat: stats(50, 1500) }), calmDays(2));
    const r = resolveDay(s0, plan({ iceTrip: true })).report;
    expect(r.energy.spent.ice).toBe(4);
    expect(r.life.iceGain).toBe(6);
    expect(r.life.after).toBe(14 + 6 - 4 - 3);
  });

  it('picked ice target distance replaces the nearest-PSR default', () => {
    expect(iceTripCost(stats(50, 500), 2500)).toBe(5);
    expect(iceTripCost(stats(50, 500), 0)).toBe(2);
    const s0 = startMission(setup({ habitat: stats(50, 500) }), calmDays(2));
    expect(planCosts(s0, plan({ iceTrip: true })).ice).toBe(3);
    expect(planCosts(s0, plan({ iceTrip: true, iceTargetDistanceM: 2100 })).ice).toBe(5);
    expect(planCosts(s0, plan({ iceTrip: true, iceTargetDistanceM: -5 })).affordable).toBe(false);
    const r = resolveDay(s0, plan({ iceTrip: true, iceTargetDistanceM: 1400 })).report;
    expect(r.energy.spent.ice).toBe(4);
    expect(r.facts.find((f) => f.id === 'iceDistance')?.values.distanceM).toBe(1400);
  });

  it('science walk: rim 2 / ice 4, +1 per started km beyond the first km', () => {
    expect(walkCost('rim')).toBe(2);
    expect(walkCost('rim', 0)).toBe(2);
    expect(walkCost('rim', 1000)).toBe(2);
    expect(walkCost('rim', 1001)).toBe(3);
    expect(walkCost('ice', 1400)).toBe(5);
    expect(walkCost('ice', 2000)).toBe(5);
    expect(walkCost('ice', 2001)).toBe(6);
    const s0 = startMission(setup(), calmDays(2));
    expect(planCosts(s0, plan({ scienceWalk: 'ice' })).walk).toBe(4);
    expect(planCosts(s0, plan({ scienceWalk: 'ice', walkTargetDistanceM: 1400 })).walk).toBe(5);
    expect(planCosts(s0, plan({ scienceWalk: 'rim', walkTargetDistanceM: Number.NaN })).affordable).toBe(false);
    const r = resolveDay(s0, plan({ scienceWalk: 'ice', walkTargetDistanceM: 1400 })).report;
    expect(r.energy.spent.walk).toBe(5);
    const f = r.facts.find((x) => x.id === 'walkDistance');
    expect(f?.en).toMatch(/1\.4 km to a permanently shadowed crater/);
    expect(f?.source).toMatch(/LOLA/);
    // no distance picked: no walk fact
    expect(resolveDay(s0, plan({ scienceWalk: 'rim' })).report.facts.some((x) => x.id === 'walkDistance')).toBe(false);
  });

  it('greenhouse costs 2, +1 grow lights under 30% lit, and gives +3 life', () => {
    expect(greenhouseCost(stats(80), 0)).toBe(2);
    expect(greenhouseCost(stats(29.9), 0)).toBe(3);
    expect(greenhouseCost(stats(30), 0)).toBe(2);
    const s0 = startMission(withGh({ greenhouse: stats(10) }), calmDays(2));
    const r = resolveDay(s0, plan({ greenhouse: true })).report;
    expect(r.energy.spent.greenhouse).toBe(3);
    expect(r.life.greenhouseGain).toBe(3);
  });

  it('needs a greenhouse to use one; berm stops at 3; science values', () => {
    const s0 = startMission(setup({ cargo: ['batteryBank', 'extraTower'], towers: [stats(100), stats(100), stats(100)], greenhouse: null }), calmDays(6));
    expect(planCosts(s0, plan({ greenhouse: true })).errors.join()).toMatch(/greenhouse/i);
    let s = s0;
    for (let i = 0; i < 3; i++) s = resolveDay(s, plan({ shield: true, keepRunning: true })).nextState;
    expect(s.berm).toBe(3);
    expect(planCosts(s, plan({ shield: true })).affordable).toBe(false);
    expect(resolveDay(s, plan({ scienceWalk: 'rim' })).report.science.gained).toBe(1);
    const ice = resolveDay(s, plan({ scienceWalk: 'ice' })).report;
    expect(ice.science.gained).toBe(3);
    expect(ice.energy.spent.walk).toBe(4);
  });

  it('rejects a bad cargo choice', () => {
    expect(() => startMission(setup({ cargo: ['batteryBank', 'batteryBank'] }), calmDays(1))).toThrow();
    expect(() => startMission(setup({ cargo: ['extraTower', 'batteryBank'], greenhouse: null }), calmDays(1))).toThrow(); // needs 3 towers
  });
});

describe('radiation', () => {
  it('real ratio sets the base dose; calm is always 1', () => {
    expect(baseDose({ sparkleBand: 'calm', sparkleRatio: 2.2 })).toBe(1);
    expect(baseDose({ sparkleBand: 'storm', sparkleRatio: 45.32 })).toBe(6);
    expect(baseDose({ sparkleBand: 'storm', sparkleRatio: 3.1 })).toBe(4); // clamp low
    expect(baseDose({ sparkleBand: 'storm', sparkleRatio: 900 })).toBe(30); // clamp high
    expect(baseDose({ sparkleBand: 'super', sparkleRatio: 101.56 })).toBe(13);
    expect(baseDose({ sparkleBand: 'super', sparkleRatio: 213.58 })).toBe(27);
    expect(baseDose({ sparkleBand: 'super', sparkleRatio: 9000 })).toBe(40);
    expect(baseDose({ sparkleBand: 'storm', sparkleRatio: null })).toBe(8);
  });

  it('berm divisor: level 3 divides by 4; calm stays 1', () => {
    expect(doseAmount(20, 'inside', 0)).toBe(20);
    expect(doseAmount(20, 'inside', 1)).toBe(10);
    expect(doseAmount(20, 'inside', 2)).toBe(7);
    expect(doseAmount(20, 'inside', 3)).toBe(5);
    expect(doseAmount(1, 'inside', 3)).toBe(1);
    expect(MOON_RULES.radiation.bermTopDivisor.value).toBe(4);
    expect(MOON_RULES.radiation.bermTopDivisor.isAssumption).toBe(false);
  });

  it('recall in time = ceil(b/2) + ceil(b/2/(1+berm))', () => {
    expect(doseAmount(10, 'outsideRecalled', 1)).toBe(5 + 3);
    expect(doseAmount(30, 'outsideRecalled', 3)).toBe(15 + 4);
    expect(doseAmount(10, 'outsideFull', 3)).toBe(10);
  });

  const stormDay = day({ sparkleBand: 'storm', sparkleRatio: 80, alarmAt: '2024-05-10T13:35Z', alarmKind: 'measured' }); // base 10

  it('recalled in time uses the half-day formula; too late = full dose', () => {
    const s0 = startMission(setup(), [stormDay, stormDay]);
    const rec = resolveDay(s0, plan({ scienceWalk: 'rim', recalledInTime: true, keepRunning: true })).report;
    expect(rec.dose.where).toBe('outsideRecalled');
    expect(rec.dose.amount).toBe(10);
    const s1 = startMission(setup(), [{ ...stormDay }]);
    const late = resolveDay(s1, plan({ scienceWalk: 'rim', recalledInTime: false })).report;
    expect(late.dose.where).toBe('outsideFull');
    expect(late.dose.amount).toBe(10);
    // with berm 1: 5 + 3
    const withBerm = resolveDay(s1, plan({ shield: true, scienceWalk: 'rim', recalledInTime: true })).report;
    expect(withBerm.dose.amount).toBe(8);
    expect(withBerm.dose.bermLevel).toBe(1);
  });

  it('alertOngoing day: going out is the full base even if recalled', () => {
    const ongoing = day({ sparkleBand: 'storm', sparkleRatio: 80, alertOngoing: true });
    const s0 = startMission(setup(), [ongoing]);
    const r = resolveDay(s0, plan({ scienceWalk: 'rim', recalledInTime: true })).report;
    expect(r.dose.where).toBe('outsideFull');
    expect(r.dose.amount).toBe(10);
    expect(r.events).toContain('alertOngoing');
  });

  it('unannounced storm outside is flagged; staying inside under a level 3 berm is cheap', () => {
    const quiet = day({ sparkleBand: 'storm', sparkleRatio: 80 });
    const r = resolveDay(startMission(setup(), [quiet]), plan({ scienceWalk: 'rim' })).report;
    expect(r.events).toContain('unannouncedStorm');
  });

  it('dose reaching 100 ends the mission early and is capped at 100', () => {
    const big = day({ sparkleBand: 'super', sparkleRatio: 900, alarmAt: '2024-05-14T10:00Z', alarmKind: 'measured' }); // base 40
    let s = startMission(setup(), [big, big, big, big, big]);
    s = resolveDay(s, plan({ scienceWalk: 'rim', keepRunning: true })).nextState;
    s = resolveDay(s, plan({ scienceWalk: 'rim', keepRunning: true })).nextState;
    expect(s.outcome).toBeNull();
    s = resolveDay(s, plan({ scienceWalk: 'rim', keepRunning: true })).nextState;
    expect(s.dose).toBe(100);
    expect(s.outcome).toBe('earlyReturn');
    expect(s.reports.at(-1)!.events).toContain('earlyReturn');
    expect(() => resolveDay(s, plan())).toThrow();
    expect(missionSucceeded(s)).toBe(false);
  });
});

describe('life support and resupply', () => {
  it('tank empties, Earth resupplies to 6 and cancels the next walk', () => {
    let s = startMission(setup(), calmDays(6));
    // day 1: 14-3-4=7, day 2: 7-3-4=0 -> resupply
    s = resolveDay(s, plan()).nextState;
    expect(s.life).toBe(7);
    const d2 = resolveDay(s, plan());
    expect(d2.report.life.resupplied).toBe(true);
    expect(d2.report.events).toContain('resupply');
    expect(d2.nextState.life).toBe(6);
    expect(d2.nextState.resupplies).toBe(1);
    expect(planCosts(d2.nextState, plan({ scienceWalk: 'rim' })).errors.join()).toMatch(/cancelled/);
    const d3 = resolveDay(d2.nextState, plan({ keepRunning: true }));
    expect(d3.report.events).toContain('walkCancelled');
    expect(d3.nextState.walkCancelledToday).toBe(false);
  });

  it('tank is capped at 20', () => {
    let s = startMission(setup({ habitat: stats(50, 0) }), calmDays(4));
    for (let i = 0; i < 3; i++) s = resolveDay(s, plan({ keepRunning: true, iceTrip: true })).nextState;
    expect(s.life).toBeLessThanOrEqual(20);
  });
});

describe('mission days', () => {
  it('builds 15 days; 05-16..22 come from CRaTER, with real bands', () => {
    const days = loadMoonDays();
    expect(days).toHaveLength(15);
    expect(days[0]!.date).toBe('2024-05-08');
    expect(days[14]!.date).toBe('2024-05-22');
    const tail = days.slice(8);
    expect(tail.map((d) => d.sparkleBand)).toEqual(['storm', 'storm', 'calm', 'calm', 'calm', 'calm', 'calm']);
    expect(tail[0]!.sparkleRatio).toBeCloseTo(43.31, 1);
    expect(tail.every((d) => !d.bandIsAssumption)).toBe(true);
    expect(tail[0]!.alertOngoing).toBe(true);
    expect(tail[2]!.alertOngoing).toBe(false);
  });

  it('without CRaTER data the extra days are calm assumptions', () => {
    const days = buildMoonDays(loadMoonDays().slice(0, 8), null);
    expect(days).toHaveLength(15);
    for (const d of days.slice(8)) {
      expect(d.sparkleBand).toBe('calm');
      expect(d.bandIsAssumption).toBe(true);
    }
  });

  it('live day: a SEP in the last 24 h is a storm with unknown ratio', () => {
    const latest = { generatedAt: '2026-11-14T11:00:00Z', sep: [{ eventTime: '2026-11-14T03:00Z' }, { eventTime: '2026-11-01T03:00Z' }] };
    const live = liveDayFromToday(latest, { at: '2026-11-14T12:00:00Z', litPct: 60 });
    expect(live.sparkleBand).toBe('storm');
    expect(live.sparkleRatio).toBeNull();
    expect(live.bandIsAssumption).toBe(true);
    expect(baseDose(live)).toBe(8);
    expect(liveDayFromToday({ ...latest, sep: [latest.sep[1]!] }, { at: '2026-11-14T12:00:00Z', litPct: 60 }).sparkleBand).toBe('calm');
  });
});

describe('rules list', () => {
  it('every rule has a note and a boolean isAssumption', () => {
    const all = listMoonRules();
    expect(all.length).toBeGreaterThan(40);
    for (const { rule } of all) {
      expect(rule.note.length).toBeGreaterThan(5);
      expect(typeof rule.isAssumption).toBe('boolean');
    }
  });
});

describe('full 15-day scripted run (synthetic slots)', () => {
  // Bright first 6 days, dim after: the real shape.
  const lit = [76, 78, 79, 76, 72, 62, 20, 9.5, 9, 6, 4, 4, 6, 7, 8];
  const mk = () => startMission(setup({ towers: [stats(lit), stats(lit)], habitat: stats(lit, 800) }), loadMoonDays());
  const script = (i: number): MoonPlan => {
    if (i < 3) return plan({ keepRunning: true, shield: true });
    if (i < 6) return plan({ keepRunning: true, iceTrip: true });
    if (i % 3 === 0) return plan({ keepRunning: true, iceTrip: true });
    return plan({ keepRunning: true });
  };
  const play = () => {
    let s = mk();
    while (s.outcome === null) {
      let p = script(s.cursor);
      if (!planCosts(s, p).affordable) p = plan({ keepRunning: true });
      if (!planCosts(s, p).affordable) p = plan();
      s = resolveDay(s, p).nextState;
    }
    return s;
  };

  it('finishes with no NaN and plausible totals', () => {
    const s = play();
    expect(s.outcome).toBe('completed');
    expect(s.reports).toHaveLength(15);
    for (const r of s.reports) {
      for (const v of [r.energy.produced, r.energy.batteryAfter, r.life.after, r.dose.amount, r.dose.after, r.science.total]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(r.life.after).toBeGreaterThan(0);
      expect(r.life.after).toBeLessThanOrEqual(20);
      expect(r.energy.batteryAfter).toBeGreaterThanOrEqual(0);
      expect(r.facts.length).toBeGreaterThan(0);
    }
    expect(s.berm).toBe(3);
    expect(s.dose).toBeGreaterThan(10);
    expect(s.dose).toBeLessThan(60);
    const sum = summarize(s);
    expect(sum.whatIfNoBermDose).toBeGreaterThan(s.dose);
    expect(sum.sunlight).toHaveLength(2);
    expect(sum.sunlight[0]!.best.litPct).toBe(79);
    expect(sum.sunlight[0]!.worst.litPct).toBe(4);
    expect(sum.elsewhere.map((e) => e.instrument)).toEqual(['LRO CRaTER', 'BioSentinel BPD', 'ISS DosTel1', 'Curiosity RAD']);
    expect(Math.round(sum.elsewhere.find((e) => e.place === 'iss')!.ratio)).toBe(1);
    expect(sum.totals.finalDose).toBe(s.dose);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });
});




