import { describe, expect, it } from 'vitest';
import { angleDiff, approach, hopArc, trotSwing } from '../models/patiGait';

describe('patiGait', () => {
  it('moves diagonal leg pairs together', () => {
    const [fl, fr, bl, br] = trotSwing(1.1, 0.5);
    expect(fl).toBeCloseTo(br);
    expect(fr).toBeCloseTo(bl);
    expect(fl).toBeCloseTo(-fr);
  });
  it('takes the short way round', () => {
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDiff(0, 1)).toBeCloseTo(1);
  });
  it('approaches without overshooting and keeps the hop in 0..1', () => {
    expect(approach(0, 10, 100, 1)).toBe(10);
    expect(approach(0, 10, 1, 0.1)).toBeCloseTo(1);
    for (let p = 0; p < 7; p += 0.3) expect(hopArc(p)).toBeGreaterThanOrEqual(0), expect(hopArc(p)).toBeLessThanOrEqual(1);
  });
});
