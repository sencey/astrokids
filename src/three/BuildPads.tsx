// Build-in-the-world: glowing pads on free, gentle slots near the commander (tinted by TODAY's sunlight) and the short "crate lands, structure rises" animation.
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, MeshBasicMaterial } from 'three';
import type { Group, Mesh } from 'three';
import type { BuildKind } from './exploreTypes';
import { Model } from './models/Model';
import type { DustEmit } from './Dust';
import type { Slot, TerrainFrame } from './types';

/** Extra reach (metres) beyond the commander's own slot: pads of slots whose centre is within BUILD_REACH_M + one slot edge are shown. */
export const BUILD_REACH_M = 500;
const SEG = 8;
const TAP_MS = 250;
const TAP_PX = 8;

const DARK = new Color('#6a86ad');
const SUNNY = new Color('#ffcb2e');
const tint = (pct: number, out: Color) => out.copy(DARK).lerp(SUNNY, Math.max(0, Math.min(1, pct / 100)));

let padTex: CanvasTexture | null = null;
/** soft disc with a brighter rim */
function padTexture(): CanvasTexture {
  if (padTex) return padTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.4)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.95, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return (padTex = new CanvasTexture(c));
}

/** a square patch draped over the terrain (so slopes do not cut it), uv 0..1 */
function drapedPatch(frame: TerrainFrame, cx: number, cz: number, half: number): BufferGeometry {
  const V = (SEG + 1) * (SEG + 1);
  const pos = new Float32Array(V * 3);
  const uv = new Float32Array(V * 2);
  const idx: number[] = [];
  const lift = frame.cell * 0.45;
  for (let j = 0; j <= SEG; j++) {
    for (let i = 0; i <= SEG; i++) {
      const x = cx + (i / SEG - 0.5) * 2 * half;
      const z = cz + (j / SEG - 0.5) * 2 * half;
      const k = j * (SEG + 1) + i;
      pos[k * 3] = x;
      pos[k * 3 + 1] = frame.groundY(x, z) + lift;
      pos[k * 3 + 2] = z;
      uv[k * 2] = i / SEG;
      uv[k * 2 + 1] = 1 - j / SEG;
    }
  }
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i;
      idx.push(a, a + SEG + 1, a + 1, a + 1, a + SEG + 1, a + SEG + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function Pad({ slot, frame, half, pct, label, onPick }: { slot: Slot; frame: TerrainFrame; half: number; pct: number; label: boolean; onPick: (i: number) => void }) {
  const geom = useMemo(() => drapedPatch(frame, slot.x, slot.z, half), [frame, slot.x, slot.z, half]);
  const mat = useMemo(() => new MeshBasicMaterial({ map: padTexture(), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }), []);
  useEffect(() => {
    tint(pct, mat.color);
  }, [pct, mat]);
  useEffect(
    () => () => {
      geom.dispose();
      mat.dispose();
    },
    [geom, mat],
  );
  const mesh = useRef<Mesh>(null);
  const down = useRef<{ t: number; x: number; y: number } | null>(null);
  useFrame(({ clock }) => {
    mat.opacity = 0.62 + 0.18 * Math.sin(clock.getElapsedTime() * 2.4 + slot.index); // slow breathing, ~0.4 Hz
  });
  return (
    <>
      <mesh
        ref={mesh}
        geometry={geom}
        material={mat}
        renderOrder={6}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          down.current = e.nativeEvent.isPrimary ? { t: performance.now(), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } : null;
        }}
        onPointerUp={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const d = down.current;
          down.current = null;
          if (!d || !e.nativeEvent.isPrimary) return;
          if (performance.now() - d.t > TAP_MS || Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > TAP_PX) return;
          onPick(slot.index);
        }}
      />
      {label && (
        <Html position={[slot.x, frame.groundY(slot.x, slot.z) + half * 0.5, slot.z]} center zIndexRange={[12, 0]} style={{ pointerEvents: 'none' }}>
          <span
            style={{
              background: 'rgba(8,12,26,.82)',
              color: '#ffd24a',
              border: '2px solid #ffd24a',
              borderRadius: 999,
              padding: '1px 8px',
              fontWeight: 800,
              fontSize: 12,
              whiteSpace: 'nowrap',
              display: 'block',
              transform: 'translateY(-60%)',
            }}
          >
            {'☀'} {Math.round(pct)}%
          </span>
        </Html>
      )}
    </>
  );
}

