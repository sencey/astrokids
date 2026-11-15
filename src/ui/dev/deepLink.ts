// Dev-only QA deep links. Ignored in production builds.
//   #play=captain|playmate  -> straight into day 1
//   #ending=captain|playmate -> ending with a deterministic simulated run
//   #grownups (past the gate) | #sky
import { applyDay, currentDay, isFinished, startMission } from '../../game/mission';
import { getConfig } from '../../game/rules';
import type { MissionState, Mode } from '../../game/types';
import { scenario } from '../data/loadScenario';

export type DeepScreen = 'day' | 'ending' | 'grownups' | 'sky';
export interface DeepLink {
  screen: DeepScreen;
  mode: Mode;
  final?: MissionState;
}

const asMode = (v: string | undefined): Mode => (v === 'captain' ? 'captain' : 'playmate');

/** Shelter on storm/super days, wall 3 on day 1 (as far as the ball budget allows), tend the tanks otherwise. */
export function simulateRun(mode: Mode): MissionState {
  const cfg = getConfig(mode);
  let m = startMission(scenario, mode);
  let first = true;
  while (!isFinished(m)) {
    const d = currentDay(m)!;
    const wall = first ? Math.min(3, cfg.ballsPerDay - 1, cfg.wallMax - m.wall) : 0;
    const rest = cfg.ballsPerDay - wall;
    const water = Math.min(1, rest);
    const garden = Math.min(rest - water, 1);
    m = applyDay(m, {
      balls: { water, garden, wall },
      location: d.sparkleBand === 'calm' ? 'outside' : 'inside',
      alarmTappedInTime: true,
    }).nextState;
    first = false;
  }
  return m;
}

export function parseDeepLink(): DeepLink | null {
  if (!import.meta.env.DEV) return null;
  const hash = window.location.hash.replace(/^#/, '');
  const [key, val] = hash.split('=');
  switch (key) {
    case 'play':
      return { screen: 'day', mode: asMode(val) };
    case 'ending': {
      const mode = asMode(val);
      return { screen: 'ending', mode, final: simulateRun(mode) };
    }
    case 'grownups':
      return { screen: 'grownups', mode: 'playmate' };
    case 'sky':
      return { screen: 'sky', mode: asMode(val) };
    default:
      return null;
  }
}
