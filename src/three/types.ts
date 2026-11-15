// Shared types for the 3D Moon base. Data contract: public/terrain/connecting-ridge/*
export interface HourSample {
  t: number | string;
  azDeg: number;
  elDeg: number;
}
export interface DaySeries {
  date: string;
  hours: HourSample[];
}
export interface TerrainSource {
  sourceId: string;
  sourceUrl: string;
  fetchedAt: string;
  isLive: boolean;
  citation: string;
}
export interface TerrainMeta {
  siteId: string;
  nameTr: string;
  nameEn: string;
  size: number;
  cellMeters: number;
  minElevM: number;
  maxElevM: number;
  referenceRadiusM: number;
  gridNorthNote: string;
  files: { height: string; illum: string; psr: string; lit: string };
  days: string[];
  sources: TerrainSource[];
  placeholder?: boolean;
  /** Cell-centre coords of the geographic south pole; may lie outside the grid. */
  poleGridPosition?: { col: number; row: number };
}
export interface TerrainData {
  meta: TerrainMeta;
  n: number;
  height: Float32Array; // metres, row-major, row 0 = north (top)
  illum: Uint8Array; // % average illumination
  psr: Uint8Array; // 1 = permanently shadowed
  lit: Uint8Array; // D x N x N, % of day sunlit
  dayCount: number;
  sun: DaySeries[];
  earth: DaySeries[];
  placeholder: boolean;
  warnings: string[];
}

export type BuildingId = 'habitat' | 'solarTower' | 'greenhouse' | 'rover' | 'antenna' | 'lander' | 'batteryUnit';
export type ModelId = BuildingId | 'astronaut' | 'pati';
export const PLACEABLE: BuildingId[] = ['habitat', 'solarTower', 'greenhouse', 'rover', 'antenna', 'batteryUnit'];

export interface Slot {
  index: number;
  ix: number; // 0..15 west->east
  iy: number; // 0..15 north->south
  c0: number; // first map column
  r0: number; // first map row
  cells: number; // slot edge in map cells
  x: number; // world metres (east +)
  z: number; // world metres (south +; grid north = -z)
  slopeDeg: number;
  buildable: boolean; // slope below threshold
}
export interface SlotStats {
  illumPct: number;
  litPctByDay: number[];
  isPSR: boolean;
  slopeDeg: number;
  distanceToNearestPSRm: number;
}
export interface PlacedBuilding {
  id: BuildingId;
  slotIndex: number;
}
export interface TerrainFrame {
  n: number;
  cell: number;
  extent: number;
  exag: number;
  baseH: number;
  /** world Y (exaggerated, centred on mean elevation) at world x,z */
  groundY(x: number, z: number): number;
}

