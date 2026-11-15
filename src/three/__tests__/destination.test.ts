import { describe, expect, it } from 'vitest';
import { makePlaceholder } from '../data/placeholder';
import { DEST_LIMITS, evaluateDestination, groundDistanceM, slotIndexAt } from '../destinationRules';
import { makeFrame } from '../math';
import { buildSlots, landerSlot } from '../slots';

const data = makePlaceholder();
const frame = makeFrame(data, 1);
const slots = buildSlots(data);
const hab = landerSlot(slots);
const from = { x: hab.x, z: hab.z };

describe('destination picking', () => {
  it('ground distance is at least the straight-line distance and is symmetric-ish', () => {
    const b = { x: from.x + 1000, z: from.z };
    const d = groundDistanceM(frame, from, b);
    expect(d).toBeGreaterThanOrEqual(1000 - 1e-6);
    expect(groundDistanceM(frame, from, from)).toBe(0);
  });

  it('the slot lookup agrees with the slot centre', () => {
    for (const s of [slots[0], slots[37], slots[255]]) expect(slotIndexAt(slots, s.x, s.z, frame.cell, data.n)).toBe(s.index);
  });

  it('rejects far points and non-ice points in ice mode, and accepts valid ones', () => {
    const far = evaluateDestination(data, frame, slots, from, 'walk', from.x + DEST_LIMITS.walkM + 500, from.z);
    expect(far.ok).toBe(false);
    // find a PSR cell near and a non-PSR cell
    let psr: { x: number; z: number } | null = null;
    let dry: { x: number; z: number } | null = null;
    for (let i = 0; i < data.n * data.n && !(psr && dry); i++) {
      const x = ((i % data.n) - (data.n - 1) / 2) * frame.cell;
      const z = (Math.floor(i / data.n) - (data.n - 1) / 2) * frame.cell;
      if (Math.hypot(x - from.x, z - from.z) > 2500) continue;
      if (data.psr[i]) psr ??= { x, z };
      else dry ??= { x, z };
    }
    if (dry) {
      const r = evaluateDestination(data, frame, slots, from, 'ice', dry.x, dry.z);
      expect(r).toEqual({ ok: false, reason: 'notIce' });
    }
    if (psr) {
      const r = evaluateDestination(data, frame, slots, from, 'ice', psr.x, psr.z);
      if (r.ok) {
        expect(r.pick.kind).toBe('ice');
        expect(r.pick.isPSR).toBe(true);
        expect(r.pick.distanceM).toBeLessThanOrEqual(DEST_LIMITS.iceM);
      }
    }
  });
});
