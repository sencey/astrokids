import compare from '../../data/scenarios/may-2024-compare.json';
import { MOON_RULES as R } from './rules';
import type {  DayFact,
  DayReport,
  DoseBreakdown,
  DoseWhere,
  MoonBadgeId,
  MoonDay,
  MoonEventId,
  MoonPlan,
  MoonSetup,
  MoonState,
  MoonSummary,
  PlanCosts,
  SlotStats,
  TowerSunSummary,
  WalkKind,
} from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Percent of the given mission day a slot is sunlit (falls back to the average illumination). */
export function litPct(stats: SlotStats, dayIdx: number): number {
  return stats.litPctByDay[dayIdx] ?? stats.illumPct;
}

/** Energy one tower makes on a day: round(10 x lit% / 100). */
export function towerEnergy(stats: SlotStats, dayIdx: number): number {
  return Math.round((R.energy.towerPeakUnits.value * litPct(stats, dayIdx)) / 100);
}

/** Base dose of a day before shielding (the real CRaTER ratio sets the number). */
export function baseDose(day: Pick<MoonDay, 'sparkleBand' | 'sparkleRatio'>): number {
  if (day.sparkleBand === 'calm') return R.radiation.cosmicRays.value;
  const [lo, hi] = day.sparkleBand === 'storm' ? R.radiation.stormClamp.value : R.radiation.superClamp.value;
  if (day.sparkleRatio === null || !Number.isFinite(day.sparkleRatio)) {
    return R.radiation.unknownRatioBase.value[day.sparkleBand];
  }
  return clamp(Math.round(day.sparkleRatio / R.radiation.ratioDivisor.value), lo, hi);
}

export function bermDivisor(level: number): number {
  return 1 + level; // level 3 -> 4 (Artemis I anchor)
}

export function doseAmount(base: number, where: DoseWhere, bermLevel: number): number {
  const div = bermDivisor(bermLevel);
  switch (where) {
    case 'inside':
      return Math.ceil(base / div);
    case 'outsideFull':
      return base;
    case 'outsideRecalled': {
      const half = base * R.radiation.alarmExposedFraction.value;
      return Math.ceil(half) + Math.ceil(half / div);
    }
  }
}

/** Ice trip: 2 + 1 per started km. distanceM defaults to the habitat's nearest PSR distance. */
export function iceTripCost(habitat: SlotStats, distanceM?: number): number {
  const d = distanceM ?? habitat.distanceToNearestPSRm;
  const km = Math.ceil(d / 1000);
  return R.actions.iceBaseCost.value + R.actions.icePerKmCost.value * km;
}

/** Science walk: rim 2 / ice 4, plus 1 per started km beyond the first km of the picked target (default: no extra). */
export function walkCost(kind: WalkKind, distanceM?: number): number {
  const base = kind === 'ice' ? R.actions.walkIceCost.value : R.actions.walkRimCost.value;
  if (distanceM === undefined) return base;
  const extraKm = Math.max(0, Math.ceil(distanceM / 1000) - 1);
  return base + R.actions.walkPerKmCost.value * extraKm;
}

/** Fact source for picked-target distances. */
export const WALK_DISTANCE_SOURCE = 'NASA LRO LOLA terrain (ground distance along the surface)';

export function greenhouseCost(greenhouse: SlotStats, dayIdx: number): number {
  const low = litPct(greenhouse, dayIdx) < R.actions.greenhouseLowLightPct.value;
  return R.actions.greenhouseCost.value + (low ? R.actions.greenhouseLowLightExtra.value : 0);
}

export function dailyProduction(setup: MoonSetup, dayIdx: number): number[] {
  return setup.towers.map((t, i) => ((setup.towerFromDay?.[i] ?? 0) > dayIdx ? 0 : towerEnergy(t, dayIdx)));
}

