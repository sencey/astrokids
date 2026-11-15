// Exploration rules: energy, discoveries, fog-of-war mask, badges, daily missions, persistence. Pure TS (no React, no three).
import { EXPLORE } from './config';
import { isDiscoverable } from './pois';
import type { Poi, PoiKind } from './pois';

// ---------------------------------------------------------------- energy / outing

export type OutingPhase = 'out' | 'returning' | 'home';

export interface Outing {
  /** energy for this outing */
  budget: number;
  /** metres walked away from the landing site this outing (the walk home is free) */
  walkedM: number;
  phase: OutingPhase;
  /** ids found during this outing */
  found: string[];
  scienceNow: number;
}

/** Energy spent after walking this far: 1 per started 1000 m (EXPLORE.metersPerEnergy). */
export const energyUsed = (walkedM: number): number => (walkedM <= 0 ? 0 : Math.ceil(walkedM / EXPLORE.metersPerEnergy - 1e-9));
export const energyLeft = (budget: number, walkedM: number): number => Math.max(0, budget - energyUsed(walkedM));
/** Metres the commander may still walk away from base. */
export const rangeLeftM = (budget: number, walkedM: number): number => Math.max(0, budget * EXPLORE.metersPerEnergy - walkedM);
export const isSpent = (o: Pick<Outing, 'budget' | 'walkedM'>): boolean => rangeLeftM(o.budget, o.walkedM) <= 1e-6;

export function newOuting(budget: number): Outing {
  return { budget: Math.max(0, Math.floor(budget)), walkedM: 0, phase: 'out', found: [], scienceNow: 0 };
}

/** Adds walked metres (never beyond the budget). Returns the metres actually accepted. */
export function addWalk(o: Outing, dM: number): number {
  const ok = Math.max(0, Math.min(dM, rangeLeftM(o.budget, o.walkedM)));
  o.walkedM += ok;
  return ok;
}

// ---------------------------------------------------------------- discoveries

/** Points of interest within the discovery radius that are not found yet. */
export function discoverNear(pois: readonly Poi[], found: ReadonlySet<string>, x: number, z: number, radius: number = EXPLORE.discoverRadiusM): Poi[] {
  return pois.filter((p) => isDiscoverable(p) && !found.has(p.id) && Math.hypot(p.x - x, p.z - z) <= radius);
}

/** If a tap lands near an undiscovered point of interest, return that point instead (so kids need not be pixel-exact). */
export function snapToPoi(pois: readonly Poi[], found: ReadonlySet<string>, x: number, z: number, radius: number = EXPLORE.snapRadiusM): Poi | null {
  let b: Poi | null = null;
  let bd = radius;
  for (const p of pois) {
    if (!isDiscoverable(p) || found.has(p.id)) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= bd) {
      bd = d;
      b = p;
    }
  }
  return b;
}

export const scienceOf = (pois: readonly Poi[], found: Iterable<string>): number => {
  const set = new Set(found);
  return pois.reduce((s, p) => s + (isDiscoverable(p) && set.has(p.id) ? p.science : 0), 0);
};

// ---------------------------------------------------------------- fog of war (coarse explored mask)

export const createMask = (n: number = EXPLORE.maskN): Uint8Array => new Uint8Array(n * n);

/** Marks every mask cell whose centre is within `radius` metres of (x,z). Returns how many cells were newly revealed. */
export function revealDisc(mask: Uint8Array, n: number, extent: number, x: number, z: number, radius: number): number {
  const cw = extent / n;
  const c0 = Math.max(0, Math.floor((x - radius) / cw + n / 2));
  const c1 = Math.min(n - 1, Math.ceil((x + radius) / cw + n / 2));
  const r0 = Math.max(0, Math.floor((z - radius) / cw + n / 2));
  const r1 = Math.min(n - 1, Math.ceil((z + radius) / cw + n / 2));
  let fresh = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const cx = (c + 0.5 - n / 2) * cw;
      const cz = (r + 0.5 - n / 2) * cw;
      if (Math.hypot(cx - x, cz - z) <= radius && !mask[r * n + c]) {
        mask[r * n + c] = 1;
        fresh++;
      }
    }
  }
  return fresh;
}

