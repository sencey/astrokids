// Live numbers for a tapped building (pure; the UI shows them in a small card).
import { batteryCap, litPct, towerEnergy } from './engine';
import { MOON_RULES as R } from './rules';
import type { MoonState } from './types';

export type LiveBuildingId = 'habitat' | 'solarTower' | 'greenhouse' | 'rover' | 'antenna' | 'lander' | 'batteryUnit';

export interface BuildingLive {
  id: LiveBuildingId;
  /** solarTower / greenhouse: percent of today the spot is sunlit */
  litPct?: number;
  /** solarTower: energy units made today */
  energy?: number;
  /** habitat: berm level 0..3 */
  berm?: number;
  /** batteryUnit: battery / capacity, 0..1 (also the number to pass as MoonScene batteryFill) */
  fill?: number;
  /** batteryUnit: units stored and capacity */
  battery?: { now: number; cap: number };
  /** greenhouse: low light today, so the grow lights cost extra energy */
  needsGrowLights?: boolean;
  /** lander / rover / antenna: no live numbers; the UI shows this text key instead */
  textKey?: 'lander' | 'rover' | 'antenna';
}

/**
 * Live stats for one building. `towerIndex` = which solar tower it is (0-based, order of setup.towers); needed for 'solarTower'.
 * Returns only the id (plus textKey for static ones) when there is no mission state yet.
 */
export function buildingLive(state: MoonState | null, id: LiveBuildingId, towerIndex = 0): BuildingLive {
  if (id === 'lander' || id === 'rover' || id === 'antenna') return { id, textKey: id };
  if (!state) return { id };
  const dayIdx = Math.max(0, Math.min(state.days.length - 1, state.cursor));
  switch (id) {
    case 'solarTower': {
      const t = state.setup.towers[towerIndex];
      return t ? { id, litPct: Math.round(litPct(t, dayIdx)), energy: towerEnergy(t, dayIdx) } : { id };
    }
    case 'habitat':
      return { id, berm: state.berm };
    case 'greenhouse': {
      const g = state.setup.greenhouse;
      if (!g) return { id };
      const lit = litPct(g, dayIdx);
      return { id, litPct: Math.round(lit), needsGrowLights: lit < R.actions.greenhouseLowLightPct.value };
    }
    case 'batteryUnit': {
      const cap = batteryCap(state.setup);
      return { id, fill: cap > 0 ? Math.max(0, Math.min(1, state.battery / cap)) : 0, battery: { now: state.battery, cap } };
    }
  }
}