export interface BuildPadsProps {
  slots: Slot[];
  frame: TerrainFrame;
  occupied: Set<number>;
  /** today's sunlit share (0..100) of a slot */
  litOf: (slotIndex: number) => number;
  /** live commander position */
  getPos: () => [number, number];
  /** slot that holds the lander / habitat: never offered */
  baseXZ: { x: number; z: number };
  /** hide all pads (while a build is running) */
  hidden: boolean;
  onPick: (slotIndex: number) => void;
}

/** Pads on buildable, free slots near the commander. Re-evaluated about 4x a second. The 3 sunniest get a "% sun" label. */
export function BuildPads({ slots, frame, occupied, litOf, getPos, baseXZ, hidden, onPick }: BuildPadsProps) {
  const half = padHalf(slots, frame);
  const [list, setList] = useState<number[]>([]);
  const keyRef = useRef('');
  const clock = useRef(1);
  const compute = () => {
    const [px, pz] = getPos();
    const c = choosePads(scanPads(slots, frame, occupied, baseXZ, px, pz, PADS_REACH_M, litOf)).map((o) => o.i);
    const k = c.join(',');
    if (k !== keyRef.current) {
      keyRef.current = k;
      setList(c);
    }
  };
  useEffect(() => {
    keyRef.current = '\u0000';
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, occupied, baseXZ.x, baseXZ.z]);
  useFrame((_, dt) => {
    clock.current += dt;
    if (clock.current < 0.25) return;
    clock.current = 0;
    compute();
  });
  const top = useMemo(
    () =>
      new Set(
        [...list]
          .sort((a, b) => litOf(b) - litOf(a))
          .slice(0, 3)
          .map((i) => i),
      ),
    [list, litOf],
  );
  if (hidden) return null;
  return (
    <>
      {list.map((i) => (
        <Pad key={i} slot={slots[i]} frame={frame} half={half} pct={litOf(i)} label={top.has(i)} onPick={onPick} />
      ))}
    </>
  );
}

/** Half-width of a pad (metres): readable next to a 90 m commander even on the fine world grid; the commander must end inside 0.8 of it for the build to start. */
export const padHalf = (slots: Slot[], frame: TerrainFrame): number => {
  const edge = slots[0].cells * frame.cell;
  return Math.min(Math.max(edge * 0.2, 110), Math.min(240, edge * 0.46));
};

/** Sunlit share (today) from which a pad counts as sunny (gold). */
export const SUNNY_PCT = 30;
export interface PadCand {
  i: number;
  d: number;
  pct: number;
}

/** Every free, buildable slot within `reach` metres of (px,pz) with today's sunlight. Never offers the base slot. */
export function scanPads(slots: Slot[], frame: TerrainFrame, occupied: Set<number>, baseXZ: { x: number; z: number }, px: number, pz: number, reach: number, litOf: (i: number) => number): PadCand[] {
  const edge = slots[0].cells * frame.cell;
  const out: PadCand[] = [];
  const r2 = reach * reach;
  const b2 = (edge * 0.45) ** 2;
  for (let j = 0; j < slots.length; j++) {
    const s = slots[j];
    if (!s.buildable || occupied.has(s.index)) continue;
    const dx = s.x - px;
    const dz = s.z - pz;
    const q = dx * dx + dz * dz;
    if (q > r2) continue;
    if ((s.x - baseXZ.x) ** 2 + (s.z - baseXZ.z) ** 2 <= b2) continue;
    out.push({ i: s.index, d: Math.sqrt(q), pct: litOf(s.index) || 0 });
  }
  return out;
}

/** The pads to show: up to 6 sunniest sunny ones (sunniest first); when fewer than 3 are sunny, add up to 2 nearest dark ones. */
export function choosePads(all: PadCand[]): PadCand[] {
  const sunny = all.filter((c) => c.pct >= SUNNY_PCT).sort((a, b) => b.pct - a.pct || a.d - b.d).slice(0, 6);
  if (sunny.length >= 3) return sunny;
  const dark = all.filter((c) => c.pct < SUNNY_PCT).sort((a, b) => a.d - b.d).slice(0, 2);
  return [...sunny, ...dark];
}

