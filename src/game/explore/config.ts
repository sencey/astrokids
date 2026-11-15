// Tuning knobs for the explorable Moon (world units are real metres on the NASA height map unless noted).
export const EXPLORE = {
  /** The commander's real walking speed in the story. */
  walkMps: 4,
  /** Playback speed-up: the world is 18 km wide, so a 4 m/s walk is shown 8x faster (about 32 m/s on screen). Distances and energy use real metres. */
  timeScale: 8,
  /** Straight-line walks stop before ground steeper than this. */
  slopeLimitDeg: 25,
  /** 1 energy per started block (outward walk only; the way home is free) of this many metres. */
  metersPerEnergy: 1000,
  /** A point of interest is discovered when the commander is this close. */
  discoverRadiusM: 40,
  /** A ground tap this close to an undiscovered point of interest walks to it exactly. */
  snapRadiusM: 150,
  /** Fog-of-war mask is maskN x maskN cells over the whole map. */
  maskN: 64,
  /** Radius revealed around the commander's path. */
  revealRadiusM: 800,
  /** Radius revealed around the landing site at the start. */
  startRevealM: 1000,
  /** "Explored %" is counted inside this disc around the landing site (the area an outing can reach). */
  playRadiusM: 4000,
  /** Fraction of the play disc that earns the explorer badge. */
  explorerFraction: 0.5,
  /** Brightness of unexplored ground (1 = unchanged). */
  fogDim: 0.42,
  /** Commander and Pati are drawn this many times bigger than life so they read from the iso camera. */
  avatarScale: 30,
  /** Pati keeps about this distance (in avatar-metres, times avatarScale) behind the commander. */
  petFollowM: 3,
  /** Seconds of standing still before Pati points at the nearest undiscovered point of interest / sits down. */
  idlePointS: 4,
  idleSitS: 15,
  /** Points of interest are only placed where a walk from the landing site (over ground not steeper than the limit) is at most this long. */
  maxPoiWalkM: 6000,
  minPoiSpacingM: 700,
  storageKey: 'astrakids.explore.v1',
} as const;

