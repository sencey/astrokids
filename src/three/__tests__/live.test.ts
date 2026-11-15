import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstSentence, liveStatus, newestEarthCME } from '../live/latest';
import type { LatestJson } from '../live/latest';
import { computeToday } from '../live/today';
import { buildSlots, computeSlotStats } from '../slots';
import type { TerrainData } from '../types';

const dir = (f: string) => new URL(`../../../public/terrain/connecting-ridge/${f}`, import.meta.url);
const bytes = (f: string) => {
  const u = readFileSync(dir(f));
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
};
const meta = JSON.parse(new TextDecoder().decode(readFileSync(dir('meta.json')))) as TerrainData['meta'];
const n = meta.size;
const lit = new Uint8Array(bytes(meta.files.lit));
const data = {
  meta, n, height: new Float32Array(bytes(meta.files.height)), illum: new Uint8Array(bytes(meta.files.illum)), psr: new Uint8Array(bytes(meta.files.psr)),
  lit, dayCount: lit.length / (n * n), sun: [], earth: [], placeholder: false, warnings: [],
} as TerrainData;
const sunJson = JSON.parse(new TextDecoder().decode(readFileSync(dir('sun-may-2024.json')))) as { days: Record<string, { azDeg: number; elDeg: number }[]> };

describe('today (astronomy-engine) matches the pipeline', () => {
  it('Sun az/el at the site centre equals sun-may-2024.json', async () => {
    const t = await computeToday(data, [], new Date('2024-05-10T12:00:00Z'));
    const ref = sunJson.days['2024-05-10'][12];
    expect(Math.abs(t.sun.hours[12].elDeg - ref.elDeg)).toBeLessThan(0.05);
    const dAz = Math.abs(((t.sun.hours[12].azDeg - ref.azDeg + 540) % 360) - 180);
    expect(dAz).toBeLessThan(0.1);
  });
  it('per-slot lit % is close to the pipeline (18 km horizon only)', async () => {
    const slots = buildSlots(data).filter((s) => s.buildable);
    const sample = slots.filter((_, i) => i % 6 === 0).slice(0, 8);
    const t = await computeToday(data, sample, new Date('2024-05-10T12:00:00Z'));
    let sum = 0;
    for (const s of sample) {
      const ref = computeSlotStats(data, s).litPctByDay[2];
      sum += Math.abs(t.litBySlot.get(s.index)! - ref);
    }
    expect(sum / sample.length).toBeLessThan(15);
  });
});

describe('live status honesty', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const base: LatestJson = {
    generatedAt: '2026-11-14T11:01:15Z',
    provenance: [{ sourceId: 'a', fetchedAt: '2026-11-14T11:01:07Z', isLive: true }],
    flares: [{ peakTime: '2026-11-11T21:21Z' }],
    sep: [],
  };
  it('live only when fresh, live and an event within 7 days', () => {
    expect(liveStatus(base, now).state).toBe('live');
    expect(liveStatus({ ...base, provenance: [{ ...base.provenance[0], fetchedAt: '2026-11-12T00:00:00Z' }] }, now).state).toBe('stale');
    expect(liveStatus({ ...base, provenance: [{ ...base.provenance[0], isLive: false }] }, now).state).toBe('stale');
    expect(liveStatus({ ...base, flares: [{ peakTime: '2026-10-01T00:00Z' }] }, now).state).toBe('stale');
    expect(liveStatus(null, now).state).toBe('offline');
  });
  it('first sentence and Earth CME pick', () => {
    expect(firstSentence('C-type CME detected by SOHO. Start time: 2026.')).toBe('C-type CME detected by SOHO.');
    const l: LatestJson = { ...base, cmes: [{ activityId: 'a', startTime: '2026-11-10T00:00Z', enlil: { estShockArrivalEarth: '2026-11-13T00:00Z' } }, { activityId: 'b', startTime: '2026-11-12T00:00Z', enlil: { estShockArrivalEarth: null } }] };
    expect(newestEarthCME(l)?.activityId).toBe('a');
  });
});
