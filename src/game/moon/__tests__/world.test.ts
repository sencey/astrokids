import { describe, expect, it } from 'vitest';
import { batteryCap, resolveDay, startMission, towerEnergy } from '../engine';
import { loadMoonDays } from '../scenario';
import { NO_PLAN } from '../types';
import type { MoonDay, MoonState, SlotStats } from '../types';
import {
  build,
  buildCost,
  canAfford,
  dayStart,
  endDay,
  firstDayMissions,
  missionForDay,
  spend,
  startWorldMission,
} from '../world';
import { loadRealSlots } from './realTerrain';

const stats = (lit: number | number[], psr = 500): SlotStats => ({
  illumPct: 50,
  litPctByDay: Array.isArray(lit) ? lit : new Array<number>(15).fill(lit),
  isPSR: false,
  slopeDeg: 3,
  distanceToNearestPSRm: psr,
});
const mkDay = (over: Partial<MoonDay> = {}): MoonDay => ({ date: '2024-05-08', sparkleBand: 'calm', sparkleRatio: 1, alarmAt: null, alarmKind: null, alertOngoing: false, bandIsAssumption: false, radInstrument: 'LRO CRaTER', ...over });
const fresh = (days: MoonDay[] = [mkDay(), mkDay(), mkDay()]) => startWorldMission({ habitat: stats(50), days });

describe('startWorldMission', () => {
  it('has no towers, battery 8 / cap 8, habitat placed', () => {
    const s = fresh();
    expect(s.setup.towers).toHaveLength(0);
    expect(s.setup.greenhouse).toBeNull();
    expect(s.battery).toBe(8);
    expect(batteryCap(s.setup)).toBe(8);
    expect(s.cursor).toBe(0);
    expect(s.setup.habitat.litPctByDay).toHaveLength(15);
  });
  it('dayStart: available = battery, reserve = running cost (+1 when the habitat is cold)', () => {
    expect(dayStart(fresh())).toMatchObject({ available: 8, reserveForBase: 2, spent: 0 });
    const cold = startWorldMission({ habitat: stats(5), days: [mkDay()] });
    expect(dayStart(cold).reserveForBase).toBe(3);
  });
});

describe('build', () => {
  it('costs are assumption rules', () => {
    for (const k of ['tower', 'battery', 'greenhouse'] as const) {
      expect(buildCost(k).isAssumption).toBe(true);
      expect(buildCost(k).value).toBeGreaterThan(0);
    }
    expect([buildCost('tower').value, buildCost('battery').value, buildCost('greenhouse').value]).toEqual([2, 3, 3]);
  });
  it('towers: max 3, produce from the next day only, pay energy', () => {
    let s = fresh();
    let live = dayStart(s);
    for (let i = 0; i < 3; i++) {
      const r = build(s, 'tower', stats(100), live);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.state;
      live = r.live;
      if (i === 0) {
        expect(live.spent).toBe(2);
        expect(live.spentBy.build).toBe(2);
        expect(dayStart(s).available).toBe(8); // still no production today
      }
    }
    // 8 - 6 = 2 left = exactly the base reserve -> a 4th is refused (limit first)
    const fourth = build(s, 'tower', stats(100), live);
    expect(fourth).toMatchObject({ ok: false, reason: 'limit' });
    expect(s.setup.towers).toHaveLength(3);
    // tomorrow they make energy
    const r = endDay(s, { buildEnergy: live.spentBy.build });
    expect(r.report.energy.perTower).toEqual([0, 0, 0]);
    const day2 = dayStart(r.state);
    expect(day2.available).toBe(r.state.battery + 18);
    expect(endDay(r.state, {}).report.energy.perTower).toEqual([6, 6, 6]);
  });
  it('the first day produces nothing from towers built that day', () => {
    const r0 = build(fresh(), 'tower', stats(100));
    if (!r0.ok) throw new Error('should build');
    const end = endDay(r0.state, { buildEnergy: 2 });
    expect(end.report.energy.perTower).toEqual([0]);
    expect(end.report.energy.produced).toBe(0);
    expect(end.report.energy.spent.build).toBe(2);
    expect(end.report.energy.spent.total).toBe(2 + 2);
    expect(end.state.battery).toBe(8 - 4);
    expect(towerEnergy(stats(100), 1)).toBe(6);
    expect(dayStart(end.state).available).toBe(4 + 6);
  });
  it('battery unit raises the cap at once, only one allowed', () => {
    const s = fresh();
    const r = build(s, 'battery');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(batteryCap(r.state.setup)).toBe(20);
    expect(build(r.state, 'battery', null, r.live)).toMatchObject({ ok: false, reason: 'limit' });
  });
  it('greenhouse: one, needs a slot', () => {
    const s = fresh();
    expect(build(s, 'greenhouse', null)).toMatchObject({ ok: false, reason: 'noSlot' });
    const r = build(s, 'greenhouse', stats(60));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.setup.greenhouse).not.toBeNull();
    expect(build(r.state, 'greenhouse', stats(60), r.live)).toMatchObject({ ok: false, reason: 'limit' });
  });
  it('refuses when energy is too low and keeps the base reserve', () => {
    const s = fresh();
    const live = spend(dayStart(s), 5); // 8 - 5 = 3 left, reserve 2 -> 1 spendable
    expect(canAfford(live, 1)).toBe(true);
    expect(canAfford(live, 2)).toBe(false);
    expect(canAfford(live, 3, { useReserve: true })).toBe(true);
    expect(build(s, 'tower', stats(100), live)).toMatchObject({ ok: false, reason: 'energy', cost: 2 });
    expect(build(s, 'tower', stats(100), live, { useReserve: true }).ok).toBe(true);
  });
});

