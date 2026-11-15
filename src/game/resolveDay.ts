import { RULES, getConfig, shieldDivisor } from './rules';
import type { DayChoice, DayResult, MissionState, Mode, ScenarioDay } from './types';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Resolve one day. Pure and deterministic. Updates resources, jar and results;
 * the cursor is advanced by mission.applyDay. Sets outcome 'earlyReturn' if the jar fills (captain only).
 */
export function resolveDay(
  state: MissionState,
  day: ScenarioDay,
  choice: DayChoice,
  mode: Mode,
): { nextState: MissionState; result: DayResult } {
  const cfg = getConfig(mode);
  const { water: w, garden: g, wall: wl } = choice.balls;
  for (const n of [w, g, wl]) {
    if (!Number.isInteger(n) || n < 0) throw new RangeError('Ball counts must be non-negative integers');
  }
  if (w + g + wl > cfg.ballsPerDay) throw new RangeError(`At most ${cfg.ballsPerDay} balls per day`);

  const sheltered = choice.location === 'inside';

  // Morning: balls are spent. Extra balls beyond a cap are simply lost.
  const wallLevel = clamp(state.wall + wl, 0, cfg.wallMax);
  const waterGain = Math.min(w, cfg.maxGainPerTank);
  const gardenCap = sheltered ? Math.min(cfg.maxGainPerTank, cfg.gardenShelteredMaxGain) : cfg.maxGainPerTank;
  const gardenGain = Math.min(g, gardenCap);

  // Sparkles.
  const base = RULES.common.baseSparkle.value[day.sparkleBand];
  const divisor = shieldDivisor(wallLevel);
  let dose: number;
  let exposure: DayResult['exposure'];
  let unannounced = false;
  if (day.sparkleBand === 'calm') {
    dose = RULES.common.calmDose.value; // galactic background, no free day
    exposure = sheltered ? 'sheltered' : 'exposed';
  } else if (sheltered) {
    dose = Math.ceil(base / divisor);
    exposure = 'sheltered';
  } else if (day.alarmAt !== null && choice.alarmTappedInTime) {
    const half = base / 2;
    dose = Math.min(base, Math.ceil(half) + Math.ceil(half / divisor));
    exposure = 'alarmInTime';
  } else {
    dose = base;
    exposure = 'exposed';
    unannounced = day.alarmAt === null && !day.alertOngoing;
  }

  // End of day: consumption, then Earth resupply for any empty tank.
  const endTank = (level: number, gain: number) => {
    const next = clamp(level + gain - cfg.tankConsumption, 0, cfg.tankMax);
    return next <= 0 ? { level: cfg.resupplyLevel, resupplied: true } : { level: next, resupplied: false };
  };
  const wTank = endTank(state.water, waterGain);
  const gTank = endTank(state.garden, gardenGain);
  const anyResupply = wTank.resupplied || gTank.resupplied;

  const sampleGained = !sheltered && !anyResupply;
  const sampleLost = !sheltered && anyResupply;
  const jar = Math.min(cfg.jarCapacity, state.jar + dose);
  const early = cfg.endsEarlyWhenJarFull && jar >= cfg.jarCapacity;

  const result: DayResult = {
    dayIndex: day.dayIndex,
    date: day.date,
    band: day.sparkleBand,
    baseSparkle: base,
    wallLevel,
    divisor,
    dose,
    exposure,
    unannounced,
    alertOngoing: day.alertOngoing === true,
    sampleGained,
    sampleLost,
    resupplied: { water: wTank.resupplied, garden: gTank.resupplied },
    waterAfter: wTank.level,
    gardenAfter: gTank.level,
    jarAfter: jar,
  };

  const nextState: MissionState = {
    ...state,
    water: wTank.level,
    garden: gTank.level,
    wall: wallLevel,
    jar,
    samples: state.samples + (sampleGained ? 1 : 0),
    resupplies: state.resupplies + (wTank.resupplied ? 1 : 0) + (gTank.resupplied ? 1 : 0),
    daysSheltered: state.daysSheltered + (sheltered ? 1 : 0),
    results: [...state.results, result],
    outcome: early ? 'earlyReturn' : state.outcome,
  };
  return { nextState, result };
}
