import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Model } from './models/Model';
import { PatiSprite } from './models/PatiSprite';
import type { PlacedBuilding, Slot, TerrainFrame } from './types';

function PopIn({ children }: { children: React.ReactNode }) {
  const g = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!g.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt * 2.5);
    const x = t.current;
    const k = 1 + 0.15 * Math.sin(x * Math.PI) * (1 - x); // small overshoot
    g.current.scale.setScalar(Math.max(0.001, x * k));
  });
  return <group ref={g} scale={0.001}>{children}</group>;
}

const TAP_MS = 250;
const TAP_PX = 8;
const FLASH_S = 0.9;

/**
 * Placed buildings. When `onTap` is given a short tap (not a drag) on a building calls it and shows a brief gold ring;
 * the tap does not reach the ground behind it.
 */
export function Buildings({
  placed,
  slots,
  frame,
  unit,
  onTap,
  batteryFill = 0.5,
  scales,
}: {
  placed: PlacedBuilding[];
  slots: Slot[];
  frame: TerrainFrame;
  unit: number;
  onTap?: (b: { id: string; slotIndex: number }) => void;
  batteryFill?: number;
  /** extra size factor per building id (explore mode shrinks the solar towers) */
  scales?: Partial<Record<string, number>>;
}) {
  const down = useRef<{ t: number; x: number; y: number } | null>(null);
  const flash = useRef<{ x: number; y: number; z: number; t: number } | null>(null);
  const ring = useRef<Mesh>(null);
  useFrame((_, dt) => {
    const m = ring.current;
    const f = flash.current;
    if (!m) return;
    if (!f) {
      m.visible = false;
      return;
    }
    f.t += dt;
    const u = f.t / FLASH_S;
    if (u >= 1) {
      flash.current = null;
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.set(f.x, f.y, f.z);
    m.scale.setScalar(1 + u * 0.5);
    (m.material as MeshBasicMaterial).opacity = 0.9 * (1 - u);
  });
  return (
    <>
      {placed.map((p) => {
        const s = slots[p.slotIndex];
        const y = frame.groundY(s.x, s.z);
        const handlers = onTap
          ? {
              onPointerDown: (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                down.current = e.nativeEvent.isPrimary ? { t: performance.now(), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } : null;
              },
              onPointerUp: (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                const d = down.current;
                down.current = null;
                if (!d || !e.nativeEvent.isPrimary) return;
                if (performance.now() - d.t > TAP_MS || Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > TAP_PX) return;
                flash.current = { x: s.x, y: y + frame.cell * 0.3, z: s.z, t: 0 };
                onTap({ id: p.id, slotIndex: p.slotIndex });
              },
            }
          : {};
        return (
          <group key={`${p.id}-${p.slotIndex}`} position={[s.x, y, s.z]} scale={unit * (scales?.[p.id] ?? 1)} rotation={[0, (p.slotIndex * 0.9) % 6.28, 0]} {...handlers}>
            <PopIn>
              <Model id={p.id} fill={p.id === 'batteryUnit' ? batteryFill : undefined} />
            </PopIn>
          </group>
        );
      })}
      <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
        <ringGeometry args={[unit * 5.2, unit * 6, 48]} />
        <meshBasicMaterial color="#ffd24a" transparent opacity={0.9} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
/** The commander and Pati, standing next to the lander. */
export function Crew({ slot, frame, unit }: { slot: Slot; frame: TerrainFrame; unit: number }) {
  const ax = slot.x + 7 * unit;
  const az = slot.z + 3 * unit;
  const px = slot.x + 8.6 * unit;
  const pz = slot.z + 4.4 * unit;
  return (
    <>
      <group position={[ax, frame.groundY(ax, az), az]} scale={unit} rotation={[0, -0.6, 0]}>
        <Model id="astronaut" />
      </group>
      <group position={[px, frame.groundY(px, pz), pz]} scale={unit} rotation={[0, -0.9, 0]}>
        <PatiSprite anim="wag" />
      </group>
    </>
  );
}