describe('ice by visit', () => {
  it('+6 life support and an ice trip with no ice energy', () => {
    const s = fresh();
    const a = endDay(s, { iceCollected: true, exploreEnergy: 1, exploreWalkedM: 800 });
    expect(a.report.life.iceGain).toBe(6);
    expect(a.report.energy.spent.ice).toBe(0);
    expect(a.report.energy.spent.explore).toBe(1);
    expect(a.state.iceTrips).toBe(1);
    expect(a.report.facts.some((f) => f.id === 'iceVisit')).toBe(true);
    const b = endDay(s, {});
    expect(b.report.life.iceGain).toBe(0);
    expect(b.state.iceTrips).toBe(0);
  });
});

describe('alarm outcomes', () => {
  const storm = (over: Partial<MoonDay> = {}) => mkDay({ sparkleBand: 'storm', sparkleRatio: 160, alarmAt: '2024-05-10T13:35Z', alarmKind: 'measured', ...over });
  const dose = (alarm: 'none' | 'safe' | 'late' | 'outside', berm = 0, walkedM = 1500, day = storm()) => {
    const s = { ...fresh([day, mkDay()]), berm };
    return endDay(s, { alarm, exploreWalkedM: walkedM, exploreEnergy: 2 }).report;
  };
  it('safe = inside dose, late = half exposure, outside = full', () => {
    const safe = dose('safe');
    const late = dose('late');
    const out = dose('outside');
    expect(safe.dose.where).toBe('inside');
    expect(late.dose.where).toBe('outsideRecalled');
    expect(out.dose.where).toBe('outsideFull');
    expect(safe.dose.base).toBe(20);
    expect(out.dose.amount).toBe(20);
    expect(late.dose.amount).toBe(10 + 10); // half outside + half inside, no berm
    expect(safe.dose.amount).toBe(20); // no berm: inside = base
    const b3 = (a: 'safe' | 'late' | 'outside') => dose(a, 3).dose.amount;
    expect(b3('safe')).toBe(5);
    expect(b3('late')).toBe(10 + 3);
    expect(b3('outside')).toBe(20);
    expect(out.events).toContain('alarm');
  });
  it('none: no alert and no walk = inside; walked into an unannounced storm = full', () => {
    expect(dose('none', 0, 0, storm({ alarmAt: null, alarmKind: null })).dose.where).toBe('inside');
    const r = dose('none', 0, 1000, storm({ alarmAt: null, alarmKind: null }));
    expect(r.dose.where).toBe('outsideFull');
    expect(r.events).toContain('unannouncedStorm');
    expect(dose('none', 0, 1000, mkDay()).dose.where).toBe('inside'); // calm day: nothing to fear
  });
  it('ongoing alert days: being outside at all is full dose', () => {
    const ongoing = storm({ alarmAt: null, alarmKind: null, alertOngoing: true });
    expect(dose('safe', 0, 900, ongoing).dose.where).toBe('outsideFull');
    expect(dose('late', 0, 0, ongoing).dose.where).toBe('outsideFull');
    expect(dose('safe', 0, 0, ongoing).dose.where).toBe('inside');
  });
  it('shield levels built today count for today and cost 3 each', () => {
    const s = fresh([storm(), mkDay()]);
    const r = endDay(s, { alarm: 'safe', shieldLevels: 2 }).report;
    expect(r.energy.spent.shield).toBe(6);
    expect(r.dose.bermLevel).toBe(2);
    expect(r.dose.amount).toBe(Math.ceil(20 / 3));
  });
});

