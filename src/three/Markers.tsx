import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { AdditiveBlending, DoubleSide } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import type { Slot, TerrainData, TerrainFrame } from './types';

const pill: CSSProperties = {
  pointerEvents: 'none',
  background: 'rgba(8,12,26,.88)',
  color: '#fff',
  border: '2px solid #ffd24a',
  borderRadius: 999,
  padding: '3px 10px',
  fontWeight: 800,
  fontSize: 13,
  whiteSpace: 'nowrap',
  transform: 'translateY(-100%)',
};

/** Pulsing ground ring + small floating label so the base is findable from the 18 km overview. */
export function BaseBeacon({ slot, frame, unit, label, alarm = false, labelUp = 22 }: { slot: Slot; frame: TerrainFrame; unit: number; label: string; alarm?: boolean; labelUp?: number }) {
  const ring = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const R = Math.max(slot.cells * frame.cell * 0.55, 150);
  const y = frame.groundY(slot.x, slot.z) + frame.cell * 0.4;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // alarm: brighter, wider and a light column so the way home is visible from far away (2 Hz, well under the flash limit)
    const f = alarm ? 2 * Math.PI * 1.6 : 3;
    const k = 1 + (alarm ? 0.3 : 0.18) * Math.sin(t * f);
    ring.current?.scale.setScalar(k);
    const m = ring.current?.material as MeshBasicMaterial | undefined;
    m?.setValues({ opacity: alarm ? 0.8 + 0.2 * Math.sin(t * f) : 0.55 + 0.4 * Math.sin(t * 3) });
    m?.color.set(alarm ? '#fff3b0' : '#ffd24a');
    if (beam.current) {
      beam.current.visible = alarm;
      if (alarm) (beam.current.material as MeshBasicMaterial).opacity = 0.3 + 0.15 * Math.sin(t * f);
    }
  });
  return (
    <group position={[slot.x, y, slot.z]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[R * 0.82, R, 48]} />
        <meshBasicMaterial color="#ffd24a" transparent opacity={0.8} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={beam} visible={false} position={[0, R * 1.6, 0]} renderOrder={8}>
        <cylinderGeometry args={[R * 0.1, R * 0.2, R * 3.2, 16, 1, true]} />
        <meshBasicMaterial color="#fff3b0" transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
      </mesh>
      <Html position={[0, labelUp * unit, 0]} center zIndexRange={[10, 0]} style={pill}>
        {label}
      </Html>
    </group>
  );
}

/** Flag at the geographic south pole (clamped to the map edge with an arrow when it lies outside the grid). */
export function PoleMarker({ data, frame, label }: { data: TerrainData; frame: TerrainFrame; label: string }) {
  const p = data.meta.poleGridPosition;
  if (!p) return null;
  const half = (data.n - 1) / 2;
  const inset = 3;
  const col = Math.max(inset, Math.min(data.n - 1 - inset, p.col));
  const row = Math.max(inset, Math.min(data.n - 1 - inset, p.row));
  const outside = col !== p.col || row !== p.row;
  const x = (col - half) * frame.cell;
  const z = (row - half) * frame.cell;
  const y = frame.groundY(x, z);
  const H = frame.cell * 12;
  // ▲ up, ▼ down, ◀ left, ▶ right
  const arrow = outside ? (row !== p.row && p.row < 0 ? '▲ ' : row !== p.row ? '▼ ' : col !== p.col && p.col < 0 ? '◀ ' : '▶ ') : '';
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, H / 2, 0]}>
        <cylinderGeometry args={[frame.cell * 0.12, frame.cell * 0.12, H, 6]} />
        <meshBasicMaterial color="#e8eefc" toneMapped={false} />
      </mesh>
      <mesh position={[frame.cell * 1.6, H * 0.85, 0]}>
        <boxGeometry args={[frame.cell * 3.2, frame.cell * 1.8, frame.cell * 0.1]} />
        <meshBasicMaterial color="#3fb6ff" toneMapped={false} />
      </mesh>
      {/* the HUD hides this label on narrow screens (.m3d-pole-label) so it never sits under the gear buttons */}
      <Html className="m3d-pole-label" position={[0, H * 1.05, 0]} center zIndexRange={[10, 0]} style={{ ...pill, border: '2px solid #3fb6ff', fontSize: 12 }}>
        {arrow}
        {label}
      </Html>
    </group>
  );
}
