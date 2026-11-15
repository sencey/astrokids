import { planCosts } from '../../game/moon';
import type { MoonPlan, MoonState } from '../../game/moon';

/** A destination the child picked on the map (from the 3D scene). */
export interface DestPick {
  slotIndex: number;
  point: [number, number, number];
  isPSR: boolean;
  distanceM: number;
  kind: 'rim' | 'ice';
}
export type DestMode = 'walk' | 'ice';

/** Ground distance as a short string: 640 m, 1.4 km (comma decimal in Turkish). */
export const fmtDist = (m: number, lang: string): string =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;

/**
 * Make a plan affordable (and valid) by dropping actions in this order:
 * walk, ice trip, greenhouse, shield, keep running. Not paying "keep running" is a legitimate, costly
 * choice (life support -3), so it goes last. Returns the plan and what was dropped.
 */
export function trimPlan(state: MoonState, plan: MoonPlan): { plan: MoonPlan; dropped: string[] } {
  let p = { ...plan };
  const dropped: string[] = [];
  const steps: [string, (x: MoonPlan) => boolean, (x: MoonPlan) => MoonPlan][] = [
    ['walk', (x) => x.scienceWalk !== null, (x) => ({ ...x, scienceWalk: null, walkTargetDistanceM: undefined, recalledInTime: false })],
    ['ice', (x) => x.iceTrip, (x) => ({ ...x, iceTrip: false, iceTargetDistanceM: undefined })],
    ['greenhouse', (x) => x.greenhouse, (x) => ({ ...x, greenhouse: false })],
    ['shield', (x) => x.shield, (x) => ({ ...x, shield: false })],
    ['running', (x) => x.keepRunning, (x) => ({ ...x, keepRunning: false })],
  ];
  for (const [name, has, drop] of steps) {
    if (planCosts(state, p).affordable) break;
    if (has(p)) {
      p = drop(p);
      dropped.push(name);
    }
  }
  return { plan: p, dropped };
}
