import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, BufferGeometry, CanvasTexture, Float32BufferAttribute, Group, Line as ThreeLine, LineBasicMaterial, MeshStandardMaterial, Sprite } from 'three';
import { Model } from './models/Model';
import type { GaitDrive } from './models/primitives';
import { lumpyTorus, regolithTexture, withRepeat } from './models/proc';
import type { TimeState } from './Sky';
import { useSky } from './SkyContext';
import type { XZ } from './slots';
import type { Slot, TerrainFrame } from './types';

/** Day time-lapse choreography, written by the UI driver, read by the actors every frame. */
export interface DayAnim {
  active: boolean;
  /** 0..1 across the day */
  t: number;
  ice: boolean;
  walk: 'rim' | 'ice' | null;
  /** time (0..1) when the walker was recalled by the alarm, or null */
  recalledAt: number | null;
}
export const idleAnim = (): DayAnim => ({ active: false, t: 0, ice: false, walk: null, recalledAt: null });

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** 0 = home, 1 = at the target. */
export function roverProgress(t: number): number {
  return ramp(t, 0.12, 0.45) - ramp(t, 0.58, 0.9);
}
export function walkProgress(t: number, recalledAt: number | null): number {
  const p = (x: number) => ramp(x, 0.18, 0.42) - ramp(x, 0.6, 0.84);
  if (recalledAt === null || t < recalledAt) return p(t);
  return Math.max(0, p(recalledAt) - (t - recalledAt) / 0.08);
}

function glowTex(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,240,170,1)');
  g.addColorStop(0.35, 'rgba(255,200,80,0.45)');
  g.addColorStop(1, 'rgba(255,180,60,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function pathLine(frame: TerrainFrame, a: XZ, b: XZ, color: string): ThreeLine {
  const pts: number[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const x = a.x + ((b.x - a.x) * i) / N;
    const z = a.z + ((b.z - a.z) * i) / N;
    pts.push(x, frame.groundY(x, z) + frame.cell * 0.5, z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return new ThreeLine(g, new LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthTest: false }));
}

function Walker({ from, to, frame, scale, anim, kind }: { from: XZ; to: XZ; frame: TerrainFrame; scale: number; anim: MutableRefObject<DayAnim>; kind: 'rover' | 'walker' }) {
  const g = useRef<Group>(null);
  const prev = useRef({ x: from.x, z: from.z });
  const spin = useRef<GaitDrive>({ speed: 0, phase: 0 });
  useFrame(() => {
    const a = anim.current;
    const grp = g.current;
    if (!grp) return;
    const on = a.active && (kind === 'rover' ? a.ice : a.walk !== null);
    grp.visible = kind === 'rover' ? true : on;
    const p = on ? (kind === 'rover' ? roverProgress(a.t) : walkProgress(a.t, a.recalledAt)) : 0;
    const x = from.x + (to.x - from.x) * p;
    const z = from.z + (to.z - from.z) * p;
    grp.position.set(x, frame.groundY(x, z), z);
    const dx = x - prev.current.x;
    const dz = z - prev.current.z;
    if (Math.abs(dx) + Math.abs(dz) > 1e-3) grp.rotation.y = Math.atan2(dx, dz) - Math.PI / 2;
    if (kind === 'rover') spin.current.phase += Math.hypot(dx, dz) / (scale * 0.46); // wheel radius 0.46 m
    prev.current = { x, z };
  });
  return (
    <group ref={g} scale={scale}>
      <Model id={kind === 'rover' ? 'rover' : 'astronaut'} anim={kind === 'walker' ? 'walk' : 'idle'} drive={kind === 'rover' ? spin : undefined} />
    </group>
  );
}

/**
 * Rover parked at the habitat (drives to the ice on an ice trip), the commander's walker, route lines, berm rings.
 * roverTarget / walkTarget: the destination the commander picked (replaces the nearest-PSR / rim default).
 * routeShown: the scene already draws the picked route (dashed), so the thin day-time line is skipped.
 */