/** Share (0..1) of the play disc around `home` that has been revealed. */
export function exploredFraction(mask: Uint8Array, n: number, extent: number, home: { x: number; z: number }, radius: number = EXPLORE.playRadiusM): number {
  const cw = extent / n;
  let tot = 0;
  let seen = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cx = (c + 0.5 - n / 2) * cw;
      const cz = (r + 0.5 - n / 2) * cw;
      if (Math.hypot(cx - home.x, cz - home.z) > radius) continue;
      tot++;
      if (mask[r * n + c]) seen++;
    }
  }
  return tot ? seen / tot : 0;
}

// ---------------------------------------------------------------- badges

export type BadgeId = 'firstSteps' | 'iceHunter' | 'earthSpotter' | 'sunChaser' | 'explorer';

export const BADGES: { id: BadgeId; nameTr: string; nameEn: string; hintTr: string; hintEn: string }[] = [
  { id: 'firstSteps', nameTr: 'İlk adımlar', nameEn: 'First steps', hintTr: 'İlk ilgi noktanı bul.', hintEn: 'Find your first point of interest.' },
  { id: 'iceHunter', nameTr: 'Buz avcısı', nameEn: 'Ice hunter', hintTr: 'Bütün gölgeli kraterleri bul.', hintEn: 'Find every shadow crater.' },
  { id: 'earthSpotter', nameTr: 'Dünya gözcüsü', nameEn: 'Earth spotter', hintTr: 'Dünya gözetleme noktasına ulaş.', hintEn: 'Reach the Earth lookout.' },
  { id: 'sunChaser', nameTr: 'Güneş avcısı', nameEn: 'Sun chaser', hintTr: 'Hep güneşli tepeye çık.', hintEn: 'Climb the ever-sunny peak.' },
  { id: 'explorer', nameTr: 'Kâşif', nameEn: 'Explorer', hintTr: 'Çevrenin yarısını keşfet.', hintEn: 'Explore half of the area around base.' },
];

export function earnedBadges(pois: readonly Poi[], found: Iterable<string>, exploredFrac: number): BadgeId[] {
  const set = new Set(found);
  const real = pois.filter(isDiscoverable);
  const of = (k: PoiKind) => real.filter((p) => p.kind === k);
  const has = (ps: Poi[]) => ps.length > 0 && ps.every((p) => set.has(p.id));
  const out: BadgeId[] = [];
  if (real.some((p) => set.has(p.id))) out.push('firstSteps');
  if (has(of('ice'))) out.push('iceHunter');
  if (has(of('earth'))) out.push('earthSpotter');
  if (has(of('sun'))) out.push('sunChaser');
  if (exploredFrac >= EXPLORE.explorerFraction) out.push('explorer');
  return out;
}

// ---------------------------------------------------------------- daily missions

export interface MissionStats {
  /** metres walked that day (all outings) */
  walkedM: number;
  /** points of interest found that day */
  found: readonly Poi[];
}
export interface Mission {
  id: string;
  textTr: string;
  textEn: string;
  done: (s: MissionStats) => boolean;
  /** 0..1 for a progress bar */
  progress: (s: MissionStats) => number;
}

const kindMission = (id: string, kind: PoiKind, tr: string, en: string): Mission => ({
  id,
  textTr: tr,
  textEn: en,
  done: (s) => s.found.some((p) => p.kind === kind),
  progress: (s) => (s.found.some((p) => p.kind === kind) ? 1 : 0),
});
const walkMission = (id: string, m: number, tr: string, en: string): Mission => ({
  id,
  textTr: tr,
  textEn: en,
  done: (s) => s.walkedM >= m,
  progress: (s) => Math.min(1, s.walkedM / m),
});