export function startMission(setup: MoonSetup, days: MoonDay[]): MoonState {
  const [a, b] = setup.cargo;
  if (a === b || setup.cargo.length !== R.mission.cargoPicks.value) throw new RangeError('Pick two different cargo items');
  const wantTowers = R.mission.baseTowers.value + (setup.cargo.includes('extraTower') ? 1 : 0);
  if (setup.towers.length !== wantTowers) throw new RangeError(`Expected ${wantTowers} solar towers`);
  if ((setup.greenhouse !== null) !== setup.cargo.includes('greenhouse')) throw new RangeError('Greenhouse must match cargo');
  if (days.length === 0) throw new RangeError('A mission needs at least one day');
  return {
    setup,
    days,
    cursor: 0,
    battery: R.energy.batteryStart.value,
    life: R.life.start.value,
    dose: 0,
    science: 0,
    berm: 0,
    iceTrips: 0,
    walkCancelledToday: false,
    resupplies: 0,
    reports: [],
    outcome: null,
  };
}

/** Battery capacity: 8, or 8 + 12 with the battery bank. */
export function batteryCap(setup: MoonSetup): number {
  return (
    R.energy.batteryMax.value +
    (setup.cargo.includes('batteryBank') ? R.mission.batteryBankExtra.value : 0) +
    (setup.batteryUnits ?? 0) * R.world.batteryUnitExtra.value
  );
}

export function isFinished(state: MoonState): boolean {
  return state.outcome !== null;
}

/** Cost and validity of a plan for the state's current day. Pure; the UI can call it to grey out buttons. */
export function planCosts(state: MoonState, plan: MoonPlan): PlanCosts {
  const errors: string[] = [];
  const dayIdx = state.cursor;
  const { habitat, greenhouse } = state.setup;
  const available = state.battery + dailyProduction(state.setup, dayIdx).reduce((a, b) => a + b, 0);

  const running = plan.keepRunning
    ? plan.scienceWalk === null
      ? R.actions.runningCostInside.value
      : R.actions.runningCost.value
    : 0;
  const cold = plan.keepRunning && litPct(state.setup.habitat, dayIdx) < R.actions.coldHabitatLitPct.value ? R.actions.coldHabitatExtra.value : 0;

  let ice = 0;
  if (plan.iceTrip && plan.iceByVisit) {
    ice = 0; // the walk to the ice was already paid as exploring
  } else if (plan.iceTrip) {
    if (!Number.isFinite(habitat.distanceToNearestPSRm)) errors.push('No ice reachable: no PSR known near the habitat');
    else if (plan.iceTargetDistanceM !== undefined && !(Number.isFinite(plan.iceTargetDistanceM) && plan.iceTargetDistanceM >= 0)) errors.push('Invalid ice target distance');
    else ice = iceTripCost(habitat, plan.iceTargetDistanceM);
  }

  let gh = 0;
  if (plan.greenhouse) {
    if (greenhouse === null) errors.push('No greenhouse built');
    else gh = greenhouseCost(greenhouse, dayIdx);
  }

  let shield = 0;
  const levels = shieldLevelsOf(plan);
  if (levels > 0) {
    if (state.berm + levels > R.actions.bermMax.value) errors.push('Berm already at maximum level');
    else shield = R.actions.shieldCost.value * levels;
  }
  let build = 0;
  if (plan.buildEnergy !== undefined) {
    if (!Number.isFinite(plan.buildEnergy) || plan.buildEnergy < 0) errors.push('Invalid build energy');
    else build = Math.floor(plan.buildEnergy);
  }

  let walk = 0;
  if (plan.scienceWalk !== null) {
    if (state.walkCancelledToday) errors.push('Science walk cancelled today (Earth resupply)');
    else if (plan.walkTargetDistanceM !== undefined && !(Number.isFinite(plan.walkTargetDistanceM) && plan.walkTargetDistanceM >= 0)) errors.push('Invalid walk target distance');
    else walk = walkCost(plan.scienceWalk, plan.walkTargetDistanceM);
  }

  let explore = 0;
  if (plan.exploreEnergy !== undefined) {
    if (!Number.isFinite(plan.exploreEnergy) || plan.exploreEnergy < 0) errors.push('Invalid explore energy');
    else explore = Math.floor(plan.exploreEnergy);
  }
  if (plan.exploreScience !== undefined && !(Number.isFinite(plan.exploreScience) && plan.exploreScience >= 0)) errors.push('Invalid explore science');

  const total = running + cold + ice + gh + shield + walk + explore + build;
  if (total > available) errors.push(`Not enough energy: need ${total}, have ${available}`);
  return {
    running: running + cold,
    ice,
    greenhouse: gh,
    shield,
    walk,
    explore,
    ...(build > 0 ? { build } : {}),
    total,
    available,
    affordable: errors.length === 0,
    errors,
  };
}

