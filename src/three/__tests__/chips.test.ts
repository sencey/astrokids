import { describe, expect, it } from 'vitest';
import { chipName, formatKm, placeChip, safeBlocks, safeInsets } from '../edgeChips';

describe('edge chips', () => {
  it('formats the distance with a decimal comma in Turkish', () => {
    expect(formatKm(800, 'tr')).toBe('0,8 km');
    expect(formatKm(800, 'en')).toBe('0.8 km');
    expect(formatKm(1949, 'tr')).toBe('1,9 km');
  });
  it('uses the portrait insets (120 top, 110 bottom, 70 right)', () => {
    expect(safeInsets(390, 844)).toMatchObject({ top: 120, bottom: 110, right: 70 });
  });
  it('shows no chip for a place that is on screen', () => {
    expect(placeChip(200, 400, 390, 844, safeInsets(390, 844))).toBeNull();
  });
  it('clamps off-screen places inside the safe rectangle, toward the place', () => {
    const w = 390;
    const h = 844;
    const ins = safeInsets(w, h);
    for (const [px, py] of [[900, 400], [-300, 400], [200, -900], [200, 2000], [900, 2000], [-50, -50]]) {
      const c = placeChip(px, py, w, h, ins)!;
      expect(c.x).toBeLessThanOrEqual(w - ins.right);
      expect(c.x).toBeGreaterThanOrEqual(ins.left);
      expect(c.y).toBeGreaterThanOrEqual(ins.top);
      expect(c.y).toBeLessThanOrEqual(h - ins.bottom);
    }
    // a place far to the right keeps the arrow pointing right (90 degrees)
    expect(placeChip(2000, 422, w, h, ins)!.deg).toBeCloseTo(90, 0);
    // a place straight up: arrow up (0 degrees)
    expect(Math.abs(placeChip(195, -3000, w, h, ins)!.deg)).toBeLessThan(5);
  });
  it('has an accessible name in both languages', () => {
    const poi = { nameTr: 'Buz krateri', nameEn: 'Ice crater' };
    expect(chipName(poi, '3,2 km', 'tr')).toBe('Buz krateri, 3,2 km: oraya yürü');
    expect(chipName(poi, '3.2 km', 'en')).toBe('Ice crater, 3.2 km: walk there');
  });
  it('keeps chips off the bottom-left gear block on landscape', () => {
    const w = 844;
    const h = 390;
    const ins = safeInsets(w, h);
    const blocks = safeBlocks(w, h);
    expect(blocks).toHaveLength(1);
    expect(safeBlocks(390, 844)).toHaveLength(0);
    // places far to the left / below-left would otherwise land on the block
    for (const [px, py] of [[-500, 400], [-300, 900], [60, 2000], [-2000, 2000]]) {
      const c = placeChip(px, py, w, h, ins, blocks)!;
      const b = blocks[0];
      const overlaps = c.x + 24 > b.x0 && c.x - 24 < b.x1 && c.y + 40 > b.y0 && c.y - 24 < b.y1;
      expect(overlaps).toBe(false);
      expect(c.x).toBeGreaterThanOrEqual(ins.left + 24);
      expect(c.y).toBeLessThanOrEqual(h - ins.bottom - 40);
    }
  });
});

