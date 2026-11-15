import { readFileSync } from 'node:fs';
import { buildSlots, computeSlotStats } from '../../../three/slots';
import type { Slot, SlotStats, TerrainData } from '../../../three/types';

const dir = (f: string) => new URL(`../../../../public/terrain/connecting-ridge/${f}`, import.meta.url);

/** Reads the real Connecting Ridge files and returns per-slot stats for every buildable slot. */
export function loadRealSlots(): { slot: Slot; stats: SlotStats }[] {
  const meta = JSON.parse(new TextDecoder().decode(readFileSync(dir('meta.json')))) as TerrainData['meta'];
  const n = meta.size;
  const buf = (f: string) => {
    const u = readFileSync(dir(f));
    return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
  };
  const lit = new Uint8Array(buf(meta.files.lit));
  const data = {
    meta,
    n,
    height: new Float32Array(buf(meta.files.height)),
    illum: new Uint8Array(buf(meta.files.illum)),
    psr: new Uint8Array(buf(meta.files.psr)),
    lit,
    dayCount: lit.length / (n * n),
    sun: [],
    earth: [],
    placeholder: false,
    warnings: [],
  } as TerrainData;
  return buildSlots(data)
    .filter((s) => s.buildable)
    .map((slot) => ({ slot, stats: computeSlotStats(data, slot) }));
}