/** Berm levels a plan builds today (world mode can build several; the classic plan builds one). */
export function shieldLevelsOf(plan: Pick<MoonPlan, 'shield' | 'shieldLevels'>): number {
  if (plan.shieldLevels !== undefined) return Math.max(0, Math.floor(plan.shieldLevels));
  return plan.shield ? 1 : 0;
}

function buildFacts(
  state: MoonState,
  day: MoonDay,
  dayIdx: number,
  plan: MoonPlan,
  base: number,
  where: DoseWhere,
): DayFact[] {
  const facts: DayFact[] = [];
  if ((plan.exploreWalkedM ?? 0) > 0 || (plan.exploreFound?.length ?? 0) > 0) {
    const km = ((plan.exploreWalkedM ?? 0) / 1000).toFixed(2);
    const found = plan.exploreFound ?? [];
    facts.push({
      id: 'explore',
      en: found.length ? `Explored ${km} km, found ${found.join(', ')}.` : `Explored ${km} km.`,
      values: { distanceM: Math.round(plan.exploreWalkedM ?? 0), found: found.join(', ') || null, science: plan.exploreScience ?? 0 },
      source: WALK_DISTANCE_SOURCE + '; NASA LOLA',
      isAssumption: false,
    });
  }
  const sunSrc = R.energy.litSource.value;
  state.setup.towers.forEach((t, i) => {
    facts.push({
      id: 'towerSun',
      en: `Tower ${i + 1} is in sunlight ${litPct(t, dayIdx)}% of today.`,
      values: { tower: i + 1, litPct: litPct(t, dayIdx), averageIlluminationPct: t.illumPct },
      source: sunSrc,
      isAssumption: false,
    });
  });
  facts.push({
    id: 'radiation',
    en:
      day.sparkleBand === 'calm'
        ? 'A calm day: only galactic cosmic rays.'
        : `Space weather: dose was ${day.sparkleRatio ?? 'an unknown multiple'}x a quiet day (same detector).`,
    values: { band: day.sparkleBand, ratio: day.sparkleRatio, base },
    source: day.radInstrument ? `${day.radInstrument}, ${R.radiation.source.value}` : R.radiation.source.value,
    isAssumption: day.bandIsAssumption,
  });
  if (day.alarmAt !== null) {
    facts.push({
      id: 'alarm',
      en: `A solar particle alert came at ${day.alarmAt} (${day.alarmKind ?? 'unknown'}).`,
      values: { alarmAt: day.alarmAt, kind: day.alarmKind ?? null },
      source: 'NASA DONKI SEP',
      isAssumption: false,
    });
  }
  if (plan.iceTrip) {
    if (plan.iceByVisit) {
      facts.push({
        id: 'iceVisit',
        en: 'The commander visited permanently shadowed ground and brought back ice.',
        values: { visited: 1 },
        source: R.actions.iceLifeGain.source ?? LOLA_FALLBACK,
        isAssumption: false,
      });
    } else if (plan.iceTargetDistanceM !== undefined) {
      facts.push({
        id: 'iceDistance',
        en: `The rover drove ${(plan.iceTargetDistanceM / 1000).toFixed(1)} km to the ice you picked.`,
        values: { distanceM: Math.round(plan.iceTargetDistanceM), picked: 1 },
        source: WALK_DISTANCE_SOURCE,
        isAssumption: false,
      });
    } else {
      facts.push({
        id: 'iceDistance',
        en: `The nearest permanently shadowed region is ${Math.round(state.setup.habitat.distanceToNearestPSRm)} m away.`,
        values: { distanceM: Math.round(state.setup.habitat.distanceToNearestPSRm) },
        source: R.actions.iceLifeGain.source ?? LOLA_FALLBACK,
        isAssumption: false,
      });
    }
  }
  if (plan.scienceWalk !== null && plan.walkTargetDistanceM !== undefined) {
    const km = (plan.walkTargetDistanceM / 1000).toFixed(1);
    facts.push({
      id: 'walkDistance',
      en: `The crew walked ${km} km to ${plan.scienceWalk === 'ice' ? 'a permanently shadowed crater' : 'a sunlit spot on the rim'}.`,
      values: { distanceM: Math.round(plan.walkTargetDistanceM), kind: plan.scienceWalk },
      source: WALK_DISTANCE_SOURCE,
      isAssumption: false,
    });
  }
  if (where === 'inside' && state.berm > 0 && base > 1) {
    facts.push({
      id: 'berm',
      en: `A level ${state.berm} berm divides the dose by ${bermDivisor(state.berm)}.`,
      values: { level: state.berm, divisor: bermDivisor(state.berm) },
      source: R.radiation.bermTopDivisor.source ?? LOLA_FALLBACK,
      isAssumption: state.berm < R.actions.bermMax.value,
    });
  }
  return facts;
}

