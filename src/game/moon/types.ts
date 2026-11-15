import type { ScenarioDay } from '../types';
import type { SlotStats } from '../../three/types';

export type { SlotStats };

/** The part of a ScenarioDay the moon engine needs (live days build one too). */
export type MoonDay = Pick<
  ScenarioDay,
  'date' | 'sparkleBand' | 'sparkleRatio' | 'alarmAt' | 'alarmKind' | 'alertOngoing' | 'bandIsAssumption' | 'radInstrument'
>;

/** The lander has room for TWO of these. */
export type CargoItem = 'extraTower' | 'batteryBank' | 'greenhouse';

export interface MoonSetup {
  habitat: SlotStats;
  /** Base-kit towers (2), plus one more if cargo has 'extraTower'. */
  towers: SlotStats[];
  /** Present iff cargo has 'greenhouse'. */
  greenhouse: SlotStats | null;
  /** Exactly two distinct items. */
  cargo: [CargoItem, CargoItem];
  /** World mode: battery units built by the commander (each +12 capacity). */
  batteryUnits?: number;
  /** World mode: first mission day index (0-based) each tower makes energy; parallel to towers. Missing = day 0. */
  towerFromDay?: number[];
}

export type WalkKind = 'rim' | 'ice';

/** What the commander chooses for one day. */
export interface MoonPlan {
  keepRunning: boolean;
  iceTrip: boolean;
  greenhouse: boolean;
  shield: boolean;
  scienceWalk: WalkKind | null;
  /** UI decides: the commander recalled the walkers when the alarm fired. */
  recalledInTime: boolean;
  /** Ground distance (m, along the terrain) the commander picked for the science walk. Omitted = nearest default (no extra cost). */
  walkTargetDistanceM?: number;
  /** Ground distance (m) to the picked ice target. Omitted = distance to the nearest PSR. */
  iceTargetDistanceM?: number;
  /** Energy the commander spent exploring on foot today (from the explorable Moon: 1 per started km). Whole number >= 0. */
  exploreEnergy?: number;
  /** Science points found during that outing (sum of the discovered points of interest). Whole number >= 0. */
  exploreScience?: number;
  /** Metres walked away from base during the outing (for the report fact). */
  exploreWalkedM?: number;
  /** English names of the places found during the outing (for the report fact). */
  exploreFound?: string[];
  /** World mode: ice was collected by visiting a shadowed spot; the ice trip costs no extra energy. */
  iceByVisit?: boolean;
  /** World mode: how exposed the commander was to the day's storm. Overrides the science-walk rule. */
  exposure?: 'inside' | 'recalled' | 'full';
  /** World mode: berm levels built today (default: 1 if `shield`). */
  shieldLevels?: number;
  /** World mode: energy spent on buildings today (towers, battery unit, greenhouse). */
  buildEnergy?: number;
}

export const NO_PLAN: MoonPlan = {
  keepRunning: false,
  iceTrip: false,
  greenhouse: false,
  shield: false,
  scienceWalk: null,
  recalledInTime: false,
};

export type DoseWhere = 'inside' | 'outsideFull' | 'outsideRecalled';

export type MoonEventId =
  | 'alarm'
  | 'alertOngoing'
  | 'unannouncedStorm'
  | 'resupply'
  | 'walkCancelled'
  | 'batteryFull'
  | 'darkDay'
  | 'earlyReturn';

export interface DayFact {
  id: string;
  /** Short English text; the UI can translate from id + values. */
  en: string;
  values: Record<string, number | string | null>;
  source: string;
  isAssumption: boolean;
}

export interface PlanCosts {
  running: number;
  ice: number;
  greenhouse: number;
  shield: number;
  walk: number;
  /** energy spent exploring on foot (plan.exploreEnergy) */
  explore: number;
  /** world mode: energy spent on buildings (only present when > 0) */
  build?: number;
  total: number;
  available: number;
  affordable: boolean;
  errors: string[];
}

export interface DoseBreakdown {
  base: number;
  where: DoseWhere;
  bermLevel: number;
  divisor: number;
  amount: number;
  before: number;
  after: number;
}

export interface DayReport {
  dayIndex: number; // 1-based
  date: string;
  band: MoonDay['sparkleBand'];
  sparkleRatio: number | null;
  bandIsAssumption: boolean;
  plan: MoonPlan;
  energy: {
    batteryBefore: number;
    perTower: number[];
    produced: number;
    available: number;
    spent: { running: number; ice: number; greenhouse: number; shield: number; walk: number; explore: number; build?: number; total: number };
    leftover: number;
    batteryAfter: number;
    wasted: number;
  };
  life: {
    before: number;
    iceGain: number;
    greenhouseGain: number;
    notRunningPenalty: number;
    consumption: number;
    after: number;
    resupplied: boolean;
  };
  dose: DoseBreakdown;
  science: { gained: number; total: number };
  events: MoonEventId[];
  facts: DayFact[];
}

export type MoonOutcome = 'completed' | 'earlyReturn';

export interface MoonState {
  setup: MoonSetup;
  days: MoonDay[];
  cursor: number; // index of the next day to play
  battery: number;
  life: number;
  dose: number;
  science: number;
  berm: number;
  iceTrips: number;
  walkCancelledToday: boolean;
  resupplies: number;
  reports: DayReport[];
  outcome: MoonOutcome | null;
}

export type MoonBadgeId = 'sunHunter' | 'iceMiner' | 'safeHarbor' | 'scientist';

export interface TowerSunSummary {
  towerIndex: number;
  avgLitPct: number;
  best: { date: string; litPct: number };
  worst: { date: string; litPct: number };
}

export interface MoonSummary {
  outcome: MoonOutcome | null;
  daysPlayed: number;
  totals: {
    energyProduced: number;
    energyWasted: number;
    energySpent: number;
    iceTrips: number;
    walks: number;
    science: number;
    resupplies: number;
    finalLife: number;
    finalDose: number;
    finalBerm: number;
  };
  sunlight: TowerSunSummary[];
  /** Same storm, other places (read from may-2024-compare.json). */
  elsewhere: { instrument: string; place: string; ratio: number; peakDate: string }[];
  /** Uncapped dose the crew would have taken with berm level 0 every day. */
  whatIfNoBermDose: number;
  badges: MoonBadgeId[];
}

