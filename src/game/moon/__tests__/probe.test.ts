import { expect, it } from 'vitest';
import { loadRealSlots } from './realTerrain';

it('real Connecting Ridge slots have 15 sunlight days each', () => {
  const s = loadRealSlots();
  expect(s.length).toBeGreaterThan(10);
  expect(s.every((x) => x.stats.litPctByDay.length >= 15)).toBe(true);
});
