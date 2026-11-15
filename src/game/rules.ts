import type { Mode, SparkleBand } from './types';

/** Every tunable number, with provenance, so the "For grown-ups" screen can list them. */
export interface Rule<T> {
  value: T;
  source: string | null;
  isAssumption: boolean;
  note: string;
}

const rule = <T>(value: T, source: string | null, isAssumption: boolean, note: string): Rule<T> => ({
  value,
  source,
  isAssumption,
  note,
});

const BVAD = 'NASA Baseline Values and Assumptions Document (BVAD)';
const ISS_WATER = 'ISS water recovery, about 98% (NASA ECLSS)';
const ARTEMIS = 'Artemis I Orion storm-shelter measurement: 414 vs 95 uGy/min (reference event scaled)';

export const RULES = {
  common: {
    jarCapacity: rule(20, null, true, 'Sparkle jar size; game-design choice.'),
    baseSparkle: rule<Record<SparkleBand, number>>(
      { calm: 1, storm: 6, super: 12 },
      null,
      true,
      'Sparkles per day by band, before shielding. Ratios between bands follow RadLab; the integers are scaled for play.',
    ),
    bandThresholdStorm: rule(3, 'RadLab daily dose / quiet-day dose', true, 'Ratio >= 3 is a storm day.'),
    bandThresholdSuper: rule(100, 'RadLab daily dose / quiet-day dose', true, 'Ratio >= 100 is a super storm day.'),
    calmDose: rule(1, null, true, 'Galactic background: a calm day always adds 1, sheltered or not.'),
    wallMaxLevel: rule(3, null, true, 'Doghouse wall levels 0-3.'),
    wallDivisorTopLevel: rule(4, ARTEMIS, false, 'Level 3 divides the dose by 4.'),
    wallDivisorIntermediate: rule(
      'level + 1 (levels 0,1,2 divide by 1,2,3)',
      null,
      true,
      'Linear interpolation between no wall and the measured level 3.',
    ),
    alarmExposedFraction: rule(0.5, null, true, 'If the alarm is answered in time, half the day is exposed.'),
    gardenShelteredMaxGain: rule(1, null, true, 'Sheltering all day leaves little time to tend the garden.'),
    resupplyLevel: rule(3, null, true, 'Earth resupply tops a failed tank up to 3 (non-punishing).'),
    shockMatchWindowHours: rule(24, null, true, 'Matching window; ENLIL errors of ~20 h were observed in March 2026. 36 h would wrongly match the 12 May shock to the 13 May forecast.'),
    alarmWindowSeconds: rule(5, null, true, 'Captain mode alarm tap window (UI uses this).'),
  },
  captain: {
    ballsPerDay: rule(4, null, true, 'Energy balls per day; unused balls are lost.'),
    tankStart: rule(8, BVAD, true, 'Starting tank level; integer scaling of BVAD consumption is an assumption.'),
    tankMax: rule(10, BVAD, true, 'Tank capacity.'),
    tankConsumption: rule(2, BVAD, true, 'Daily use. Basis is BVAD; the integer scaling is an assumption.'),
    waterGainPerBall: rule(1, ISS_WATER, true, 'Recovery basis is ISS 98% water recovery; integer scaling is an assumption.'),
    maxGainPerTank: rule(2, null, true, 'At most +2 per tank per day.'),
    wallStart: rule(0, null, true, 'Doghouse wall starts bare.'),
    endsEarlyWhenJarFull: rule(true, null, true, 'Full jar sends the crew home early to rest.'),
    timedAlarm: rule(true, null, true, 'Alarm must be tapped within the window.'),
  },
  playmate: {
    ballsPerDay: rule(3, null, true, 'Energy balls per day.'),
    tankStart: rule(4, null, true, 'Smaller tanks for ages 5-7.'),
    tankMax: rule(5, null, true, 'Tank capacity.'),
    tankConsumption: rule(1, null, true, 'Daily use.'),
    waterGainPerBall: rule(1, null, true, 'Gain per ball.'),
    maxGainPerTank: rule(1, null, true, 'At most +1 per tank per day.'),
    wallStart: rule(1, null, true, 'Wall level 1 is earned in the tutorial.'),
    endsEarlyWhenJarFull: rule(false, null, true, 'The jar just fills; the mission never ends early.'),
    timedAlarm: rule(false, null, true, 'Alarm is untimed.'),
    firstDate: rule('2024-05-10', null, true, 'Playmate plays only the storm core of the week.'),
    lastDate: rule('2024-05-14', null, true, 'Playmate plays only the storm core of the week.'),
  },
} as const;

/** Plain numbers for one mode, so game code does not unwrap rules everywhere. */
export interface ModeConfig {
  ballsPerDay: number;
  tankStart: number;
  tankMax: number;
  tankConsumption: number;
  maxGainPerTank: number;
  wallStart: number;
  wallMax: number;
  jarCapacity: number;
  endsEarlyWhenJarFull: boolean;
  resupplyLevel: number;
  gardenShelteredMaxGain: number;
  dateFilter: { first: string; last: string } | null;
}

export function getConfig(mode: Mode): ModeConfig {
  const m = RULES[mode];
  return {
    ballsPerDay: m.ballsPerDay.value,
    tankStart: m.tankStart.value,
    tankMax: m.tankMax.value,
    tankConsumption: m.tankConsumption.value,
    maxGainPerTank: m.maxGainPerTank.value,
    wallStart: m.wallStart.value,
    wallMax: RULES.common.wallMaxLevel.value,
    jarCapacity: RULES.common.jarCapacity.value,
    endsEarlyWhenJarFull: m.endsEarlyWhenJarFull.value,
    resupplyLevel: RULES.common.resupplyLevel.value,
    gardenShelteredMaxGain: RULES.common.gardenShelteredMaxGain.value,
    dateFilter:
      mode === 'playmate'
        ? { first: RULES.playmate.firstDate.value, last: RULES.playmate.lastDate.value }
        : null,
  };
}

/** Classify a RadLab ratio into a band. */
export function bandFromRatio(ratio: number): SparkleBand {
  if (ratio >= RULES.common.bandThresholdSuper.value) return 'super';
  if (ratio >= RULES.common.bandThresholdStorm.value) return 'storm';
  return 'calm';
}

export function shieldDivisor(wallLevel: number): number {
  return wallLevel + 1;
}

/** Flat list of every rule for the grown-ups screen. */
export function listRules(): { group: string; key: string; rule: Rule<unknown> }[] {
  return Object.entries(RULES).flatMap(([group, rules]) =>
    Object.entries(rules).map(([key, r]) => ({ group, key, rule: r as Rule<unknown> })),
  );
}
