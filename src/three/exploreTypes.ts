// Public contract of the explorable Moon (MoonScene props + camera api). Pure types, no three.js imports.
import type { BadgeId } from '../game/explore/explore';
import type { Poi } from '../game/explore/pois';

export type CameraMode = 'iso' | 'orbit';

export type CelebrateKind = 'discover' | 'build' | 'ice' | 'day';
export type BuildKind = 'solarTower' | 'batteryUnit' | 'greenhouse';

export interface ExploreEvent {
  /**
   * arrive / discover / home / budgetSpent (legacy budget mode only), plus (persistent mode, `walkEnergy` prop):
   * 'spend' = 1 energy was just charged (`energy` = 1), 'ice' = first time today in a permanently shadowed cell / at an ice place,
   * 'noEnergy' = a walk was refused or stopped because walkEnergy is 0.
   */
  type: 'arrive' | 'discover' | 'budgetSpent' | 'home' | 'spend' | 'ice' | 'noEnergy';
  /** only for 'spend': energy units charged (always 1) */
  energy?: number;
  /** only for 'discover' */
  poiId?: string;
  /** metres walked away from base this outing */
  walkedM: number;
  energyLeft: number;
}

export interface ExploreSnapshot {
  /** 'out' = on the surface (standing or walking), 'returning' = walking back to base, 'home' = outing finished */
  phase: 'out' | 'returning' | 'home';
  moving: boolean;
  budget: number;
  energyLeft: number;
  walkedM: number;
  /** metres the commander may still walk away from base */
  rangeLeftM: number;
  /** commander position, world metres */
  pos: [number, number];
  pois: Poi[];
  /** ids found so far (all outings, saved on the device) */
  discovered: string[];
  /** ids found during the current outing */
  discoveredNow: string[];
  /** science points: all outings / this outing */
  science: number;
  scienceNow: number;
  badges: BadgeId[];
  /** share of the area around base that has been revealed, 0..1 */
  exploredFraction: number;
  /** nearest not-yet-found point of interest (what Pati points at) */
  nearestUndiscovered: string | null;
  /** commander is within the base zone (80 m beyond the habitat footprint) */
  nearBase: boolean;
}

/** Imperative explore controls; MoonScene exposes them on its camApi ref. */
export interface ExploreApi {
  walkTo(target: [number, number]): void;
  goHome(): void;
  /** start a fresh outing at base with this energy (default: the exploreBudget prop) */
  startOuting(budget?: number): void;
  setPatiTalking(on: boolean): void;
  /** one short success moment: star burst at the commander (1 s) + Pati hops. Use once per success. */
  celebrate(kind: CelebrateKind): void;
  getState(): ExploreSnapshot;
}

/** Shared between MoonScene (writes mode), ExploreLayer (writes follow) and CameraRig (reads both). */
export interface CamRuntime {
  mode: CameraMode;
  /** world x,z the iso camera follows; null = stay where it is */
  follow: { x: number; z: number } | null;
  /** iso rotation in 90 degree steps (any integer, 0 = default yaw) */
  yawStep: number;
  /** auto-framing: look at x,z from this distance instead of following the commander. Cleared when the child zooms or the commander walks. */
  fit: { x: number; z: number; dist: number } | null;
  /** performance.now() of the child's last manual zoom (pinch / wheel / buttons); 0 = never */
  userZoomAt: number;
}


