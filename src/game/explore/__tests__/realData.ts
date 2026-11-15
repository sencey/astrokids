import { readFileSync } from 'node:fs';
import { buildSlots, computeSlotStats, landerSlot } from '../../../three/slots';
import type { DaySeries, TerrainData } from '../../../three/types';

const dir = (f: string) => new URL(`../../../../public/terrain/connecting-ridge/${f}`, import.meta.url);

/** The real Connecting Ridge grids plus the landing site the game picks (same rule as ui3d/Game.tsx). */
export function loadReal(): { data: TerrainData; home: { x: number; z: number } } {
  const meta = JSON.parse(new TextDecoder().decode(readFileSync(dir('meta.json')))) as TerrainData['meta'];
  const n = meta.size;
  const buf = (f: string) => {
    const u = readFileSync(dir(f));
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
  };
  const lit = new Uint8Array(buf(meta.files.lit));
  const ej = JSON.parse(new TextDecoder().decode(readFileSync(dir('earth-may-2024.json')))) as { days: Record<string, DaySeries['hours']> };
  const earth: DaySeries[] = meta.days.map((date) => ({ date, hours: ej.days[date] }));
  const data = {
    meta,
    n,
    height: new Float32Array(buf(meta.files.height)),
    illum: new Uint8Array(buf(meta.files.illum)),
    psr: new Uint8Array(buf(meta.files.psr)),
    lit,
    dayCount: lit.length / (n * n),
    sun: [],
    earth,
    placeholder: false,
    warnings: [],
  } as TerrainData;
  const slots = buildSlots(data);
  const lander = landerSlot(slots, (s) => (s.buildable ? computeSlotStats(data, s).illumPct : -1));
  return { data, home: { x: lander.x, z: lander.z } };
}