describe('endDay report shape', () => {
  it('has the same keys as resolveDay and updates the state like it', () => {
    const s0 = startMission(
      { habitat: stats(50), towers: [stats(100), stats(100), stats(100)], greenhouse: null, cargo: ['extraTower', 'batteryBank'] },
      [mkDay(), mkDay()],
    );
    const classic = resolveDay(s0, { ...NO_PLAN, keepRunning: true }).report;
    const w = endDay(s0, {});
    expect(Object.keys(w.report).sort()).toEqual(Object.keys(classic).sort());
    expect(Object.keys(w.report.energy).sort()).toEqual(Object.keys(classic.energy).sort());
    expect(Object.keys(w.report.energy.spent).sort()).toEqual(Object.keys(classic.energy.spent).sort());
    expect(w.report.energy).toEqual(classic.energy);
    expect(w.report.dose).toEqual(classic.dose);
    expect(w.state.cursor).toBe(1);
    expect(w.state.reports).toHaveLength(1);
    expect(w.nextState).toBe(w.state);
  });
  it('skipBase costs life support instead of energy', () => {
    const s = fresh();
    const kept = endDay(s, {});
    const skipped = endDay(s, { skipBase: true });
    expect(kept.report.life.notRunningPenalty).toBe(0);
    expect(skipped.report.life.notRunningPenalty).toBe(3);
    expect(skipped.state.battery).toBe(kept.state.battery + 2);
  });
  it('plays a whole mission to the end', () => {
    let s = fresh(loadMoonDays());
    while (s.outcome === null) s = endDay(s, { alarm: 'safe' }).state;
    expect(s.reports.length).toBeGreaterThan(0);
  });
});

describe('missions', () => {
  it('first day: four ordered ids; the later ones are text-complete', () => {
    expect([...firstDayMissions]).toEqual(['walkToFlag', 'buildTower', 'findIce', 'endDay']);
    const ms = missionForDay(fresh(), 0);
    expect(ms.map((m) => m.id)).toEqual([...firstDayMissions]);
  });
  const real = loadMoonDays();
  const slots = loadRealSlots();
  const best = slots
    .map((x) => x.stats)
    .sort((a, b) => b.litPctByDay.reduce((p, c) => p + c, 0) - a.litPctByDay.reduce((p, c) => p + c, 0))[0]!;
  const atDay = (cursor: number, over: Partial<MoonState> = {}): MoonState => {
    const s0 = startWorldMission({ habitat: best, days: real });
    return { ...s0, cursor, setup: { ...s0.setup, towers: [best], towerFromDay: [0] }, ...over };
  };
  it('shieldUp before the 05-10 and 05-14 storms (real data)', () => {
    expect(real[2]!.date).toBe('2024-05-10');
    expect(real[6]!.date).toBe('2024-05-14');
    expect(missionForDay(atDay(1), 1).map((m) => m.id)).toContain('shieldUp'); // 05-09
    expect(missionForDay(atDay(5), 5).map((m) => m.id)).toContain('shieldUp'); // 05-13
    expect(missionForDay(atDay(5), 5)[0]!.target).toEqual({ kind: 'berm', value: 1 });
  });
  it('no shieldUp once the berm is maxed', () => {
    expect(missionForDay(atDay(1, { berm: 3 }), 1).map((m) => m.id)).not.toContain('shieldUp');
  });
  it('buildBattery before the 05-18 darkness when the battery is low (real data)', () => {
    expect(real[10]!.date).toBe('2024-05-18');
    const s = atDay(9, { battery: 3, life: 15 });
    expect(missionForDay(s, 9).map((m) => m.id)).toEqual(['buildBattery']);
    const built = { ...s, setup: { ...s.setup, batteryUnits: 1 } };
    expect(missionForDay(built, 9).map((m) => m.id)).toEqual(['saveEnergy']);
  });
  it('findIce when life support is low; otherwise an exploring mission; texts are short and complete', () => {
    const calm = atDay(14, { life: 8, battery: 8 });
    expect(missionForDay(calm, 14).map((m) => m.id)).toEqual(['findIce']);
    const none = missionForDay(atDay(14, { life: 18 }), 14);
    expect(none).toHaveLength(1);
    expect(none[0]!.id.startsWith('explore:')).toBe(true);
    for (const i of [0, 1, 5, 9, 14]) {
      for (const m of missionForDay(atDay(i), i)) {
        expect(m.titleEn.split(' ').length).toBeLessThanOrEqual(6);
        expect(m.whyEn.split(' ').length).toBeLessThanOrEqual(14);
        expect(m.titleTr.length + m.whyTr.length).toBeGreaterThan(10);
      }
    }
  });
});
