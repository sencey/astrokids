/** Pure rules of the exploration-first flow (no React): goals, the one primary button, the storm timing. */
import { missionForDay, worldMission } from '../../game/moon';
import type { AlarmOutcome, MoonState, WorldMission, WorldMissionId } from '../../game/moon';

export type AlarmPhase = 'none' | 'active' | 'safe' | 'late' | 'outside';
export type WorldBuild = 'solarTower' | 'batteryUnit' | 'greenhouse';

/** Seconds the child has to reach the base once the storm alarm rings. */
export const ALARM_SAFE_S = 20;
/** The alarm rings after this many seconds of play at the latest. */
export const ALARM_AFTER_S = 60;
/** ... or once this share of the day's walking energy is spent. */
export const ALARM_WALK_SHARE = 0.4;

/** The goals of a day: the day's missions, then always "go home, end the day" last. */
export function dayGoals(state: MoonState, dayIndex: number): WorldMission[] {
  const list = missionForDay(state, dayIndex).filter((m) => m.id !== 'endDay');
  return [...list, worldMission('endDay')];
}

/** First goal not done yet (the last one, endDay, when everything else is). */
export function currentGoal(goals: readonly WorldMission[], done: ReadonlySet<string>): WorldMission {
  return goals.find((g) => g.id !== 'endDay' && !done.has(g.id)) ?? goals[goals.length - 1];
}

/** Should the storm alarm ring now? */
export function alarmDue(a: { hasAlarm: boolean; fired: boolean; walkSpent: number; walkBudget: number; playSeconds: number }): boolean {
  if (!a.hasAlarm || a.fired) return false;
  if (a.playSeconds >= ALARM_AFTER_S) return true;
  return a.walkBudget > 0 && a.walkSpent >= a.walkBudget * ALARM_WALK_SHARE;
}

/** Outcome of the alarm when the commander reaches the base `sinceMs` after it rang. */
export function arrivalOutcome(sinceMs: number): 'safe' | 'late' {
  return sinceMs <= ALARM_SAFE_S * 1000 ? 'safe' : 'late';
}

export const toEngineAlarm = (p: AlarmPhase): AlarmOutcome => (p === 'active' ? 'outside' : p);

export type PrimaryKind = 'none' | 'build' | 'cancelBuild' | 'shield' | 'home' | 'homeDanger' | 'runHome' | 'endDay';
export interface Primary {
  kind: PrimaryKind;
  build?: WorldBuild;
  /** shown but not tappable */
  disabled?: boolean;
  /** kid-words reason shown next to a disabled button */
  reason?: 'needEnergy' | 'atBaseOnly';
}

export interface PrimaryCtx {
  goal: WorldMissionId;
  nearBase: boolean;
  alarm: AlarmPhase;
  buildMode: WorldBuild | null;
  alertOngoing: boolean;
  /** the commander is away from base and has walked */
  away: boolean;
  /** walking energy the child can still spend is (nearly) gone */
  lowEnergy: boolean;
  canAffordBuild: boolean;
  canAffordShield: boolean;
}

/** The ONE big button for this moment. */
export function pickPrimary(c: PrimaryCtx): Primary {
  if (c.alarm === 'active') return c.nearBase ? { kind: 'none' } : { kind: 'runHome' };
  if (c.buildMode) return { kind: 'cancelBuild' };
  if (c.alertOngoing && !c.nearBase && c.away) return { kind: 'homeDanger' };
  switch (c.goal) {
    case 'buildTower':
      return { kind: 'build', build: 'solarTower', disabled: !c.canAffordBuild, reason: c.canAffordBuild ? undefined : 'needEnergy' };
    case 'buildBattery':
      return { kind: 'build', build: 'batteryUnit', disabled: !c.canAffordBuild, reason: c.canAffordBuild ? undefined : 'needEnergy' };
    case 'shieldUp':
      if (!c.nearBase) return { kind: 'home' };
      return { kind: 'shield', disabled: !c.canAffordShield, reason: c.canAffordShield ? undefined : 'needEnergy' };
    case 'endDay':
    case 'saveEnergy':
      return c.nearBase ? { kind: 'endDay' } : c.lowEnergy || c.goal === 'endDay' ? { kind: 'home' } : { kind: 'none' };
    default:
      return c.lowEnergy && !c.nearBase ? { kind: 'home' } : { kind: 'none' };
  }
}