const LOLA_FALLBACK = 'NASA';

/** Resolve one day. Pure and deterministic; throws RangeError for an invalid plan. */
export function resolveDay(state: MoonState, plan: MoonPlan): { nextState: MoonState; report: DayReport } {
  if (state.outcome !== null) throw new RangeError('Mission is over');
  const dayIdx = state.cursor;
  const day = state.days[dayIdx];
  if (!day) throw new RangeError('No day to play');

  const costs = planCosts(state, plan);
  if (!costs.affordable) throw new RangeError(costs.errors.join('; '));

  // Energy
  const perTower = dailyProduction(state.setup, dayIdx);
  const produced = perTower.reduce((a, b) => a + b, 0);
  const leftover = costs.available - costs.total;
  const cap = batteryCap(state.setup);
  const batteryAfter = Math.min(cap, leftover);
  const wasted = Math.max(0, leftover - cap);

  // Berm (built in the morning, helps today)
  const berm = state.berm + shieldLevelsOf(plan);

  // Life support
  const iceGain = plan.iceTrip ? R.actions.iceLifeGain.value : 0;
  const ghGain = plan.greenhouse ? R.actions.greenhouseGain.value : 0;
  const penalty = plan.keepRunning ? 0 : R.actions.runningPenalty.value;
  const consumption = R.life.consumptionPerDay.value;
  const raw = Math.min(R.life.max.value, state.life + iceGain + ghGain) - penalty - consumption;
  const resupplied = raw <= 0;
  const lifeAfter = resupplied ? R.life.resupplyLevel.value : Math.min(R.life.max.value, raw);

  // Radiation
  const base = baseDose(day);
  const canRecall = day.alarmAt !== null && day.alertOngoing !== true;
  const outside = plan.exposure !== undefined ? plan.exposure !== 'inside' : plan.scienceWalk !== null;
  const where: DoseWhere =
    plan.exposure !== undefined
      ? plan.exposure === 'inside'
        ? 'inside'
        : plan.exposure === 'recalled' && canRecall
          ? 'outsideRecalled'
          : 'outsideFull'
      : !outside
        ? 'inside'
        : plan.recalledInTime && canRecall
          ? 'outsideRecalled'
          : 'outsideFull';
  const amount = doseAmount(base, where, berm);
  const doseAfter = Math.min(R.radiation.doseLimit.value, state.dose + amount);
  const doseBreakdown: DoseBreakdown = {
    base,
    where,
    bermLevel: berm,
    divisor: bermDivisor(berm),
    amount,
    before: state.dose,
    after: doseAfter,
  };

  // Science
  const gained =
    (plan.scienceWalk === 'ice' ? R.actions.walkIceScience.value : plan.scienceWalk === 'rim' ? R.actions.walkRimScience.value : 0) +
    Math.floor(plan.exploreScience ?? 0);

  // Events
  const events: MoonEventId[] = [];
  if (day.alarmAt !== null) events.push('alarm');
  if (day.alertOngoing === true) events.push('alertOngoing');
  if (outside && day.sparkleBand !== 'calm' && day.alarmAt === null && day.alertOngoing !== true) events.push('unannouncedStorm');
  if (state.walkCancelledToday) events.push('walkCancelled');
  if (resupplied) events.push('resupply');
  if (wasted > 0) events.push('batteryFull');
  if (produced <= R.energy.darkDayMaxUnits.value) events.push('darkDay');
  const early = doseAfter >= R.radiation.doseLimit.value;
  if (early) events.push('earlyReturn');

  const report: DayReport = {
    dayIndex: dayIdx + 1,
    date: day.date,
    band: day.sparkleBand,
    sparkleRatio: day.sparkleRatio,
    bandIsAssumption: day.bandIsAssumption,
    plan: { ...plan },
    energy: {
      batteryBefore: state.battery,
      perTower,
      produced,
      available: costs.available,
      spent: {
        running: costs.running,
        ice: costs.ice,
        greenhouse: costs.greenhouse,
        shield: costs.shield,
        walk: costs.walk,
        explore: costs.explore,
        ...(costs.build ? { build: costs.build } : {}),
        total: costs.total,
      },
      leftover,
      batteryAfter,
      wasted,
    },
    life: {
      before: state.life,
      iceGain,
      greenhouseGain: ghGain,
      notRunningPenalty: penalty,
      consumption,
      after: lifeAfter,
      resupplied,
    },
    dose: doseBreakdown,
    science: { gained, total: state.science + gained },
    events,
    facts: buildFacts({ ...state, berm }, day, dayIdx, plan, base, where),
  };

  const cursor = dayIdx + 1;
  const nextState: MoonState = {
    ...state,
    cursor,
    battery: batteryAfter,
    life: lifeAfter,
    dose: doseAfter,
    science: state.science + gained,
    berm,
    iceTrips: state.iceTrips + (plan.iceTrip ? 1 : 0),
    walkCancelledToday: R.life.resupplyCancelsWalk.value && resupplied,
    resupplies: state.resupplies + (resupplied ? 1 : 0),
    reports: [...state.reports, report],
    outcome: early ? 'earlyReturn' : cursor >= state.days.length ? 'completed' : null,
  };
  return { nextState, report };
}

