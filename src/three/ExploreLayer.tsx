// The explorable Moon: tap-to-move commander, Pati the guide, science beacons, fog of war, footstep dust.
// Rules live in src/game/explore (pure, tested); this file only moves things and talks to the camera / MoonScene.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, ClampToEdgeWrapping, DataTexture, LinearFilter, Points, PointsMaterial, RedFormat, Raycaster, UnsignedByteType, Vector2, Vector3 } from 'three';
import type { Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { EXPLORE } from '../game/explore/config';
import {
  discoverNear,
  earnedBadges,
  energyUsed,
  exploredFraction,
  loadProgress,
  newOuting,
  revealDisc,
  saveProgress,
  scienceOf,
  snapToPoi,
} from '../game/explore/explore';
import type { Outing, Progress } from '../game/explore/explore';
import { derivePois, isDiscoverable, nearestUndiscovered } from '../game/explore/pois';
import type { Poi } from '../game/explore/pois';
import { planWalk, pointAlong, polyLength } from '../game/explore/walk';
import type { XZ } from '../game/explore/walk';
import { isLowTier } from './config';
import type { Ping } from './Destination';
import { Dust } from './Dust';
import { chipName, formatKm, makeChip, placeChip, safeBlocks, safeInsets } from './edgeChips';
import type { Chip, Rect } from './edgeChips';
import type { DustEmit } from './Dust';
import { BuildFx, BuildPads, choosePads, PADS_FAR_M, PADS_REACH_M, padHalf, padsInfo, scanPads, SUNNY_PCT } from './BuildPads';
import type { BuildJob, PadCand, PadsInfo } from './BuildPads';
import type { BuildKind, CamRuntime, CelebrateKind, ExploreApi, ExploreEvent, ExploreSnapshot } from './exploreTypes';
import { Model } from './models/Model';
import type { GaitDrive } from './models/primitives';
import { PatiGuide } from './models/PatiSprite';
import type { PatiGuideState } from './models/PatiSprite';
import { Pati3D } from './models/Pati3D';
import { PoiBeacons } from './PoiBeacons';
import type { FogUniforms } from './Terrain';
import type { Slot, TerrainData, TerrainFrame } from './types';

/** `?pati=sprite` brings back the flat 2D companion for comparison. */
const PATI_SPRITE = (() => {
  try {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pati') === 'sprite';
  } catch {
    return false;
  }
})();
const TAU = Math.PI * 2;
const DOT_GAP = 60;
const DOT_CAP = 240;
const TRAIL_GAP = 30;
const STRIDE_M = 40; // metres walked per full leg-swing cycle

const poiCache = new WeakMap<object, Map<string, Poi[]>>();
/** derivePois takes a few hundred ms on the real map; do it once per terrain + landing site. */
function getPois(data: TerrainData, home: { x: number; z: number }): Poi[] {
  let m = poiCache.get(data);
  if (!m) poiCache.set(data, (m = new Map()));
  const key = `${Math.round(home.x)},${Math.round(home.z)}`;
  let p = m.get(key);
  if (!p) m.set(key, (p = derivePois(data, home)));
  return p;
}

function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

interface Run {
  x: number;
  z: number;
  heading: number;
  mode: 'idle' | 'walking' | 'returning';
  path: XZ[] | null;
  pathDist: number;
  pathLen: number;
  endBlocked: boolean;
  trail: XZ[];
  outing: Outing;
  progress: Progress;
  found: Set<string>;
  idleT: number;
  waveT: number;
  petX: number;
  petZ: number;
  petFace: 1 | -1;
  dustAcc: number;
  dustSide: number;
  fogBusy: boolean;
  saveT: number;
  dirty: boolean;
  firstFrame: boolean;
  /** energy units still unspent (mirrors the walkEnergy prop; budget in legacy mode) */
  energy: number;
  /** energy units already charged for the current outward trip (1 per started 1000 m) */
  charged: number;
  nearBase: boolean;
  /** an alarm-time 'home' event was already sent for this alarm */
  alarmHomeSent: boolean;
  /** day key of the last 'ice' event */
  iceKey: unknown;
  /** pending build: walk to the pad, then build */
  job: BuildJob | null;
  building: boolean;
  /** celebration clock: seconds since start, < 0 = none */
  celT: number;
  celKind: CelebrateKind;
  alarmK: number;
}

const CEL_N = 40;
const CEL_S = 1;
const CEL_COLOR: Record<CelebrateKind, string> = { discover: '#ffd24a', build: '#ff9a3c', ice: '#8fe3ff', day: '#fff2b0' };

export interface ExploreLayerProps {
  data: TerrainData;
  frame: TerrainFrame;
  /** landing site, world metres */
  home: { x: number; z: number };
  budget: number;
  talking: boolean;
  onEvent: MutableRefObject<((e: ExploreEvent) => void) | undefined>;
  apiRef: MutableRefObject<ExploreApi | null>;
  camRt: MutableRefObject<CamRuntime>;
  fog: FogUniforms;
  pingRef: MutableRefObject<Ping | null>;
  /** drawn size of the buildings (metres per model metre); the commander starts outside the lander's footprint */
  unit: number;
  lang?: 'tr' | 'en';
  // ---- persistent exploration (all optional; omitted = the old per-outing budget behaviour)
  /** energy the child can still spend on walking right now; may change any time without moving the commander */
  walkEnergy?: number;
  /** where "home" is (habitat when built, else the lander); default = `home` */
  base?: { x: number; z: number };
  /** key of the current mission day: 'ice' fires once per distinct value */
  dayKey?: string | number;
  alarmActive?: boolean;
  // ---- build in the world
  slots?: Slot[];
  occupied?: Set<number>;
  litOf?: (slotIndex: number) => number;
  buildMode?: BuildKind | null;
  onBuilt?: MutableRefObject<((b: { kind: BuildKind; slotIndex: number }) => void) | undefined>;
  onNearBase?: MutableRefObject<((near: boolean) => void) | undefined>;
  onCelebrate?: MutableRefObject<((kind: CelebrateKind) => void) | undefined>;
  /** size factor of drawn solar towers (explore shrinks them) */
  towerK?: number;
  /** null/omitted = chips for every undiscovered place in range; [] = none; ids = only these places */
  chipPoiIds?: string[] | null;
  /** UI rectangles (viewport CSS px) that chips must stay clear of */
  chipAvoidRects?: { x: number; y: number; w: number; h: number }[];
  /** called whenever buildMode turns on: how many sunny pads are near and where the best one is */
  onPadsInfo?: MutableRefObject<((i: PadsInfo) => void) | undefined>;
}

const EMPTY_SET = new Set<number>();

export function ExploreLayer({ data, frame, home, budget, talking, onEvent, apiRef, camRt, fog, pingRef, unit, lang, walkEnergy, base, dayKey, alarmActive, slots, occupied, litOf, buildMode, onBuilt, onNearBase, onCelebrate, towerK = 0.5, chipPoiIds, chipAvoidRects, onPadsInfo }: ExploreLayerProps) {
  const S = EXPLORE.avatarScale;
  const n = EXPLORE.maskN;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const L: 'tr' | 'en' = lang ?? (typeof document !== 'undefined' && document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'tr');
  const pois = useMemo(() => getPois(data, home), [data, home]);
  const baseX = base?.x ?? home.x;
  const baseZ = base?.z ?? home.z;
  const start = useMemo(() => {
    const d = 5.4 * unit + 1.4 * S; // beyond the lander's legs
    return { x: baseX + d * 0.88, z: baseZ + d * 0.47 };
  }, [baseX, baseZ, S, unit]);
  /** the base zone: 80 m beyond the building footprint */
  const nearR = 80 + 5.4 * unit;
  const half = frame.extent / 2;
  const heightAt = useMemo(() => (x: number, z: number) => frame.groundY(x, z) / (frame.exag || 1), [frame]);

  const budgetRef = useRef(budget);
  budgetRef.current = budget;
  const persistRef = useRef(walkEnergy !== undefined);
  persistRef.current = walkEnergy !== undefined;
  const alarmRef = useRef(!!alarmActive);
  const dayRef = useRef(dayKey);
  dayRef.current = dayKey;
  const baseRef = useRef({ x: baseX, z: baseZ, r: nearR });
  baseRef.current = { x: baseX, z: baseZ, r: nearR };
  const talkProp = useRef(talking);
  talkProp.current = talking;
  const talkApi = useRef(false);

  // ---- mutable game state (no React re-renders while playing)
  const runRef = useRef<Run | null>(null);
  if (!runRef.current) {
    const progress = loadProgress(undefined, n);
    revealDisc(progress.mask, n, frame.extent, home.x, home.z, EXPLORE.startRevealM);
    runRef.current = {
      x: start.x,
      z: start.z,
      heading: 0.6,
      mode: 'idle',
      path: null,
      pathDist: 0,
      pathLen: 0,
      endBlocked: false,
      trail: [[start.x, start.z]],
      outing: newOuting(walkEnergy ?? budget),
      energy: Math.max(0, Math.floor(walkEnergy ?? budget)),
      charged: 0,
      nearBase: true,
      alarmHomeSent: false,
      iceKey: undefined,
      job: null,
      building: false,
      celT: -1,
      celKind: 'discover',
      alarmK: 0,
      progress,
      found: new Set(progress.discovered),
      idleT: 0,
      waveT: 3,
      petX: start.x + 2.6 * S,
      petZ: start.z + 1.6 * S,
      petFace: -1,
      dustAcc: 0,
      dustSide: 1,
      fogBusy: true,
      saveT: 0,
      dirty: false,
      firstFrame: true,
    };
  }
  const run = runRef.current;
  const foundRef = useRef(run.found);
  foundRef.current = run.found;

  const reduceMotion = useMemo(() => {
    try {
      return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }, []);
  const gait = useRef<GaitDrive>({ speed: 0, phase: 0 });
  const patiState = useRef<PatiGuideState>({ pose: 'idle', face: -1 });
  const dustEmit = useRef<DustEmit | null>(null);
  const cmdGrp = useRef<Group>(null);
  const patiGrp = useRef<Group>(null);
  const marker = useRef<Group>(null);
  const markerRing = useRef<Mesh>(null);
  const markerArrow = useRef<Mesh>(null);
  const markerMat = useRef({ ok: '#ffd24a', blocked: '#ff7a3c' });

  // ---- fog texture (64 x 64, one byte per cell, bilinear = soft edges)
  const fogTex = useMemo(() => {
    const t = new DataTexture(new Uint8Array(n * n), n, n, RedFormat, UnsignedByteType);
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.wrapS = t.wrapT = ClampToEdgeWrapping;
    t.generateMipmaps = false;
    const d = t.image.data as Uint8Array;
    for (let i = 0; i < n * n; i++) d[i] = run.progress.mask[i] ? 255 : 0;
    t.needsUpdate = true;
    return t;
  }, [n, run]);
  const vis = useMemo(() => Float32Array.from(run.progress.mask), [run]);
  useEffect(() => {
    const prev = fog.uFogTex.value;
    fog.uFogTex.value = fogTex;
    fog.uFogDim.value = EXPLORE.fogDim;
    fog.uFogExtent.value = frame.extent;
    fog.uFogK.value = 1;
    return () => {
      fog.uFogK.value = 0;
      fog.uFogTex.value = prev;
      fogTex.dispose();
    };
  }, [fog, fogTex, frame.extent]);

  // ---- target marker + dotted path
  const dots = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(DOT_CAP * 3), 3));
    g.setDrawRange(0, 0);
    const m = new PointsMaterial({ map: dotTexture(), color: '#ffd24a', size: S * 0.3, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0.9 });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 7;
    return { g, m, p, count: 0 };
  }, [S]);
  useEffect(
    () => () => {
      dots.g.dispose();
      dots.m.map?.dispose();
      dots.m.dispose();
    },
    [dots],
  );

  const emit = (type: ExploreEvent['type'], poiId?: string, energy?: number) => {
    const o = run.outing;
    onEvent.current?.({ type, poiId, energy, walkedM: Math.round(o.walkedM), energyLeft: run.energy });
  };
  /** metres the commander may still walk: what is left of the block already paid for + the energy still in hand */
  const rangeLeft = () => Math.max(0, run.charged * EXPLORE.metersPerEnergy - run.outing.walkedM) + run.energy * EXPLORE.metersPerEnergy;
  const noEnergy = () => rangeLeft() <= 1e-6;
  const save = () => {
    run.dirty = false;
    run.saveT = 0;
    saveProgress(run.progress);
  };

  const buildDots = (pts: XZ[], len: number) => {
    const a = dots.g.getAttribute('position') as BufferAttribute;
    let k = 0;
    for (let d = DOT_GAP; d < len - DOT_GAP * 0.4 && k < DOT_CAP; d += DOT_GAP) {
      const p = pointAlong(pts, d);
      a.setXYZ(k++, p.x, frame.groundY(p.x, p.z) + frame.cell * 0.18, p.z);
    }
    a.needsUpdate = true;
    dots.count = k;
    dots.g.setDrawRange(0, k);
  };

  const finishHome = () => {
    run.x = start.x;
    run.z = start.z;
    run.mode = 'idle';
    run.path = null;
    run.waveT = 3;
    run.alarmHomeSent = true;
    dots.g.setDrawRange(0, 0);
    if (persistRef.current) {
      // persistent exploration: the trip is over, the commander stays at base ready for the next one
      run.outing.phase = 'out';
      run.outing.walkedM = 0;
      run.charged = 0;
      run.trail = [[start.x, start.z]];
    } else run.outing.phase = 'home';
    emit('home');
    save();
  };
  const startReturn = () => {
    const o = run.outing;
    if (o.phase !== 'out' || run.building) return;
    run.job = null;
    if (Math.hypot(run.x - start.x, run.z - start.z) < 25) {
      finishHome();
      return;
    }
    o.phase = 'returning';
    const here: XZ = [run.x, run.z];
    const back: XZ[] = [here, ...[...run.trail].reverse()];
    const direct = planWalk(here, [start.x, start.z], { heightAt, halfExtent: half, maxLenM: 1e9, slopeLimitDeg: EXPLORE.slopeLimitDeg });
    // straight home when the ground allows it and it is shorter than retracing the steps
    const path = direct.stoppedBy === null && direct.lengthM <= polyLength(back) ? direct.points : back;
    run.path = path;
    run.pathLen = polyLength(path);
    run.pathDist = 0;
    run.mode = 'returning';
    run.endBlocked = false;
    run.idleT = 0;
    // the way home is shown as dots too (gold-blue), ending in the target ring at base
    dots.m.color.set('#8fe3ff');
    buildDots(path, run.pathLen);
  };

  /** returns true when a walk started. `snap` = let a tap near a place walk to the place itself. */
  const walkToPoint = (target: [number, number], snap: boolean): boolean => {
    const o = run.outing;
    if (o.phase !== 'out' || run.building) return false;
    let [tx, tz] = target;
    if (noEnergy()) {
      pingRef.current?.(tx, tz, 'bad');
      if (persistRef.current) emit('noEnergy');
      return false;
    }
    if (snap) {
      const sp = snapToPoi(pois, run.found, tx, tz);
      if (sp) [tx, tz] = [sp.x, sp.z];
    }
    const plan = planWalk([run.x, run.z], [tx, tz], { heightAt, halfExtent: half, maxLenM: rangeLeft() });
    if (plan.lengthM < 8) {
      pingRef.current?.(tx, tz, 'bad');
      return false;
    }
    pingRef.current?.(tx, tz, plan.stoppedBy === 'steep' ? 'bad' : 'ok');
    run.path = plan.points;
    run.pathLen = plan.lengthM;
    run.pathDist = 0;
    run.endBlocked = plan.stoppedBy === 'steep';
    run.mode = 'walking';
    run.idleT = 0;
    dots.m.color.set('#ffd24a');
    buildDots(plan.points, plan.lengthM);
    return true;
  };
  const walkTo = (target: [number, number]) => {
    run.job = null; // the child chose somewhere else
    walkToPoint(target, true);
  };

  const startOuting = (b?: number) => {
    run.outing = newOuting(b ?? budgetRef.current);
    run.energy = run.outing.budget;
    run.charged = 0;
    run.job = null;
    run.x = start.x;
    run.z = start.z;
    run.mode = 'idle';
    run.path = null;
    run.trail = [[start.x, start.z]];
    run.idleT = 0;
    run.waveT = 2.5;
    dots.g.setDrawRange(0, 0);
  };

  const snapshot = (): ExploreSnapshot => {
    const o = run.outing;
    const frac = exploredFraction(run.progress.mask, n, frame.extent, home);
    return {
      phase: o.phase,
      moving: run.mode !== 'idle',
      budget: run.charged + run.energy,
      energyLeft: run.energy,
      walkedM: Math.round(o.walkedM),
      rangeLeftM: Math.round(rangeLeft()),
      pos: [run.x, run.z],
      pois,
      discovered: [...run.found],
      discoveredNow: [...o.found],
      science: scienceOf(pois, run.found),
      scienceNow: o.scienceNow,
      badges: earnedBadges(pois, run.found, frac),
      exploredFraction: frac,
      nearestUndiscovered: nearestUndiscovered(pois, run.found, run.x, run.z)?.id ?? null,
      nearBase: run.nearBase,
    };
  };

  const celebrate = (kind: CelebrateKind) => {
    run.celKind = kind;
    run.celT = 0;
    cel.m.color.set(CEL_COLOR[kind]);
    const a = cel.g.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < CEL_N; i++) {
      const az = (i / CEL_N) * TAU * 3.7;
      const up = 0.5 + 0.5 * ((i * 7) % 10) / 10;
      const sp = (0.6 + 0.4 * (((i * 13) % 10) / 10)) * 2.2 * S;
      cel.vel[i * 3] = Math.cos(az) * sp;
      cel.vel[i * 3 + 1] = (1.5 + up * 2.2) * S;
      cel.vel[i * 3 + 2] = Math.sin(az) * sp;
      a.setXYZ(i, run.x, frame.groundY(run.x, run.z) + 1.6 * S, run.z);
    }
    a.needsUpdate = true;
    cel.p.visible = true;
    onCelebrate?.current?.(kind);
  };

  // expose the api (latest closures on every render are fine: they only touch refs)
  const apiImpl = useRef<ExploreApi | null>(null);
  apiImpl.current = { walkTo, goHome: startReturn, startOuting, setPatiTalking: (on) => void (talkApi.current = on), celebrate, getState: snapshot };
  useEffect(() => {
    const api: ExploreApi = {
      walkTo: (t) => apiImpl.current?.walkTo(t),
      goHome: () => apiImpl.current?.goHome(),
      startOuting: (b) => apiImpl.current?.startOuting(b),
      setPatiTalking: (on) => apiImpl.current?.setPatiTalking(on),
      celebrate: (k) => apiImpl.current?.celebrate(k),
      getState: () => apiImpl.current!.getState(),
    };
    apiRef.current = api;
    if (import.meta.env.DEV) (window as unknown as { __explore?: ExploreApi }).__explore = api;
    const follow = { x: run.x, z: run.z };
    camRt.current.follow = follow;
    return () => {
      apiRef.current = null;
      camRt.current.follow = null;
      if (import.meta.env.DEV) delete (window as unknown as { __explore?: ExploreApi }).__explore;
      saveProgress(run.progress);
    };
  }, [apiRef, camRt, run]);

  // legacy mode: a new energy budget from the parent starts a new outing from base
  const lastBudget = useRef(budget);
  useEffect(() => {
    if (lastBudget.current === budget) return;
    lastBudget.current = budget;
    if (persistRef.current) return;
    startOuting(budget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);

  // persistent mode: the energy in hand changes any time (new day, building, storm) WITHOUT moving the commander
  useEffect(() => {
    if (walkEnergy === undefined) return;
    run.energy = Math.max(0, Math.floor(walkEnergy));
  }, [walkEnergy, run]);

  useEffect(() => {
    alarmRef.current = !!alarmActive;
    if (alarmActive) run.alarmHomeSent = false;
  }, [alarmActive, run]);

  // build mode off (or changed) cancels a build the commander was still walking to
  useEffect(() => {
    if (!buildMode) run.job = null;
  }, [buildMode, run]);

  // ---- celebration star burst (<= 40 instanced points, 1 s)
  const cel = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(CEL_N * 3), 3));
    const m = new PointsMaterial({ map: dotTexture(), color: '#ffd24a', size: S * 0.5, sizeAttenuation: true, transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false, opacity: 1 });
    const p = new Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = 12;
    p.visible = false;
    return { g, m, p, vel: new Float32Array(CEL_N * 3) };
  }, [S]);
  useEffect(
    () => () => {
      cel.g.dispose();
      cel.m.map?.dispose();
      cel.m.dispose();
    },
    [cel],
  );

  // ---- fill light inside the revealed area (explore only)
  useEffect(() => {
    fog.uFogLift.value = 0.14;
    return () => {
      fog.uFogLift.value = 0;
    };
  }, [fog]);

  // ---- build in the world: walk to the tapped pad, then the crate lands and the structure rises
  const [bfx, setBfx] = useState<BuildJob | null>(null);
  const bfxId = useRef(0);
  const pickPad = (slotIndex: number) => {
    if (!buildMode || !slots || run.building || run.outing.phase !== 'out') return;
    const s = slots[slotIndex];
    if (!s) return;
    run.job = { id: ++bfxId.current, kind: buildMode, slotIndex, x: s.x, z: s.z };
    if (Math.hypot(run.x - s.x, run.z - s.z) <= padReach) {
      startBuild();
      return;
    }
    if (!walkToPoint([s.x, s.z], false)) run.job = null;
  };
  const padReach = slots ? padHalf(slots, frame) * 0.8 : 100;
  const startBuild = () => {
    const j = run.job;
    run.job = null;
    if (!j) return;
    run.building = true;
    run.mode = 'idle';
    run.path = null;
    dots.g.setDrawRange(0, 0);
    run.heading = Math.atan2(j.x - run.x, j.z - run.z);
    setBfx(j);
  };

  // ---- screen-edge chips for places not found yet (plain DOM next to the canvas; hidden when the place is on screen)
  const chips = useRef<Chip[]>([]);
  const chipRoot = useRef<HTMLDivElement | null>(null);
  const vigRef = useRef<HTMLDivElement | null>(null);
  const padChips = useRef<Chip[]>([]);
  const padTarget = useRef<number[]>([-1, -1, -1]);
  const padPlan = useRef<{ t: number; occ: Set<number> | null; shown: PadCand[]; far: PadCand[] }>({ t: 9, occ: null, shown: [], far: [] });
  useEffect(() => {
    if (!buildMode || !slots || !litOf) return;
    const far = scanPads(slots, frame, occupied ?? EMPTY_SET, { x: baseX, z: baseZ }, run.x, run.z, PADS_FAR_M, litOf);
    onPadsInfo?.current?.(padsInfo(far));
    // only when build mode turns on (or changes kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildMode]);
  const pickPadRef = useRef<(i: number) => void>(() => {});
  pickPadRef.current = pickPad;
  const chipIdsRef = useRef(chipPoiIds);
  chipIdsRef.current = chipPoiIds;
  const avoidRef = useRef(chipAvoidRects);
  avoidRef.current = chipAvoidRects;
  const buildModeRef = useRef(buildMode);
  buildModeRef.current = buildMode;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const litRef = useRef(litOf);
  litRef.current = litOf;
  const occRef = useRef(occupied ?? EMPTY_SET);
  occRef.current = occupied ?? EMPTY_SET;
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;overflow:hidden;z-index:6';
    host.appendChild(root);
    chipRoot.current = root;
    // storm alarm: a soft red glow around the screen edges (slow pulse, never a flash)
    const vig = document.createElement('div');
    vig.style.cssText = 'position:absolute;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,60,40,0) 52%,rgba(255,60,40,0.55) 100%)';
    root.appendChild(vig);
    vigRef.current = vig;
    chips.current = pois
      .filter(isDiscoverable)
      .map((p) => makeChip(p, L, () => apiImpl.current?.walkTo([p.x, p.z])));
    chips.current.forEach((c) => root.appendChild(c.el));
    // three reusable chips that point at the nearest build pads when none is on screen
    padChips.current = [0, 1, 2].map((k) =>
      makeChip(
        { id: 'pad-x', kind: 'sun', grid: [0, 0], x: 0, z: 0, nameTr: 'Yapı yeri', nameEn: 'Build spot', factTr: '', factEn: '', source: { name: '', url: '', citation: '' }, science: 1, walkM: 0 },
        L,
        () => pickPadRef.current(padTarget.current[k]),
      ),
    );
    padChips.current.forEach((c) => root.appendChild(c.el));
    return () => {
      padChips.current = [];
      root.remove();
      chipRoot.current = null;
      vigRef.current = null;
      chips.current = [];
    };
  }, [gl, pois, L]);
  const tmpV = useMemo(() => new Vector3(), []);
  const chipClock = useRef(1);

  // DEV only: window.__pick(clientX, clientY) lists what is under a screen point (to find stray objects)
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const rc = new Raycaster();
    (window as unknown as { __pick?: unknown }).__pick = (cx: number, cy: number) => {
      const r = gl.domElement.getBoundingClientRect();
      rc.setFromCamera(new Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      return rc
        .intersectObjects(scene.children, true)
        .slice(0, 6)
        .map((h) => {
          const chain: string[] = [];
          let o: Object3D | null = h.object;
          while (o && chain.length < 6) {
            chain.push(o.type + (o.name ? ':' + o.name : ''));
            o = o.parent;
          }
          const m = (h.object as Mesh).material as { color?: { getHexString(): string }; map?: unknown } | undefined;
          return { dist: Math.round(h.distance), chain, geometry: (h.object as Mesh).geometry?.type, color: m?.color?.getHexString(), hasMap: !!m?.map };
        });
    };
    return () => {
      delete (window as unknown as { __pick?: unknown }).__pick;
    };
  }, [gl, camera, scene]);

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const o = run.outing;
    const t = clock.getElapsedTime();
    let moved = 0;

    // ---- walking
    if (run.mode !== 'idle' && run.path) {
      const want = EXPLORE.walkMps * EXPLORE.timeScale * dt;
      const step = run.mode === 'walking' ? Math.max(0, Math.min(want, rangeLeft())) : want;
      if (run.mode === 'walking' && step > 0) {
        o.walkedM += step;
        // 1 energy per started 1000 m (outward walking only): charge the moment a new block starts
        while (energyUsed(o.walkedM) > run.charged && run.energy > 0) {
          run.charged++;
          run.energy--;
          emit('spend', undefined, 1);
        }
      }
      run.pathDist += step;
      moved = step;
      const p = pointAlong(run.path, run.pathDist);
      run.x = p.x;
      run.z = p.z;
      if (step > 0.01) run.heading += angleDiff(run.heading, p.heading) * Math.min(1, dt * 12);
      if (run.mode === 'walking') {
        run.progress.totalWalkedM += step;
        const last = run.trail[run.trail.length - 1];
        if (Math.hypot(run.x - last[0], run.z - last[1]) >= TRAIL_GAP) run.trail.push([run.x, run.z]);
        for (const poi of discoverNear(pois, run.found, run.x, run.z)) {
          run.found.add(poi.id);
          run.progress.discovered.push(poi.id);
          o.found.push(poi.id);
          o.scienceNow += poi.science;
          run.waveT = 2.6;
          emit('discover', poi.id);
          save();
        }
      }
      const arrived = p.done;
      const spent = run.mode === 'walking' && noEnergy();
      if (arrived || spent) {
        if (run.mode === 'returning') finishHome();
        else {
          run.mode = 'idle';
          run.path = null;
          dots.g.setDrawRange(0, 0);
          if (arrived) emit('arrive');
          if (spent && persistRef.current) {
            if (!arrived) emit('noEnergy'); // Pati can still walk home for free
          } else if (spent) {
            emit('budgetSpent');
            startReturn();
          }
          if (run.job) {
            if (Math.hypot(run.x - run.job.x, run.z - run.job.z) <= padReach) startBuild();
            else {
              pingRef.current?.(run.job.x, run.job.z, 'bad');
              run.job = null;
            }
          }
        }
      } else {
        const first = Math.min(dots.count, Math.floor(run.pathDist / DOT_GAP));
        dots.g.setDrawRange(first, dots.count - first);
      }
    }

    // ---- ice: first time today in a permanently shadowed cell, or standing at an ice place
    {
      const nn = data.n;
      const cm = data.meta.cellMeters;
      const col = Math.round(run.x / cm + (nn - 1) / 2);
      const row = Math.round(run.z / cm + (nn - 1) / 2);
      let ice = col >= 0 && row >= 0 && col < nn && row < nn && data.psr[row * nn + col] === 1;
      if (!ice) ice = pois.some((q) => q.kind === 'ice' && Math.hypot(q.x - run.x, q.z - run.z) <= EXPLORE.discoverRadiusM);
      const key = dayRef.current ?? 'session';
      if (ice && run.iceKey !== key) {
        run.iceKey = key;
        emit('ice');
      }
    }

    // ---- base zone (80 m around the habitat): onNearBase + trip reset + alarm 'home'
    {
      const b = baseRef.current;
      const near = Math.hypot(run.x - b.x, run.z - b.z) <= b.r;
      if (near !== run.nearBase) {
        run.nearBase = near;
        onNearBase?.current?.(near);
      }
      if (near && persistRef.current && run.mode === 'idle' && run.outing.walkedM > 0 && run.outing.phase === 'out') {
        run.outing.walkedM = 0; // standing at base: the next trip starts a fresh 1000 m block
        run.charged = 0;
        run.trail = [[run.x, run.z]];
      }
      if (near && alarmRef.current && !run.alarmHomeSent && run.mode !== 'returning') {
        run.alarmHomeSent = true;
        emit('home');
      }
    }

    // ---- fog of war: reveal around the commander, ease the texture toward the mask
    if (moved > 0 || run.firstFrame) {
      if (revealDisc(run.progress.mask, n, frame.extent, run.x, run.z, EXPLORE.revealRadiusM) > 0) {
        run.fogBusy = true;
        run.dirty = true;
      }
    }
    if (run.fogBusy) {
      const rate = isLowTier() ? 1 : Math.min(1, dt * 2.5);
      const mask = run.progress.mask;
      const d = fogTex.image.data as Uint8Array;
      let changed = false;
      for (let i = 0; i < n * n; i++) {
        const tg = mask[i];
        let v = vis[i];
        if (v === tg) continue;
        v += (tg - v) * rate;
        if (Math.abs(tg - v) < 0.01) v = tg;
        vis[i] = v;
        d[i] = Math.round(v * 255);
        changed = true;
      }
      if (changed) fogTex.needsUpdate = true;
      else run.fogBusy = false;
    }
    if (run.dirty) {
      run.saveT += dt;
      if (run.saveT > 6) save();
    }

    // ---- idle bookkeeping
    if (run.mode === 'idle') run.idleT += dt;
    else run.idleT = 0;
    if (run.waveT > 0) run.waveT -= dt;
    run.firstFrame = false;

    // ---- commander
    const g = gait.current;
    g.speed += ((moved > 0 ? 1 : 0) - g.speed) * Math.min(1, dt * 9);
    g.phase = (g.phase + (moved / STRIDE_M) * TAU) % (TAU * 1000);
    const cy = frame.groundY(run.x, run.z);
    if (cmdGrp.current) {
      cmdGrp.current.position.set(run.x, cy, run.z);
      cmdGrp.current.rotation.y = run.heading;
    }
    const follow = camRt.current.follow;
    if (follow) {
      follow.x = run.x;
      follow.z = run.z;
    }
    if (moved > 0 && !isLowTier() && dustEmit.current) {
      run.dustAcc += moved;
      while (run.dustAcc > 14) {
        run.dustAcc -= 14;
        run.dustSide = -run.dustSide;
        const sx = Math.cos(run.heading) * run.dustSide * 0.25 * S;
        const sz = -Math.sin(run.heading) * run.dustSide * 0.25 * S;
        dustEmit.current(run.x + sx, frame.groundY(run.x + sx, run.z + sz) + 1, run.z + sz, S * 0.5);
      }
    }

    // ---- target marker
    const mk = marker.current;
    if (mk) {
      const show = run.mode !== 'idle' && !!run.path;
      mk.visible = show;
      if (show) {
        const e = run.path![run.path!.length - 1];
        mk.position.set(e[0], frame.groundY(e[0], e[1]) + frame.cell * 0.12, e[1]);
        const col = run.endBlocked ? markerMat.current.blocked : markerMat.current.ok;
        (markerRing.current?.material as MeshBasicMaterial | undefined)?.color.set(col);
        (markerArrow.current?.material as MeshBasicMaterial | undefined)?.color.set(col);
        const pulse = 1 + 0.12 * Math.sin(t * 5);
        markerRing.current?.scale.setScalar(pulse);
        if (markerArrow.current) markerArrow.current.position.y = S * (1.5 + 0.18 * Math.sin(t * 5));
      }
    }

    // ---- Pati
    const dx = run.x - run.petX;
    const dz = run.z - run.petZ;
    const dist = Math.hypot(dx, dz);
    const fd = EXPLORE.petFollowM * S;
    const rx = camera.matrixWorld.elements[0];
    const rz = camera.matrixWorld.elements[2];
    const screenSide = (vx: number, vz: number, keep: 1 | -1): 1 | -1 => {
      const l = Math.hypot(vx, vz);
      if (l < 1e-6) return keep;
      const s = (vx * rx + vz * rz) / l / Math.max(1e-6, Math.hypot(rx, rz));
      return s > 0.2 ? 1 : s < -0.2 ? -1 : keep;
    };
    let petMoving = false;
    let running = false;
    if (dist > fd * 1.15) {
      running = dist > fd * 2.4;
      const sp = EXPLORE.walkMps * EXPLORE.timeScale * (running ? 1.9 : 1.1);
      const mv = Math.min(dist - fd, sp * dt);
      run.petX += (dx / dist) * mv;
      run.petZ += (dz / dist) * mv;
      petMoving = mv > 0.001;
      if (petMoving) run.petFace = screenSide(dx, dz, run.petFace);
    }
    const near = nearestUndiscovered(pois, run.found, run.x, run.z);
    const ps = patiState.current;
    const talkOn = talkProp.current || talkApi.current;
    const alarm = alarmRef.current;
    if (run.celT >= 0) {
      ps.pose = 'jump';
      run.petFace = screenSide(run.x - run.petX, run.z - run.petZ, run.petFace);
    } else if (alarm) {
      // storm: Pati runs / points the way home
      if (petMoving || run.mode !== 'idle') ps.pose = 'run';
      else {
        ps.pose = 'point';
        const b = baseRef.current;
        run.petFace = screenSide(b.x - run.petX, b.z - run.petZ, run.petFace);
      }
    } else if (talkOn) {
      ps.pose = 'talk';
      run.petFace = screenSide(run.x - run.petX, run.z - run.petZ, run.petFace);
    } else if (run.waveT > 0) {
      ps.pose = 'wave';
      run.petFace = screenSide(run.x - run.petX, run.z - run.petZ, run.petFace);
    } else if (petMoving) {
      ps.pose = running ? 'run' : 'walk';
    } else if (run.mode === 'idle' && run.idleT > EXPLORE.idleSitS) {
      ps.pose = 'sit';
    } else if (run.mode === 'idle' && run.idleT > EXPLORE.idlePointS && near) {
      ps.pose = 'point';
      run.petFace = screenSide(near.x - run.petX, near.z - run.petZ, run.petFace);
    } else {
      ps.pose = 'idle';
      run.petFace = screenSide(run.x - run.petX, run.z - run.petZ, run.petFace);
    }
    ps.face = run.petFace;
    // 3D Pati: face where it trots; at rest face the commander (or the place it points at)
    if (petMoving) ps.yaw = Math.atan2(dx, dz);
    else if (ps.pose === 'point' && !alarm && near) ps.yaw = Math.atan2(near.x - run.petX, near.z - run.petZ);
    else if (ps.pose === 'point' && alarm) ps.yaw = Math.atan2(baseRef.current.x - run.petX, baseRef.current.z - run.petZ);
    else if (Math.hypot(dx, dz) > 0.5) ps.yaw = Math.atan2(dx, dz);
    patiGrp.current?.position.set(run.petX, frame.groundY(run.petX, run.petZ), run.petZ);

    // ---- celebration: stars fly out and fall back, 1 s
    if (run.celT >= 0) {
      run.celT += dt;
      const u = run.celT / CEL_S;
      if (u >= 1) {
        run.celT = -1;
        cel.p.visible = false;
      } else {
        const a = cel.g.getAttribute('position') as BufferAttribute;
        const ox = run.x;
        const oz = run.z;
        const oy = frame.groundY(run.x, run.z) + 1.6 * S;
        const tt = run.celT;
        for (let i = 0; i < CEL_N; i++) {
          a.setXYZ(i, ox + cel.vel[i * 3] * tt, oy + cel.vel[i * 3 + 1] * tt - 3.2 * S * tt * tt, oz + cel.vel[i * 3 + 2] * tt);
        }
        a.needsUpdate = true;
        cel.m.opacity = 1 - u * u;
        cel.m.size = S * (0.55 - 0.25 * u);
      }
    }

    // ---- storm alarm glow on the screen edges (0.8 Hz breathing, eased in/out)
    run.alarmK += ((alarm ? 1 : 0) - run.alarmK) * Math.min(1, dt * 3);
    if (vigRef.current && (run.alarmK > 0.01 || vigRef.current.style.opacity !== '0')) {
      const k = run.alarmK < 0.01 ? 0 : run.alarmK * (0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 0.8));
      vigRef.current.style.opacity = k.toFixed(3);
    }

    // ---- chips (DOM overlay: refreshed at <= 15 Hz)
    chipClock.current += dt;
    if (chipClock.current < 1 / 15) return;
    chipClock.current = 0;
    const W = gl.domElement.clientWidth;
    const Hh = gl.domElement.clientHeight;
    const ins = safeInsets(W, Hh);
    const blocks = safeBlocks(W, Hh);
    const left = rangeLeft();
    const ids = chipIdsRef.current;
    const idSet = ids ? new Set(ids) : null;
    // UI rectangles (viewport px) -> canvas-local px
    const cr = gl.domElement.getBoundingClientRect();
    const avoid: Rect[] = (avoidRef.current ?? []).map((r) => ({ x0: r.x - cr.left, y0: r.y - cr.top, x1: r.x - cr.left + r.w, y1: r.y - cr.top + r.h }));

    // pad targets: shown only while building and none of the nearby pads is on screen
    const padWanted: { slot: Slot; d: number; pct: number }[] = [];
    if (buildModeRef.current && slotsRef.current && litRef.current && !run.building && o.phase === 'out') {
      const sl = slotsRef.current;
      // the plan (what pads are shown, and where the sunniest ones are) is refreshed twice a second: today's sunlight per slot is cached by the caller
      const pp = padPlan.current;
      pp.t += 1 / 15;
      if (pp.t >= 0.5 || pp.occ !== occRef.current) {
        pp.t = 0;
        pp.occ = occRef.current;
        const lit = litRef.current;
        pp.shown = choosePads(scanPads(sl, frame, occRef.current, baseRef.current, run.x, run.z, PADS_REACH_M, lit));
        const far = scanPads(sl, frame, occRef.current, baseRef.current, run.x, run.z, PADS_FAR_M, lit);
        pp.far = choosePads(far.filter((c) => c.pct >= SUNNY_PCT)).length ? choosePads(far.filter((c) => c.pct >= SUNNY_PCT)) : choosePads(far);
      }
      const sunnyShown = pp.shown.filter((c) => c.pct >= SUNNY_PCT);
      const test = sunnyShown.length ? sunnyShown : pp.shown;
      let anyOn = false;
      for (const q of test) {
        const s = sl[q.i];
        tmpV.set(s.x, frame.groundY(s.x, s.z), s.z).project(camera);
        if (tmpV.z < 1 && placeChip((tmpV.x * 0.5 + 0.5) * W, (-tmpV.y * 0.5 + 0.5) * Hh, W, Hh, ins, blocks) === null) {
          anyOn = true;
          break;
        }
      }
      // none on screen: point at the sunniest (not the nearest) ones
      if (!anyOn) for (const q of pp.far.slice(0, 3)) padWanted.push({ slot: sl[q.i], d: q.d, pct: q.pct });
    }

    interface Cand {
      c: Chip;
      d: number;
      px: number;
      py: number;
      pos: { x: number; y: number; deg: number };
    }
    const cands: Cand[] = [];
    const hide = (c: Chip) => {
      if (c.shown) {
        c.el.style.display = 'none';
        c.shown = false;
      }
    };
    const consider = (c: Chip, wx: number, wy: number, wz: number, d: number, ok: boolean) => {
      if (!ok) return hide(c);
      tmpV.set(wx, wy, wz).project(camera);
      const px = (tmpV.x * 0.5 + 0.5) * W;
      const py = (-tmpV.y * 0.5 + 0.5) * Hh;
      const pos = tmpV.z < 1 ? placeChip(px, py, W, Hh, ins, blocks) : null;
      if (!pos) return hide(c);
      cands.push({ c, d, px, py, pos });
    };
    for (const c of chips.current) {
      const d = Math.hypot(c.poi.x - run.x, c.poi.z - run.z);
      const ok = o.phase === 'out' && !run.found.has(c.poi.id) && d <= left + 1 && (!idSet || idSet.has(c.poi.id));
      consider(c, c.poi.x, frame.groundY(c.poi.x, c.poi.z) + 2.4 * S, c.poi.z, d, ok);
    }
    padChips.current.forEach((c, k) => {
      const w = padWanted[k];
      if (!w) return hide(c);
      padTarget.current[k] = w.slot.index;
      c.poi = { ...c.poi, id: `pad-${w.slot.index}`, x: w.slot.x, z: w.slot.z };
      const txt = `☀ ${Math.round(w.pct)}% · ${formatKm(w.d, L)}`;
      c.text = txt;
      c.label.textContent = txt;
      c.el.setAttribute('aria-label', L === 'tr' ? `Yapı yeri, güneş %${Math.round(w.pct)}, ${formatKm(w.d, L)}: oraya yürü ve kur` : `Build spot, ${Math.round(w.pct)}% sun, ${formatKm(w.d, L)}: walk there and build`);
      consider(c, w.slot.x, frame.groundY(w.slot.x, w.slot.z) + 2.4 * S, w.slot.z, w.d, true);
    });

    // chips never overlap each other or a UI rectangle: nearer places keep their spot, the others slide along the edge
    cands.sort((a, b) => a.d - b.d);
    const placed: { x: number; y: number }[] = [];
    const hitRect = (r: Rect, x: number, y: number) => x + 24 > r.x0 && x - 24 < r.x1 && y + 40 > r.y0 && y - 24 < r.y1;
    const free = (x: number, y: number) => !placed.some((q) => Math.abs(q.x - x) < 52 && Math.abs(q.y - y) < 66) && !avoid.some((r) => hitRect(r, x, y));
    const bx0 = ins.left + 24;
    const bx1 = W - ins.right - 24;
    const by0 = ins.top + 24;
    const by1 = Hh - ins.bottom - 40;
    for (const k of cands) {
      let { x, y } = k.pos;
      if (!free(x, y)) {
        const vertical = x <= bx0 + 2 || x >= bx1 - 2; // on the left / right edge: slide up / down, else sideways
        let found = false;
        for (let s = 1; s <= 12 && !found; s++) {
          for (const sg of [1, -1]) {
            const nx = vertical ? x : x + sg * s * 54;
            const ny = vertical ? y + sg * s * 68 : y;
            if (nx < bx0 || nx > bx1 || ny < by0 || ny > by1 || !free(nx, ny)) continue;
            x = nx;
            y = ny;
            found = true;
            break;
          }
        }
        if (!found) {
          hide(k.c);
          continue;
        }
      }
      placed.push({ x, y });
      const c = k.c;
      const deg = (Math.atan2(k.py - y, k.px - x) * 180) / Math.PI + 90;
      if (!c.shown) {
        c.el.style.display = 'block';
        c.shown = true;
      }
      if (Math.abs(x - c.x) > 0.4 || Math.abs(y - c.y) > 0.4) {
        c.x = x;
        c.y = y;
        c.el.style.transform = `translate3d(${Math.round(x - 24)}px,${Math.round(y - 24)}px,0)`;
      }
      if (Math.abs(deg - c.rotDeg) > 0.5) {
        c.rotDeg = deg;
        c.rot.style.transform = `rotate(${deg.toFixed(1)}deg)`;
      }
      if (!c.poi.id.startsWith('pad-')) {
        const txt = formatKm(k.d, L);
        if (txt !== c.text) {
          c.text = txt;
          c.label.textContent = txt;
          c.el.setAttribute('aria-label', chipName(c.poi, txt, L));
        }
      }
    }
  });

  return (
    <>
      <PoiBeacons pois={pois} frame={frame} found={foundRef} scale={S} />
      <group ref={cmdGrp} scale={S} position={[start.x, frame.groundY(start.x, start.z), start.z]}>
        <Model id="astronaut" drive={gait} />
      </group>
      <group ref={patiGrp} scale={S} position={[run.petX, frame.groundY(run.petX, run.petZ), run.petZ]}>
        {PATI_SPRITE ? <PatiGuide state={patiState} /> : <Pati3D state={patiState} reduceMotion={reduceMotion} />}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} renderOrder={3}>
          <circleGeometry args={[0.55, 16]} />
          <meshBasicMaterial color="#000" transparent opacity={0.3} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      </group>
      <group ref={marker} visible={false}>
        <mesh ref={markerRing} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
          <ringGeometry args={[S * 0.8, S * 1.05, 32]} />
          <meshBasicMaterial color="#ffd24a" transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={markerArrow} position={[0, S * 1.5, 0]} rotation={[Math.PI, 0, 0]} renderOrder={9}>
          <coneGeometry args={[S * 0.28, S * 0.7, 8]} />
          <meshBasicMaterial color="#ffd24a" depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <primitive object={dots.p} />
      <primitive object={cel.p} />
      {buildMode && slots && litOf && (
        <BuildPads
          slots={slots}
          frame={frame}
          occupied={occupied ?? EMPTY_SET}
          litOf={litOf}
          getPos={() => [run.x, run.z]}
          baseXZ={{ x: baseX, z: baseZ }}
          hidden={!!bfx}
          onPick={pickPad}
        />
      )}
      {bfx && (
        <BuildFx
          key={bfx.id}
          job={bfx}
          frame={frame}
          unit={unit}
          towerK={towerK}
          dust={dustEmit}
          onBuilt={() => {
            run.building = false;
            onBuilt?.current?.({ kind: bfx.kind, slotIndex: bfx.slotIndex });
          }}
          onGone={() => setBfx(null)}
        />
      )}
      <Dust emitRef={dustEmit} />
    </>
  );
}







