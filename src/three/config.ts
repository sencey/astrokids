import { useSyncExternalStore } from 'react';

// Tuning knobs for the 3D scene. Change here, not in components.
export const CONFIG = {
  /** Vertical exaggeration so the ridge reads for kids. */
  verticalExaggeration: 1,
  slotsPerSide: 16,
  /** Slots steeper than this (mean gradient, degrees) cannot be built on. */
  maxSlopeDeg: 10,
  /** Direct sunlight. Grazing polar light is weak on flat ground; slopes facing the Sun must still read light grey, not white. */
  sunIntensity: 9,
  /** Cool, nearly neutral "earthshine" fill (about 0.06 of the Sun) so shadowed ground reads dark blue-grey. The HUD "Real light" toggle turns it off. */
  fillIntensity: 0.55,
  fillSky: "#9aa3b5",
  fillGround: "#2a2d33",
  toneMappingExposure: 0.95,
  shadowBias: -0.002,
  // shadow map size / DPR cap / mesh resolution live in TIERS below
  /** Real-time length of one lunar-day time-lapse (a "day" is 24 h of the data). */
  secondsPerDayPlay: 10,
  /** Buildings are drawn this many times bigger than 1 m so they read from the orbit camera.
   *  Expressed as the fraction of a slot edge that a nominal 8 m habitat occupies. */
  habitatSlotFraction: 0.42,
  introSeconds: 11,
  /** Low-end phones: no dust puffs, no fog fade animation. Auto-detected; force with ?lowpower=1 (or =0) in the URL. */
  lowPower: detectLowPower(),
  /** Isometric explore camera: fixed yaw/pitch, narrow-FOV perspective (looks orthographic), distances in metres from the commander. */
  iso: { yawDeg: 45, pitchDeg: 35, fov: 24, near: 30, dist: 1000, minDist: 400, maxDist: 7000 },
} as const;

// ---- Quality tiers (the one place that decides how much work the GPU does) ----
export type Tier = 'low' | 'medium' | 'high';
export interface TierSpec {
  /** upper bound for devicePixelRatio */
  dpr: number;
  /** directional-light shadow map edge in px */
  shadow: number;
  /** terrain mesh decimation: 1 = every height cell, 2 = every other (256 -> 128). Gameplay data is never decimated. */
  terrainStep: number;
  /** footstep dust, fog fade easing, beacon pulse */
  fx: boolean;
  /** background stars */
  stars: number;
}
export const TIERS: Record<Tier, TierSpec> = {
  low: { dpr: 1, shadow: 1024, terrainStep: 2, fx: false, stars: 800 },
  medium: { dpr: 1.25, shadow: 1536, terrainStep: 1, fx: true, stars: 1800 },
  high: { dpr: 1.5, shadow: 2048, terrainStep: 1, fx: true, stars: 2500 },
};
const ORDER: Tier[] = ['high', 'medium', 'low'];

function forcedTier(): Tier | null {
  try {
    if (typeof window === 'undefined') return null;
    const q = new URLSearchParams(window.location.search).get('tier');
    return q === 'low' || q === 'medium' || q === 'high' ? q : null;
  } catch {
    return null;
  }
}
function detectTier(): Tier {
  const f = forcedTier();
  if (f) return f;
  if (CONFIG.lowPower) return 'low';
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return 'medium';
  } catch {
    /* ignore */
  }
  return 'high';
}

let tier: Tier = detectTier();
const subs = new Set<() => void>();
export const getTier = (): Tier => tier;
export const getTierSpec = (): TierSpec => TIERS[tier];
export const isLowTier = (): boolean => tier === 'low';
export const subscribeTier = (fn: () => void): (() => void) => {
  subs.add(fn);
  return () => void subs.delete(fn);
};
/** Adaptive fallback: one step down (high -> medium -> low). Returns false when already at the bottom or the tier was forced with ?tier=. */
export function stepDownTier(): boolean {
  if (forcedTier()) return false;
  const i = ORDER.indexOf(tier);
  if (i >= ORDER.length - 1) return false;
  tier = ORDER[i + 1];
  subs.forEach((f) => f());
  return true;
}
/** React hook: re-renders when the tier changes. */
export function useTier(): TierSpec & { name: Tier } {
  const name = useSyncExternalStore(subscribeTier, getTier, getTier);
  return { ...TIERS[name], name };
}

function detectLowPower(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const q = new URLSearchParams(window.location.search).get('lowpower');
    if (q === '1') return true;
    if (q === '0') return false;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
    return (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) || (coarse && (nav.hardwareConcurrency ?? 8) <= 4);
  } catch {
    return false;
  }
}