/** For the UI's guide line: how many sunny pads are within 1.6 km, and the best one within 3 km. */
export interface PadsInfo {
  sunnyCount: number;
  bestLitPct: number;
  bestDistanceM: number;
}
export function padsInfo(scan3km: PadCand[]): PadsInfo {
  const sunnyCount = scan3km.filter((c) => c.d <= PADS_REACH_M && c.pct >= SUNNY_PCT).length;
  let best: PadCand | null = null;
  for (const c of scan3km) if (!best || c.pct > best.pct + 1e-9 || (Math.abs(c.pct - best.pct) < 1e-9 && c.d < best.d)) best = c;
  return { sunnyCount, bestLitPct: best ? Math.round(best.pct) : 0, bestDistanceM: best ? Math.round(best.d) : 0 };
}
/** Pads are chosen among free buildable slots within this distance of the commander. */
export const PADS_REACH_M = 1600;
export const PADS_FAR_M = 3000;

// ---------------------------------------------------------------- the build animation (~1.2 s)

export interface BuildJob {
  id: number;
  kind: BuildKind;
  slotIndex: number;
  x: number;
  z: number;
}
const easeOutBack = (u: number) => 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);

export function BuildFx({
  job,
  frame,
  unit,
  towerK,
  dust,
  onBuilt,
  onGone,
}: {
  job: BuildJob;
  frame: TerrainFrame;
  unit: number;
  towerK: number;
  dust: MutableRefObject<DustEmit | null>;
  onBuilt: () => void;
  onGone: () => void;
}) {
  const crate = useRef<Group>(null);
  const struct = useRef<Group>(null);
  const st = useRef({ t: 0, landed: false, done: false, gone: false, puffs: 0 });
  const y = frame.groundY(job.x, job.z);
  const k = unit * (job.kind === 'solarTower' ? towerK : 1);
  useFrame((_, dtRaw) => {
    const s = st.current;
    s.t += Math.min(dtRaw, 0.05);
    const t = s.t;
    const fall = Math.min(1, t / 0.4);
    if (crate.current) {
      crate.current.position.y = (1 - fall * fall) * 60 * unit;
      const shrink = t < 0.4 ? 1 : Math.max(0, 1 - (t - 0.4) / 0.5);
      crate.current.scale.set(1 + (t >= 0.4 && t < 0.55 ? 0.25 : 0), shrink * (t >= 0.4 && t < 0.55 ? 0.8 : 1), 1 + (t >= 0.4 && t < 0.55 ? 0.25 : 0));
      crate.current.visible = shrink > 0.001;
    }
    if (!s.landed && t >= 0.4) {
      s.landed = true;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        dust.current?.(job.x + Math.cos(a) * 4 * unit, y + 2, job.z + Math.sin(a) * 4 * unit, unit * 3);
      }
    }
    if (s.puffs < 1 && t >= 1.0) {
      s.puffs = 1;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        dust.current?.(job.x + Math.cos(a) * 5 * unit, y + 2, job.z + Math.sin(a) * 5 * unit, unit * 3.4);
      }
    }
    if (struct.current) {
      const u = Math.max(0, Math.min(1, (t - 0.4) / 0.8));
      struct.current.visible = u > 0;
      struct.current.scale.setScalar(Math.max(0.001, easeOutBack(u)));
      struct.current.position.y = (1 - u) * -2 * unit;
    }
    if (!s.done && t >= 1.2) {
      s.done = true;
      onBuilt();
    }
    if (!s.gone && t >= 1.7) {
      s.gone = true; // the real building (from `placed`) has popped in by now
      onGone();
    }
  });
  return (
    <group position={[job.x, y, job.z]} rotation={[0, (job.slotIndex * 0.9) % 6.28, 0]}>
      <group ref={crate} position={[0, 60 * unit, 0]}>
        <mesh position={[0, 2.5 * unit, 0]} castShadow>
          <boxGeometry args={[5 * unit, 5 * unit, 5 * unit]} />
          <meshStandardMaterial color="#c9a063" roughness={0.8} />
        </mesh>
        <mesh position={[0, 2.5 * unit, 0]}>
          <boxGeometry args={[5.1 * unit, 0.7 * unit, 5.1 * unit]} />
          <meshStandardMaterial color="#ff7a1a" roughness={0.7} />
        </mesh>
      </group>
      <group ref={struct} scale={0.001} visible={false}>
        <group scale={k}>
          <Model id={job.kind} />
        </group>
      </group>
    </group>
  );
}
