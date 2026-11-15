import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { evaluateDestination } from './destinationRules';
import { prefersReducedMotion } from './motion';
import type { XZ } from './slots';
import type { Slot, TerrainData, TerrainFrame } from './types';

/** Valid destination cells glow (cyan = ice, gold = walk); everything else stays untouched. One draped mesh near the habitat. */
export function DestinationLayer({ mode, data, frame, slots, from }: { mode: 'walk' | 'ice'; data: TerrainData; frame: TerrainFrame; slots: Slot[]; from: XZ }) {
  const geom = useMemo(() => {
    const n = data.n;
    const cell = frame.cell;
    const limit = mode === 'ice' ? 3000 : 2000;
    const R = Math.ceil(limit / cell) + 1;
    const cx = Math.round(from.x / cell + (n - 1) / 2);
    const cy = Math.round(from.z / cell + (n - 1) / 2);
    const c0 = Math.max(0, cx - R);
    const c1 = Math.min(n - 1, cx + R);
    const r0 = Math.max(0, cy - R);
    const r1 = Math.min(n - 1, cy + R);
    const w = c1 - c0 + 1;
    const h = r1 - r0 + 1;
    const pos = new Float32Array(w * h * 3);
    const col = new Float32Array(w * h * 4);
    const rgb = mode === 'ice' ? [0.3, 0.82, 1] : [1, 0.82, 0.3];
    const lift = cell * 0.35;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = (r - r0) * w + (c - c0);
        const x = (c - (n - 1) / 2) * cell;
        const z = (r - (n - 1) / 2) * cell;
        pos[i * 3] = x;
        pos[i * 3 + 1] = (data.height[r * n + c] - frame.baseH) * frame.exag + lift;
        pos[i * 3 + 2] = z;
        const ok = evaluateDestination(data, frame, slots, from, mode, x, z).ok;
        col[i * 4] = rgb[0];
        col[i * 4 + 1] = rgb[1];
        col[i * 4 + 2] = rgb[2];
        col[i * 4 + 3] = ok ? 0.6 : 0;
      }
    }
    const idx = new Uint32Array((w - 1) * (h - 1) * 6);
    let k = 0;
    for (let r = 0; r < h - 1; r++) {
      for (let c = 0; c < w - 1; c++) {
        const a = r * w + c;
        const b = a + 1;
        const d = a + w;
        const e = d + 1;
        idx[k++] = a;
        idx[k++] = d;
        idx[k++] = b;
        idx[k++] = b;
        idx[k++] = d;
        idx[k++] = e;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 4));
    g.setIndex(new BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }, [mode, data, frame, slots, from.x, from.z]);
  useEffect(() => () => geom.dispose(), [geom]);

  const mat = useRef<MeshBasicMaterial>(null);
  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = still ? 0.85 : 0.72 + 0.2 * Math.sin(clock.getElapsedTime() * 2.4);
  });
  return (
    <mesh geometry={geom} renderOrder={4}>
      <meshBasicMaterial ref={mat} vertexColors transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-3} toneMapped={false} />
    </mesh>
  );
}

/** Dashed route draped on the ground from the habitat to the picked target, plus a marker ring at the target. */
export function RouteLine({ frame, from, to, unit }: { frame: TerrainFrame; from: XZ; to: [number, number, number]; unit: number }) {
  const pts = useMemo(() => {
    const dist = Math.hypot(to[0] - from.x, to[2] - from.z);
    const N = Math.max(2, Math.ceil(dist / frame.cell));
    const out: [number, number, number][] = [];
    for (let i = 0; i <= N; i++) {
      const x = from.x + ((to[0] - from.x) * i) / N;
      const z = from.z + ((to[2] - from.z) * i) / N;
      out.push([x, frame.groundY(x, z) + frame.cell * 0.45, z]);
    }
    return out;
  }, [frame, from.x, from.z, to]);
  const ty = frame.groundY(to[0], to[2]) + frame.cell * 0.45;
  return (
    <>
      <Line points={pts} color="#fff3c4" lineWidth={3} dashed dashSize={frame.cell * 1.1} gapSize={frame.cell * 0.8} transparent opacity={0.95} depthTest={false} renderOrder={9} />
      <mesh position={[to[0], ty, to[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[unit * 2.2, unit * 3, 32]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[to[0], ty, to[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <circleGeometry args={[unit * 1, 20]} />
        <meshBasicMaterial color="#fff3c4" transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export type Ping = (x: number, z: number, kind: 'ok' | 'bad') => void;

/** A brief ground ripple where the child tapped (cyan), or a small red cross when the spot is not allowed. Sized by camera distance. */
export function GroundFx({ pingRef, frame }: { pingRef: MutableRefObject<Ping | null>; frame: TerrainFrame }) {
  const camera = useThree((s) => s.camera);
  const grp = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const cross = useRef<Group>(null);
  const ringMat = useRef<MeshBasicMaterial>(null);
  const crossMat = useMemo(() => new MeshBasicMaterial({ color: '#ff6b5b', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }), []);
  const st = useRef({ t: 99, x: 0, z: 0, r: 1, bad: false });
  const still = useMemo(prefersReducedMotion, []);
  const DUR = 0.8;
  useEffect(() => {
    pingRef.current = (x, z, kind) => {
      const y = frame.groundY(x, z);
      const d = camera.position.distanceTo(new Vector3(x, y, z));
      st.current = { t: 0, x, z, r: Math.max(frame.cell * 0.8, d * 0.03), bad: kind === 'bad' };
    };
    return () => {
      pingRef.current = null;
    };
  }, [pingRef, camera, frame]);
  useFrame((_, dt) => {
    const g = grp.current;
    if (!g) return;
    const s = st.current;
    s.t += dt;
    if (s.t > DUR) {
      g.visible = false;
      return;
    }
    const k = s.t / DUR;
    g.visible = true;
    g.position.set(s.x, frame.groundY(s.x, s.z) + frame.cell * 0.4, s.z);
    const e = 1 - (1 - k) * (1 - k);
    const sc = s.r * (still ? 1 : 0.4 + 0.9 * e);
    ring.current?.scale.set(sc, sc, sc);
    if (cross.current) cross.current.scale.setScalar(s.r * 0.8);
    if (ring.current) ring.current.visible = !s.bad;
    if (cross.current) cross.current.visible = s.bad;
    const o = (1 - k) * (1 - k) * 0.95;
    if (ringMat.current) ringMat.current.opacity = o;
    crossMat.opacity = o;
  });
  return (
    <group ref={grp} visible={false} renderOrder={10}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.78, 1, 40]} />
        <meshBasicMaterial ref={ringMat} color="#bff0ff" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={cross} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        {[Math.PI / 4, -Math.PI / 4].map((a) => (
          <mesh key={a} rotation={[0, 0, a]} renderOrder={10}>
            <planeGeometry args={[1.6, 0.28]} />
            <primitive object={crossMat} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

