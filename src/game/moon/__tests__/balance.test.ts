import { describe, expect, it } from 'vitest';
import { loadMoonDays } from '../scenario';
import { resolveDay, startMission, planCosts, summarize, missionSucceeded } from '../engine';
import { NO_PLAN } from '../types';
import type { CargoItem, MoonPlan, MoonState, SlotStats } from '../types';
import { loadRealSlots } from './realTerrain';

type Strategy = (s: MoonState) => MoonPlan;

/** Adds each wanted action in order, but only if the plan stays affordable. */
function build(s: MoonState, base: Partial<MoonPlan>, wants: Partial<MoonPlan>[]): MoonPlan {
  let plan: MoonPlan = { ...NO_PLAN, ...base };
  if (!planCosts(s, plan).affordable) plan = { ...NO_PLAN };
  for (const w of wants) {
    const trial = { ...plan, ...w };
    if (planCosts(s, trial).affordable) plan = trial;
  }
  return plan;
}

const lifeLow = (s: MoonState, n: number) => s.life <= n;

const STRATEGIES: Record<string, { cargo: [CargoItem, CargoItem]; pick: Strategy }> = {
  doNothing: { cargo: ['extraTower', 'batteryBank'], pick: () => NO_PLAN },
  'careless (walk always, never recall)': {
    cargo: ['extraTower', 'greenhouse'],
    pick: (s) => build(s, { keepRunning: true }, [{ scienceWalk: 'ice' }, { scienceWalk: 'rim' }]),
  },
  alwaysShieldFirst: {
    cargo: ['extraTower', 'batteryBank'],
    pick: (s) => build(s, { keepRunning: true }, [{ shield: true }, { iceTrip: true }, { scienceWalk: 'rim', recalledInTime: true }]),
  },
  alwaysScience: {
    cargo: ['extraTower', 'batteryBank'],
    pick: (s) =>
      build(s, { keepRunning: true, recalledInTime: true }, [{ scienceWalk: 'ice' }, { scienceWalk: 'rim' }, ...(lifeLow(s, 6) ? [{ iceTrip: true }] : [])]),
  },
  balanced: {
    cargo: ['extraTower', 'batteryBank'],
    pick: (s) =>
      build(s, { keepRunning: true, recalledInTime: true }, [
        ...(s.berm < 3 && s.cursor < 5 ? [{ shield: true }] : []),
        ...(lifeLow(s, 9) ? [{ iceTrip: true }] : []),
        ...(s.days[s.cursor]!.sparkleBand === 'calm' ? [{ scienceWalk: 'rim' as const }] : []),
      ]),
  },
  prepareEarly: {
    cargo: ['extraTower', 'batteryBank'],
    pick: (s) =>
      build(s, { keepRunning: true }, [
        ...(s.berm < 3 ? [{ shield: true }] : []),
        ...(s.cursor < 6 && s.life <= 14 ? [{ iceTrip: true }] : []),
        ...(s.cursor >= 6 && lifeLow(s, 8) ? [{ iceTrip: true }] : []),
        ...(s.cursor < 6 && s.berm >= 3 && s.days[s.cursor]!.sparkleBand === 'calm' ? [{ scienceWalk: 'rim' as const, recalledInTime: true }] : []),
        ...(s.cursor >= 12 && s.days[s.cursor]!.sparkleBand === 'calm' ? [{ scienceWalk: 'rim' as const, recalledInTime: true }] : []),
      ]),
  },
};

STRATEGIES['prepareEarly tower+greenhouse'] = { ...STRATEGIES['prepareEarly']!, cargo: ['extraTower', 'greenhouse'] };
STRATEGIES['prepareEarly bank+greenhouse'] = { ...STRATEGIES['prepareEarly']!, cargo: ['batteryBank', 'greenhouse'] };

export function setupFromReal(cargo: [CargoItem, CargoItem]) {
  const all = loadRealSlots().filter((x) => !x.stats.isPSR);
  const meanLit = (st: SlotStats) => st.litPctByDay.reduce((a, b) => a + b, 0) / st.litPctByDay.length;
  const byLit = [...all].sort((a, b) => meanLit(b.stats) - meanLit(a.stats));
  const habitat = [...byLit.slice(0, 40)].filter((x) => x.stats.distanceToNearestPSRm >= 300).sort((a, b) => a.stats.distanceToNearestPSRm - b.stats.distanceToNearestPSRm)[0]!.stats;
  const towers = byLit.slice(0, cargo.includes('extraTower') ? 3 : 2).map((x) => x.stats);
  const greenhouse = cargo.includes('greenhouse') ? byLit[3]!.stats : null;
  return { habitat, towers, greenhouse, cargo };
}

function run(name: string) {
  const def = STRATEGIES[name]!;
  let s = startMission(setupFromReal(def.cargo), loadMoonDays());
  while (s.outcome === null) s = resolveDay(s, def.pick(s)).nextState;
  return s;
}

describe('balance probe on real Connecting Ridge terrain', () => {
  it('prints the strategy table', () => {
    const setup = setupFromReal(['extraTower', 'batteryBank']);
    console.log('habitat distance to PSR (m):', Math.round(setup.habitat.distanceToNearestPSRm));
    console.log('tower lit% by day:', setup.towers.map((t) => t.litPctByDay.map((v) => Math.round(v)).join(',')));
    const rows = Object.keys(STRATEGIES).map((name) => {
      const s = run(name);
      const sum = summarize(s);
      return {
        strategy: name,
        outcome: s.outcome,
        success: missionSucceeded(s),
        days: s.reports.length,
        finalLife: s.life,
        resupplies: s.resupplies,
        finalDose: s.dose,
        science: s.science,
        berm: s.berm,
        iceTrips: s.iceTrips,
        wastedEnergy: sum.totals.energyWasted,
        noBermDose: sum.whatIfNoBermDose,
        badges: sum.badges.join('+'),
      };
    });
    console.table(rows);
    const by = Object.fromEntries(rows.map((r) => [r.strategy, r]));
    // Design targets from the manager.
    expect(by['prepareEarly']!.success).toBe(true);
    expect(by['doNothing']!.success).toBe(false);
    expect(by['careless (walk always, never recall)']!.success).toBe(false);
    expect(by['balanced']!.success).toBe(true);
    expect(by['alwaysScience']!.outcome === 'earlyReturn' || by['alwaysScience']!.resupplies >= 3).toBe(true);
    expect(by['prepareEarly bank+greenhouse']!.success).toBe(true);
    expect(by['prepareEarly bank+greenhouse']!.wastedEnergy).toBeLessThan(60);
    for (const r of rows) expect(Number.isFinite(r.finalDose + r.finalLife + r.science)).toBe(true);
  });
});





