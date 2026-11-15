// Pure helpers for the 3D Pati gait (no three / React): tested in __tests__/patiGait.test.ts.

export const TAU = Math.PI * 2;

/** Shortest signed angle from a to b, in (-PI, PI]. */
export const angleDiff = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/** Frame-rate independent exponential approach (rate in 1/s). */
export const approach = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * Math.min(1, rate * dt);

/** Leg swing angles [frontLeft, frontRight, backLeft, backRight] for a trot: diagonal pairs move together (FL+BR vs FR+BL). */
export function trotSwing(phase: number, amp: number): [number, number, number, number] {
  const a = Math.sin(phase) * amp;
  return [a, -a, -a, a];
}

/** Low-gravity hop height 0..1 for one stride phase: two soft arcs per cycle, flatter at the top than |sin|. */
export function hopArc(phase: number): number {
  return Math.pow(Math.abs(Math.sin(phase)), 0.75);
}