export const MISSION_POOL: Mission[] = [
  kindMission('visitIce', 'ice', 'Gölgeli bir krateri ziyaret et.', 'Visit a shadow crater.'),
  kindMission('findSun', 'sun', 'Güneşli bir tepe bul.', 'Find a sunny peak.'),
  kindMission('lookEarth', 'earth', 'Dünya’yı ufukta gör.', 'See Earth above the horizon.'),
  kindMission('geology', 'geology', 'Ay’ın yüzeyinde ilginç bir yer bul.', 'Find an interesting place on the Moon’s surface.'),
  walkMission('walk1km', 1000, '1 kilometre yürü.', 'Walk 1 kilometre.'),
  walkMission('walk2km', 2000, '2 kilometre yürü.', 'Walk 2 kilometres.'),
  {
    id: 'discover2',
    textTr: 'Bir günde 2 yer keşfet.',
    textEn: 'Discover 2 places in one day.',
    done: (s) => s.found.length >= 2,
    progress: (s) => Math.min(1, s.found.length / 2),
  },
];

function hash32(v: number): number {
  let x = (Math.imul((v | 0) + 0x9e3779b9, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

/** Two different missions for a mission day, the same every time for the same day index. */
export function dailyMissions(dayIndex: number): [Mission, Mission] {
  const len = MISSION_POOL.length;
  const a = hash32(dayIndex) % len;
  const b = (a + 1 + (hash32(dayIndex + 7919) % (len - 1))) % len;
  return [MISSION_POOL[a], MISSION_POOL[b]];
}

// ---------------------------------------------------------------- persistence (localStorage 'astrakids.explore.v1')

export interface Progress {
  discovered: string[];
  mask: Uint8Array;
  totalWalkedM: number;
}

export const emptyProgress = (n: number = EXPLORE.maskN): Progress => ({ discovered: [], mask: createMask(n), totalWalkedM: 0 });

/** 1 bit per mask cell, base64. */
export function packMask(mask: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(mask.length / 8));
  for (let i = 0; i < mask.length; i++) if (mask[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function unpackMask(b64: string, n: number = EXPLORE.maskN): Uint8Array | null {
  try {
    const s = atob(b64);
    if (s.length !== Math.ceil((n * n) / 8)) return null;
    const mask = createMask(n);
    for (let i = 0; i < mask.length; i++) mask[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
    return mask;
  } catch {
    return null;
  }
}

export function encodeProgress(p: Progress): string {
  return JSON.stringify({ v: 1, mask: packMask(p.mask), discovered: p.discovered, walked: Math.round(p.totalWalkedM) });
}
export function decodeProgress(raw: string | null | undefined, n: number = EXPLORE.maskN): Progress {
  if (!raw) return emptyProgress(n);
  try {
    const j = JSON.parse(raw) as { v?: number; mask?: string; discovered?: unknown; walked?: unknown };
    if (j.v !== 1) return emptyProgress(n);
    const mask = (typeof j.mask === 'string' ? unpackMask(j.mask, n) : null) ?? createMask(n);
    const discovered = Array.isArray(j.discovered) ? j.discovered.filter((x): x is string => typeof x === 'string') : [];
    return { discovered, mask, totalWalkedM: typeof j.walked === 'number' && j.walked >= 0 ? j.walked : 0 };
  } catch {
    return emptyProgress(n);
  }
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStore = (): KV | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
export function loadProgress(store: KV | null = defaultStore(), n: number = EXPLORE.maskN): Progress {
  try {
    return decodeProgress(store?.getItem(EXPLORE.storageKey), n);
  } catch {
    return emptyProgress(n);
  }
}
export function saveProgress(p: Progress, store: KV | null = defaultStore()): void {
  try {
    store?.setItem(EXPLORE.storageKey, encodeProgress(p));
  } catch {
    /* private mode / quota: the game just forgets */
  }
}