export function DayActors({
  frame,
  habitat,
  unit,
  anim,
  ice,
  rim,
  berm,
  roverTarget = null,
  walkTarget = null,
  routeShown = false,
}: {
  frame: TerrainFrame;
  habitat: Slot;
  unit: number;
  anim: MutableRefObject<DayAnim>;
  ice: XZ | null;
  rim: XZ;
  berm: number;
  roverTarget?: XZ | null;
  walkTarget?: XZ | null;
  routeShown?: boolean;
}) {
  const park: XZ = { x: habitat.x + 9 * unit, z: habitat.z + 7 * unit };
  const home: XZ = { x: habitat.x - 7 * unit, z: habitat.z + 8 * unit };
  const rtx = roverTarget?.x;
  const rtz = roverTarget?.z;
  const wtx = walkTarget?.x;
  const wtz = walkTarget?.z;
  const lines = useMemo(() => {
    const out: { key: string; line: ThreeLine; on: (a: DayAnim) => boolean }[] = [];
    if (rtx !== undefined && rtz !== undefined) {
      if (!routeShown) out.push({ key: 'icePicked', line: pathLine(frame, park, { x: rtx, z: rtz }, '#7cc9ff'), on: (a) => a.ice });
    } else if (ice) out.push({ key: 'ice', line: pathLine(frame, park, ice, '#7cc9ff'), on: (a) => a.ice });
    if (wtx !== undefined && wtz !== undefined) {
      if (!routeShown) out.push({ key: 'walkPicked', line: pathLine(frame, home, { x: wtx, z: wtz }, '#ffd24a'), on: (a) => a.walk !== null });
    } else {
      out.push({ key: 'walkRim', line: pathLine(frame, home, rim, '#ffd24a'), on: (a) => a.walk === 'rim' });
      if (ice) out.push({ key: 'walkIce', line: pathLine(frame, home, ice, '#7cc9ff'), on: (a) => a.walk === 'ice' });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, habitat.index, ice, rim, rtx, rtz, wtx, wtz, routeShown]);
  useFrame(() => {
    for (const l of lines) l.line.visible = anim.current.active && l.on(anim.current);
  });
  const roverTo = roverTarget ?? ice ?? park;
  return (
    <>
      <Walker kind="rover" from={park} to={roverTo} frame={frame} scale={unit * 1.6} anim={anim} />
      {walkTarget ? (
        <Walker kind="walker" from={home} to={walkTarget} frame={frame} scale={unit * 2.4} anim={anim} />
      ) : (
        <WalkerSwitch home={home} rim={rim} ice={ice} frame={frame} unit={unit} anim={anim} />
      )}
      {lines.map((l) => (
        <primitive key={l.key} object={l.line} />
      ))}
      <BermRings habitat={habitat} frame={frame} unit={unit} level={berm} />
    </>
  );
}

/** Picks the walk target (rim or ice) from the current plan every frame. */
function WalkerSwitch({ home, rim, ice, frame, unit, anim }: { home: XZ; rim: XZ; ice: XZ | null; frame: TerrainFrame; unit: number; anim: MutableRefObject<DayAnim> }) {
  const rimAnim = useRef<DayAnim>(idleAnim());
  const iceAnim = useRef<DayAnim>(idleAnim());
  useFrame(() => {
    const a = anim.current;
    rimAnim.current = a.walk === 'rim' ? a : idleAnim();
    iceAnim.current = a.walk === 'ice' ? a : idleAnim();
  });
  return (
    <>
      <Walker kind="walker" from={home} to={rim} frame={frame} scale={unit * 2.4} anim={rimAnim} />
      {ice && <Walker kind="walker" from={home} to={ice} frame={frame} scale={unit * 2.4} anim={iceAnim} />}
    </>
  );
}

const bermMats: MeshStandardMaterial[] = [];
function bermMat(i: number): MeshStandardMaterial {
  let m = bermMats[i];
  if (!m) {
    const t = withRepeat(regolithTexture(), 14, 2);
    m = new MeshStandardMaterial({ color: ['#6d6a66', '#78746f', '#847f79'][i], map: t, bumpMap: t, bumpScale: 3, roughness: 1 });
    bermMats[i] = m;
  }
  return m;
}

/** Regolith shield: one lumpy ring of heaped soil per level. */
export function BermRings({ habitat, frame, unit, level }: { habitat: Slot; frame: TerrainFrame; unit: number; level: number }) {
  const y = frame.groundY(habitat.x, habitat.z);
  return (
    <group position={[habitat.x, y, habitat.z]} dispose={null}>
      {Array.from({ length: Math.min(3, level) }, (_, i) => (
        <mesh
          key={i}
          geometry={lumpyTorus(unit * (6.2 + i * 1.8), unit * 1.1, i + 1)}
          material={bermMat(i)}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, unit * (0.5 + i * 0.9), 0]}
          scale={[1, 1, 0.85]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

/** A warm glow over each solar tower while it is in sunlight (visual: lit for the part of the day its real sunlit % says). */
export function TowerGlows({ towers, frame, unit, timeRef, litOf }: { towers: Slot[]; frame: TerrainFrame; unit: number; timeRef: MutableRefObject<TimeState>; litOf: (slotIndex: number) => number }) {
  const sky = useSky();
  const tex = useMemo(glowTex, []);
  const sprites = useRef<(Sprite | null)[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    towers.forEach((s, i) => {
      const sp = sprites.current[i];
      if (!sp) return;
      const lit = litOf(s.index);
      const on = sky.current.sunEl > 0 && Math.abs(t.hour - 12) <= (12 * lit) / 100 ? 1 : 0;
      const m = sp.material;
      m.opacity += (on - m.opacity) * 0.15;
      sp.visible = m.opacity > 0.02;
    });
  });
  return (
    <>
      {towers.map((s, i) => (
        <sprite key={s.index} ref={(el) => (sprites.current[i] = el)} position={[s.x, frame.groundY(s.x, s.z) + 10 * unit, s.z]} scale={[unit * 22, unit * 22, 1]} renderOrder={8}>
          <spriteMaterial map={tex} blending={AdditiveBlending} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}

