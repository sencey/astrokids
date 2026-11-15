// Global film timeline + tiny math helpers. Everything in the film is a pure function of t (seconds).
export const FPS = 30;
export const DURATION = 26.5;

/** Scene boundaries (film seconds). Voice-over starts at 0.3 s; cuts sit on its phrase gaps. */
export const T = {
  s1: 0,
  s2: 3.0,
  s3: 8.2,
  s4: 10.3,
  s5: 13.6,
  s6: 16.8,
  s7: 20.6,
  s8: 22.5,
  end: DURATION,
} as const;

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
/** 0..1 progress of t between a and b. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const smooth = (x: number): number => x * x * (3 - 2 * x);
export const smoother = (x: number): number => x * x * x * (x * (x * 6 - 15) + 10);
export const easeInOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number): number => x * x * x;
export const easeOutBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
/** Triangular pulse: 0 at a, 1 at b, 0 at c. */
export const tri = (t: number, a: number, b: number, c: number): number => (t < b ? smooth(seg(t, a, b)) : 1 - smooth(seg(t, b, c)));

/** Deterministic pseudo random in [0,1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type V3 = [number, number, number];
export interface Key {
  t: number;
  p: V3;
  l: V3;
  fov?: number;
  /** blend weight toward a (0,0,1) camera-up (for looking straight along the polar axis) */
  up?: number;
}

function hermite(p0: number, p1: number, m0: number, m1: number, s: number, h: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * h * m1;
}

/** C1-smooth (Catmull-Rom style) scalar track through keys; flat tangents at both ends = eased start/stop. */
function track(keys: Key[], pick: (k: Key) => number, t: number): number {
  const n = keys.length;
  if (t <= keys[0].t) return pick(keys[0]);
  if (t >= keys[n - 1].t) return pick(keys[n - 1]);
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const h = b.t - a.t;
  const tan = (j: number): number => {
    if (j <= 0 || j >= n - 1) return 0;
    return (pick(keys[j + 1]) - pick(keys[j - 1])) / (keys[j + 1].t - keys[j - 1].t);
  };
  return hermite(pick(a), pick(b), tan(i), tan(i + 1), (t - a.t) / h, h);
}

export interface CamSample {
  p: V3;
  l: V3;
  fov: number;
  up: number;
}
export function sampleCam(keys: Key[], t: number, defFov = 40): CamSample {
  const f = (k: Key): number => k.fov ?? defFov;
  const u = (k: Key): number => k.up ?? 0;
  return {
    p: [track(keys, (k) => k.p[0], t), track(keys, (k) => k.p[1], t), track(keys, (k) => k.p[2], t)],
    l: [track(keys, (k) => k.l[0], t), track(keys, (k) => k.l[1], t), track(keys, (k) => k.l[2], t)],
    fov: track(keys, f, t),
    up: track(keys, u, t),
  };
}