/** Success = stayed all days (no early return) and needed Earth resupply at most 2 times. */
export function missionSucceeded(state: MoonState): boolean {
  return state.outcome === 'completed' && state.resupplies <= R.goal.maxResupplies.value;
}

export function earnedMoonBadges(state: MoonState): MoonBadgeId[] {
  const out: MoonBadgeId[] = [];
  const sun = sunlightSummary(state);
  if (sun.some((s) => s.avgLitPct >= R.badges.sunHunterAvgLitPct.value)) out.push('sunHunter');
  if (state.iceTrips >= R.badges.iceMinerTrips.value) out.push('iceMiner');
  if (state.reports.length > 0 && state.dose <= R.badges.safeHarborMaxDose.value) out.push('safeHarbor');
  if (state.science >= R.badges.scientistMinScience.value) out.push('scientist');
  return out;
}

function sunlightSummary(state: MoonState): TowerSunSummary[] {
  const n = state.reports.length;
  if (n === 0) return [];
  return state.setup.towers.map((t, towerIndex) => {
    const rows = state.reports.map((r) => ({ date: r.date, litPct: litPct(t, r.dayIndex - 1) }));
    let best = rows[0]!;
    let worst = rows[0]!;
    for (const r of rows) {
      if (r.litPct > best.litPct) best = r;
      if (r.litPct < worst.litPct) worst = r;
    }
    return { towerIndex, avgLitPct: rows.reduce((a, r) => a + r.litPct, 0) / n, best, worst };
  });
}

export function summarize(state: MoonState): MoonSummary {
  const rs = state.reports;
  const sum = (f: (r: DayReport) => number) => rs.reduce((a, r) => a + f(r), 0);
  const elsewhere = (compare.instruments as { instrument: string; place: string; ratio: number; peakDate: string }[]).map(
    (i) => ({ instrument: i.instrument, place: i.place, ratio: i.ratio, peakDate: i.peakDate }),
  );
  return {
    outcome: state.outcome,
    daysPlayed: rs.length,
    totals: {
      energyProduced: sum((r) => r.energy.produced),
      energyWasted: sum((r) => r.energy.wasted),
      energySpent: sum((r) => r.energy.spent.total),
      iceTrips: state.iceTrips,
      walks: rs.filter((r) => r.plan.scienceWalk !== null).length,
      science: state.science,
      resupplies: state.resupplies,
      finalLife: state.life,
      finalDose: state.dose,
      finalBerm: state.berm,
    },
    sunlight: sunlightSummary(state),
    elsewhere,
    whatIfNoBermDose: sum((r) => doseAmount(r.dose.base, r.dose.where, 0)),
    badges: earnedMoonBadges(state),
  };
}



