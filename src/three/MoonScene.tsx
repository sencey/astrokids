import { Html } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import type { Vector3 } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { DayActors, TowerGlows } from './Actors';
import type { DayAnim } from './Actors';
import { Buildings, Crew } from './Buildings';
import { CameraRig, overviewPosition } from './CameraRig';
import type { CamApi } from './CameraRig';
import { EXPLORE } from '../game/explore/config';
import { CONFIG, useTier } from './config';
import { PerfGuard } from './PerfGuard';
import { DestinationLayer, GroundFx, RouteLine } from './Destination';
import type { Ping } from './Destination';
import { evaluateDestination } from './destinationRules';
import type { DestinationMode, DestinationPick, DestinationRejectReason } from './destinationRules';
import { BaseBeacon, PoleMarker } from './Markers';
import { Sky } from './Sky';
import type { TimeState } from './Sky';
import { makeSkyState, SkyCtx } from './SkyContext';
import { SlotsLayer } from './SlotsLayer';
import { ExploreLayer } from './ExploreLayer';
import type { BuildKind, CamRuntime, CelebrateKind, ExploreApi, ExploreEvent } from './exploreTypes';
import { EarthBadge } from './EarthBadge';
import { makeFogUniforms, Terrain } from './Terrain';
import type { Overlays } from './Terrain';
import type { XZ } from './slots';
import type { DaySeries, PlacedBuilding, Slot, TerrainData, TerrainFrame } from './types';

/** Explore mode: solar towers drawn at this fraction of the (already reduced) building size, so the panel stays well under the lander's footprint. */
const TOWER_K = 0.5;

export interface MissionScene {
  habitat: Slot | null;
  towers: Slot[];
  berm: number;
  anim: MutableRefObject<DayAnim>;
  litOf: (slotIndex: number) => number;
  ice: XZ | null;
  rim: XZ;
}

export interface MoonSceneProps {
  data: TerrainData;
  frame: TerrainFrame;
  timeRef: MutableRefObject<TimeState>;
  overlays: Overlays;
  slots: Slot[];
  placed: PlacedBuilding[];
  landerSlot: Slot;
  showSlots: boolean;
  hover: number | null;
  selected: number | null;
  onHover: (i: number | null) => void;
  onTap: (i: number) => void;
  camApi: MutableRefObject<CamApi | null>;
  renderTag: (slot: Slot) => ReactNode;
  fill: boolean;
  /** live mode: today's Sun/Earth series replace the archive ones */
  sky?: { sun: DaySeries[]; earth: DaySeries[] };
  mission: MissionScene;
  baseLabel: string;
  poleLabel: string;
  /** null = tap-to-go on the ground; 'walk' / 'ice' = the next ground tap picks where the crew / rover goes */
  destinationMode?: DestinationMode;
  onDestinationPicked?: (pick: DestinationPick) => void;
  /** Escape pressed while picking */
  onDestinationCancel?: () => void;
  /** the tapped spot was not allowed (onDestinationPicked is not called) */
  onDestinationRejected?: (reason: DestinationRejectReason) => void;
  /** dashed route from the habitat to a target; the day time-lapse actors follow it too */
  routePreview?: { from: 'habitat'; to: [number, number, number] } | null;
  /** optional per-actor override of routePreview for the day time-lapse */
  routes?: { rover?: [number, number, number] | null; walk?: [number, number, number] | null };
  /** true = explorable Moon: isometric follow camera, tap-to-move commander, Pati the guide, beacons, fog of war. false/omitted = exactly the base-builder scene. */
  exploreMode?: boolean;
  /** energy for the outing (1 per started 500 m); a new value starts a new outing from base */
  exploreBudget?: number;
  /** arrive / discover / budgetSpent / home */
  onExploreEvent?: (e: ExploreEvent) => void;
  /** Pati's mouth moves (talk pose) while a line is spoken */
  patiTalking?: boolean;
  /** language for the on-screen distance chips (default: from <html lang>) */
  lang?: 'tr' | 'en';
  /** a short tap on a placed building (not while placing, picking a destination or exploring); the building flashes a gold ring */
  onBuildingTap?: (b: { id: string; slotIndex: number }) => void;
  /** battery / capacity 0..1: the charge bar of the energy storage unit */
  batteryFill?: number;
  // ---- persistent "exploration first" mode (all optional; used together with exploreMode)
  /** energy the child can still spend on walking right now (1 per started 1000 m outward). Changing it never moves the commander. Setting it switches explore to persistent mode (exploreBudget is then ignored). */
  walkEnergy?: number;
  /** key of the current mission day (e.g. day index): the 'ice' event fires once per distinct value */
  dayKey?: string | number;
  /** show build pads near the commander; tapping one walks there and builds. null/omitted = no pads. */
  buildMode?: BuildKind | null;
  /** the build animation finished: add the building to `placed` */
  onBuilt?: (b: { kind: BuildKind; slotIndex: number }) => void;
  /** the commander entered (true) / left (false) the 80 m base zone around the habitat */
  onNearBase?: (near: boolean) => void;
  /** storm alarm: red edge pulse, bright base beacon, Pati runs / points home; reaching base emits {type:'home'} */
  alarmActive?: boolean;
  /** called when api.celebrate(kind) fires (hook the chime sfx here) */
  onCelebrate?: (kind: CelebrateKind) => void;
  /** fires when buildMode turns on: sunny pads (>= 30% lit today) within 1.6 km, and the best pad within 3 km (lit % and distance in metres) */
  onPadsInfo?: (i: { sunnyCount: number; bestLitPct: number; bestDistanceM: number }) => void;
  /** edge chips for places: null/omitted = all undiscovered in range; [] = none; ids = only these */
  chipPoiIds?: string[] | null;
  /** UI rectangles in viewport CSS px that edge chips must stay clear of (chips also never overlap each other) */
  chipAvoidRects?: { x: number; y: number; w: number; h: number }[];
  /** Earth sphere drawn at this CENTRE (viewport CSS px) with this DIAMETER (px, capped at 56); null/omitted = hidden. Shown only while Earth is above the horizon. */
  earthBadge?: { x: number; y: number; size: number } | null;
}

