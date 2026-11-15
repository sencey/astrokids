import { RULES, getConfig } from './rules';
import { resolveDay } from './resolveDay';
import type { DayChoice, DayResult, MissionState, Mode, Outcome, Scenario, ScenarioDay } from './types';

export function startMission(scenario: Scenario, mode: Mode): MissionState {
  const cfg = getConfig(mode);
  const f = cfg.dateFilter;
  const days = f ? scenario.days.filter((d) => d.date >= f.first && d.date <= f.last) : [...scenario.days];
  return {
    mode,
    days,
    cursor: 0,
    water: cfg.tankStart,
    garden: cfg.tankStart,
    wall: cfg.wallStart,
    jar: 0,
    samples: 0,
    resupplies: 0,
    daysSheltered: 0,
    results: [],
    forecastGuess: null,
    outcome: null,
  };
}

export const isFinished = (s: MissionState): boolean => s.outcome !== null;

export const currentDay = (s: MissionState): ScenarioDay | null => (isFinished(s) ? null : s.days[s.cursor] ?? null);

/** Play the current day and advance. Throws if the mission is finished. */
export function applyDay(state: MissionState, choice: DayChoice): { nextState: MissionState; result: DayResult } {
  const day = currentDay(state);
  if (!day) throw new Error('Mission is finished');
  const { nextState, result } = resolveDay(state, day, choice, state.mode);
  const cursor = state.cursor + 1;
  const outcome: Outcome | null = nextState.outcome ?? (cursor >= state.days.length ? 'completed' : null);
  return { nextState: { ...nextState, cursor, outcome }, result };
}

export function setForecastGuess(state: MissionState, simulationId: string, guessedArrival: string): MissionState {
  return { ...state, forecastGuess: { simulationId, guessedArrival } };
}

// ---- Forecast helpers ----

const ms = (iso: string) => Date.parse(iso);
const allShocks = (days: ScenarioDay[]) =>
  days.flatMap((d) => d.shocks.map((s) => s.eventTime)).sort((a, b) => ms(a) - ms(b));

/**
 * The Earth shock closest in time to a forecast estimate, within +-windowHours.
 * Ties go to the earlier shock; no shock in the window means the cloud never came (null).
 */
export function matchShock(
  days: ScenarioDay[],
  estimateIso: string,
  windowHours: number = RULES.common.shockMatchWindowHours.value,
): string | null {
  const est = ms(estimateIso);
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const t of allShocks(days)) {
    // allShocks is sorted ascending, so strict < keeps the earlier shock on ties.
    const diff = Math.abs(ms(t) - est);
    if (diff <= windowHours * 3_600_000 && diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best;
}

/** Signed minutes from a forecast's estimate to the matched Earth shock (positive = late); null if none. */
export function forecastErrorMinutes(days: ScenarioDay[], estShockArrivalEarth: string): number | null {
  const actual = matchShock(days, estShockArrivalEarth);
  return actual === null ? null : Math.round((ms(actual) - ms(estShockArrivalEarth)) / 60000);
}

export function formatHoursMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  return `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, '0')} min`;
}

/** Hours between the child's guess and the shock matched to the forecast they guessed about; null if none. */
export function guessErrorHours(state: MissionState): number | null {
  const g = state.forecastGuess;
  if (!g) return null;
  const est = state.days.flatMap((d) => d.forecasts).find((f) => f.simulationId === g.simulationId)?.estShockArrivalEarth;
  if (!est) return null;
  const actual = matchShock(state.days, est);
  return actual === null ? null : Math.abs(ms(g.guessedArrival) - ms(actual)) / 3_600_000;
}
export interface MissionSummary {
  outcome: Outcome | null;
  daysPlayed: number;
  totalSparkles: number;
  samples: number;
  resupplies: number;
  daysSheltered: number;
  forecastErrors: { simulationId: string; errorMinutes: number | null }[];
}

export function summary(state: MissionState): MissionSummary {
  const played = state.days.slice(0, state.results.length);
  return {
    outcome: state.outcome,
    daysPlayed: state.results.length,
    totalSparkles: state.jar,
    samples: state.samples,
    resupplies: state.resupplies,
    daysSheltered: state.daysSheltered,
    forecastErrors: played.flatMap((d) =>
      d.forecasts.map((f) => ({
        simulationId: f.simulationId,
        errorMinutes: f.estShockArrivalEarth ? forecastErrorMinutes(state.days, f.estShockArrivalEarth) : null,
      })),
    ),
  };
}
