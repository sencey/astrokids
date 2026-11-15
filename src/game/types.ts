// ---- Data contract (emitted as JSON by the data pipeline) ----

export type SparkleBand = 'calm' | 'storm' | 'super';

export interface Provenance {
  sourceId: string;
  sourceUrl: string;
  fetchedAt: string;
  isLive: boolean;
}

export interface ScenarioDay {
  dayIndex: number; // 1-based
  date: string; // 'YYYY-MM-DD' (UTC)
  sparkleBand: SparkleBand;
  sparkleRatio: number | null; // daily dose / quiet-day dose, SAME detector; null if unknown
  radInstrument: string | null;
  bandIsAssumption: boolean; // true if band was not derived from RadLab
  flares: { peakTime: string; classType: string }[];
  forecasts: {
    simulationId: string;
    cmeStart: string | null;
    estShockArrivalEarth: string | null;
    kp90: number | null;
    kp180: number | null;
  }[];
  shocks: { eventTime: string; location: string }[];
  sepEvents: { eventTime: string; instrument: string }[];
  alarmAt: string | null; // first SEP eventTime of that UTC day, else null
  alarmKind?: 'measured' | 'model' | null;
  /** A particle event from an earlier day is still in progress; the morning forecast already warns, no mid-day alarm. */
  alertOngoing?: boolean;
  provenance: Provenance[];
}

export interface Scenario {
  id: string;
  slug: string;
  titleTr: string;
  titleEn: string;
  world: 'moon';
  dataMode: 'archive' | 'live';
  startDate: string;
  endDate: string;
  lessonTr: string;
  lessonEn: string;
  generatedAt: string;
  sources: Provenance[];
  days: ScenarioDay[];
}

// ---- Game state ----

export type Mode = 'playmate' | 'captain';
export type Outcome = 'completed' | 'earlyReturn';

/** How the child spends the day's energy balls. Unspent balls are lost. */
export interface BallAllocation {
  water: number;
  garden: number;
  wall: number;
}

export interface DayChoice {
  balls: BallAllocation;
  location: 'inside' | 'outside';
  /**
   * Child tapped the doghouse after the alarm. The UI decides "in time":
   * captain = within 5 s, playmate = untimed (any tap counts).
   */
  alarmTappedInTime: boolean;
}

/** The child's guess of when a CME shock reaches Earth (captain mode). */
export interface ForecastGuess {
  simulationId: string; // the forecast being guessed about
  guessedArrival: string; // ISO timestamp
}

export interface DayResult {
  dayIndex: number;
  date: string;
  band: SparkleBand;
  baseSparkle: number;
  wallLevel: number;
  divisor: number;
  dose: number;
  /** 'sheltered' = inside all day; 'alarmInTime' = half exposed; 'exposed' = full dose. */
  exposure: 'sheltered' | 'alarmInTime' | 'exposed';
  unannounced: boolean; // storm/super day outside with no alarm
  alertOngoing: boolean; // went out while a warned particle event was still in progress
  sampleGained: boolean;
  sampleLost: boolean; // outside, but an Earth resupply cost today's sample
  resupplied: { water: boolean; garden: boolean };
  waterAfter: number;
  gardenAfter: number;
  jarAfter: number;
}

export interface MissionState {
  mode: Mode;
  days: ScenarioDay[]; // days actually played (playmate filters by date)
  cursor: number; // index into days of the next day to play
  water: number;
  garden: number;
  wall: number;
  jar: number;
  samples: number;
  resupplies: number;
  daysSheltered: number;
  results: DayResult[];
  forecastGuess: ForecastGuess | null;
  outcome: Outcome | null; // null while the mission is running
}