export default function MoonScene(p: MoonSceneProps) {
  const { frame, slots } = p;
  const dprCap = useTier().dpr;
  const skyRef = useRef(makeSkyState());
  const slotEdge = slots[0].cells * frame.cell;
  // Buildings are drawn bigger than life so they read from the orbit camera (see CONFIG.habitatSlotFraction).
  const baseUnit = (CONFIG.habitatSlotFraction * slotEdge) / 8;
  // In explore mode the commander (1.8 m x avatarScale) should be about a third of the lander (~7 m), so the buildings shrink to match.
  const unit = p.exploreMode ? Math.min(baseUnit, (3 * 1.8 * EXPLORE.avatarScale) / 7) : baseUnit;
  const occupied = useMemo(() => new Set(p.placed.map((b) => b.slotIndex)), [p.placed]);
  const tagSlot = p.showSlots ? slots[p.hover ?? p.selected ?? -1] : undefined;
  const cam = overviewPosition(frame.extent);
  const skyData = useMemo(() => ({ sun: p.sky?.sun ?? p.data.sun, earth: p.sky?.earth ?? p.data.earth }), [p.sky, p.data]);

  // where the crew starts from: the habitat once built, else the lander
  const base = p.mission.habitat ?? p.landerSlot;
  const from = useMemo<XZ>(() => ({ x: base.x, z: base.z }), [base.x, base.z]);
  const pingRef = useRef<Ping | null>(null);
  const mode = p.destinationMode ?? null;

  // ---- explore mode (inert while p.exploreMode is false)
  const exploring = !!p.exploreMode;
  const camRt = useRef<CamRuntime>({ mode: 'orbit', follow: null, yawStep: 0, fit: null, userZoomAt: 0 });
  const exploreApi = useRef<ExploreApi | null>(null);
  const exploreEvent = useRef(p.onExploreEvent);
  exploreEvent.current = p.onExploreEvent;
  const builtRef = useRef(p.onBuilt);
  builtRef.current = p.onBuilt;
  const nearRef = useRef(p.onNearBase);
  nearRef.current = p.onNearBase;
  const padsInfoRef = useRef(p.onPadsInfo);
  padsInfoRef.current = p.onPadsInfo;
  const celRef = useRef(p.onCelebrate);
  celRef.current = p.onCelebrate;
  const fog = useMemo(() => makeFogUniforms(frame.extent), [frame.extent]);
  const home = useMemo(() => ({ x: p.landerSlot.x, z: p.landerSlot.z }), [p.landerSlot.x, p.landerSlot.z]);
  useEffect(() => {
    camRt.current.mode = exploring ? 'iso' : 'orbit';
  }, [exploring]);
  const rt = p.routePreview?.to ?? null;
  const roverTo = p.routes?.rover ?? rt;
  const walkTo = p.routes?.walk ?? rt;

  const onGroundTap = (pt: Vector3) => {
    if (mode) {
      const r = evaluateDestination(p.data, frame, slots, from, mode, pt.x, pt.z);
      if (r.ok) {
        pingRef.current?.(pt.x, pt.z, 'ok');
        p.onDestinationPicked?.(r.pick);
      } else {
        pingRef.current?.(pt.x, pt.z, 'bad');
        p.onDestinationRejected?.(r.reason);
      }
      return;
    }
    if (exploring) {
      exploreApi.current?.walkTo([pt.x, pt.z]);
      return;
    }
    if (p.showSlots) return; // placing a building: taps keep selecting slots
    pingRef.current?.(pt.x, pt.z, 'ok');
    p.camApi.current?.focusOn([pt.x, pt.y, pt.z]);
  };

  const cancel = p.onDestinationCancel;
  useEffect(() => {
    if (!mode || !cancel) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [mode, cancel]);

  return (
    <Canvas
      shadows
      dpr={[1, dprCap]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = CONFIG.toneMappingExposure;
      }}
      camera={{ fov: 45, near: frame.extent * 0.002, far: frame.extent * 60, position: cam }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: mode ? 'crosshair' : undefined }}
    >
      <SkyCtx.Provider value={skyRef}>
        <PerfGuard />
        <Sky data={skyData} frame={frame} timeRef={p.timeRef} skyRef={skyRef} fill={p.fill} />
        <Terrain data={p.data} frame={frame} overlays={p.overlays} onGroundTap={onGroundTap} fog={fog} />
        {mode && <DestinationLayer mode={mode} data={p.data} frame={frame} slots={slots} from={from} />}
        {p.routePreview && <RouteLine frame={frame} from={from} to={p.routePreview.to} unit={unit} />}
        <GroundFx pingRef={pingRef} frame={frame} />
        <Buildings placed={p.placed} slots={slots} frame={frame} unit={unit} onTap={!exploring && !mode && !p.showSlots ? p.onBuildingTap : undefined} batteryFill={p.batteryFill} scales={exploring ? { solarTower: TOWER_K } : undefined} />
        {exploring ? (
          <ExploreLayer data={p.data} frame={frame} home={home} budget={p.exploreBudget ?? 6} talking={!!p.patiTalking} onEvent={exploreEvent} apiRef={exploreApi} camRt={camRt} fog={fog} pingRef={pingRef} unit={unit} lang={p.lang} walkEnergy={p.walkEnergy} base={base} dayKey={p.dayKey} alarmActive={p.alarmActive} slots={slots} occupied={occupied} litOf={p.mission.litOf} buildMode={p.buildMode} onBuilt={builtRef} onNearBase={nearRef} onCelebrate={celRef} towerK={TOWER_K} chipPoiIds={p.chipPoiIds} chipAvoidRects={p.chipAvoidRects} onPadsInfo={padsInfoRef} />
        ) : (
          <Crew slot={p.landerSlot} frame={frame} unit={unit} />
        )}
        <BaseBeacon slot={base} frame={frame} unit={unit} label={p.baseLabel} labelUp={exploring ? 9 : 22} alarm={exploring && !!p.alarmActive} />
        {p.mission.habitat && <DayActors frame={frame} habitat={p.mission.habitat} unit={unit} anim={p.mission.anim} ice={p.mission.ice} rim={p.mission.rim} berm={p.mission.berm} roverTarget={roverTo ? { x: roverTo[0], z: roverTo[2] } : null} walkTarget={walkTo ? { x: walkTo[0], z: walkTo[2] } : null} routeShown={!!p.routePreview} />}
        <TowerGlows towers={p.mission.towers} frame={frame} unit={exploring ? unit * TOWER_K : unit} timeRef={p.timeRef} litOf={p.mission.litOf} />
        <PoleMarker data={p.data} frame={frame} label={p.poleLabel} />
        {p.showSlots && (
          <SlotsLayer slots={slots} frame={frame} occupied={occupied} hover={p.hover} selected={p.selected} onHover={p.onHover} onTap={p.onTap} />
        )}
        {tagSlot && (
          <Html position={[tagSlot.x, frame.groundY(tagSlot.x, tagSlot.z) + 14 * unit, tagSlot.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            {p.renderTag(tagSlot)}
          </Html>
        )}
        <CameraRig frame={frame} api={p.camApi} minDistance={slotEdge * 0.6} rt={camRt} explore={exploreApi} />
        {exploring && p.earthBadge && <EarthBadge spec={p.earthBadge} />}
      </SkyCtx.Provider>
    </Canvas>
  );
}





