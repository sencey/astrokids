import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial } from 'three';
import type { Group, Mesh } from 'three';
import type { Poi, PoiKind } from '../game/explore/pois';
import { isLowTier } from './config';
import type { TerrainFrame } from './types';

const KIND_COLOR: Record<PoiKind, string> = {
  ice: '#5ec8ff',
  sun: '#ffc933',
  rim: '#ff8a4a',
  earth: '#6fa8ff',
  geology: '#c3a4ff',
  base: '#ffffff',
};
const MUTED = '#7b8594';

let glowTex: CanvasTexture | null = null;
/** soft round falloff, shared by every beacon's ground glow */
function glowTexture(): CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return (glowTex = new CanvasTexture(c));
}
const POP_S = 0.7;

/** Cap shape per kind (the silhouette tells the kinds apart even without colour): 8-100 triangles. */
function Cap({ kind, mat }: { kind: PoiKind; mat: MeshBasicMaterial }) {
  switch (kind) {
    case 'ice':
      return (
        <mesh material={mat} scale={[0.9, 1.3, 0.9]}>
          <octahedronGeometry args={[0.24, 0]} />
        </mesh>
      );
    case 'sun':
      return (
        <mesh material={mat}>
          <sphereGeometry args={[0.24, 8, 6]} />
        </mesh>
      );
    case 'rim':
      return (
        <mesh material={mat}>
          <coneGeometry args={[0.24, 0.5, 6]} />
        </mesh>
      );
    case 'earth':
      return (
        <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.07, 6, 12]} />
        </mesh>
      );
    default:
      return (
        <mesh material={mat} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
        </mesh>
      );
  }
}

/**
 * A science post: pole + flag + kind-shaped cap + a soft ground ring. Muted grey until the commander finds it, then it
 * lights up in the kind's colour with a short pop. Authored in avatar-metres; `scale` is avatarScale.
 */
function Beacon({ poi, y, scale, found }: { poi: Poi; y: number; scale: number; found: MutableRefObject<Set<string>> }) {
  const grp = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const st = useRef({ lit: false, pop: 1, first: true });
  const mats = useMemo(
    () => ({
      flag: new MeshBasicMaterial({ color: MUTED, transparent: true, opacity: 0.8, side: DoubleSide, toneMapped: false }),
      cap: new MeshBasicMaterial({ color: MUTED, toneMapped: false }),
      ring: new MeshBasicMaterial({ color: MUTED, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, toneMapped: false }),
      glow: new MeshBasicMaterial({ map: glowTexture(), color: MUTED, transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    }),
    [],
  );
  const colors = useMemo(() => ({ lit: new Color(KIND_COLOR[poi.kind]), dim: new Color(MUTED) }), [poi.kind]);
  useFrame(({ clock }, dt) => {
    const s = st.current;
    const isLit = found.current.has(poi.id);
    if (isLit !== s.lit) {
      s.lit = isLit;
      s.pop = isLit && !s.first ? 0 : 1; // no pop for ones found in an earlier session
      s.first = false;
      const col = isLit ? colors.lit : colors.dim;
      mats.flag.color.copy(col);
      mats.cap.color.copy(col);
      mats.ring.color.copy(col);
      mats.glow.color.copy(col);
      mats.glow.opacity = isLit ? 0.85 : 0.35;
      mats.ring.opacity = isLit ? 0.85 : 0.4;
      mats.flag.opacity = isLit ? 1 : 0.8;
    }
    s.first = false;
    if (s.pop < 1) s.pop = Math.min(1, s.pop + dt / POP_S);
    grp.current?.scale.setScalar(scale * (1 + 0.35 * Math.sin(s.pop * Math.PI)));
    if (ring.current && s.lit && !isLowTier()) ring.current.scale.setScalar(1 + 0.07 * Math.sin(clock.getElapsedTime() * 2.2));
  });
  return (
    <group ref={grp} position={[poi.x, y, poi.z]} scale={scale}>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 2.5, 6]} />
        <meshBasicMaterial color="#d9dee8" toneMapped={false} />
      </mesh>
      <mesh position={[0.48, 2.12, 0]} material={mats.flag}>
        <planeGeometry args={[0.9, 0.55]} />
      </mesh>
      <group position={[0, 2.78, 0]}>
        <Cap kind={poi.kind} mat={mats.cap} />
      </group>
      <mesh position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} material={mats.glow}>
        <circleGeometry args={[3.4, 24]} />
      </mesh>
      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={8} material={mats.ring}>
        <ringGeometry args={[1.15, 1.4, 40]} />
      </mesh>
    </group>
  );
}

export function PoiBeacons({ pois, frame, found, scale }: { pois: Poi[]; frame: TerrainFrame; found: MutableRefObject<Set<string>>; scale: number }) {
  return (
    <>
      {pois
        .filter((p) => p.kind !== 'base')
        .map((p) => (
          <Beacon key={p.id} poi={p} y={frame.groundY(p.x, p.z)} scale={scale} found={found} />
        ))}
    </>
  );
}
