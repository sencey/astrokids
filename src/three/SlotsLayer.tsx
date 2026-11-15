import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { Slot, TerrainFrame } from './types';

const S = 4; // sub-quads per slot edge, so the square drapes over the terrain
const VERTS = (S + 1) * (S + 1);
const TRIS = S * S * 2;

const GREEN: [number, number, number] = [0.15, 0.95, 0.35];
const RED: [number, number, number] = [0.95, 0.15, 0.15];
const GREY: [number, number, number] = [0.45, 0.45, 0.5];

export interface SlotsLayerProps {
  slots: Slot[];
  frame: TerrainFrame;
  occupied: Set<number>;
  hover: number | null;
  selected: number | null;
  onHover: (i: number | null) => void;
  onTap: (i: number) => void;
}

/** One merged mesh for all 256 slots: cheap to draw, and raycasts by face index -> slot. */
export function SlotsLayer({ slots, frame, occupied, hover, selected, onHover, onTap }: SlotsLayerProps) {
  const geom = useMemo(() => {
    const pos = new Float32Array(slots.length * VERTS * 3);
    const col = new Float32Array(slots.length * VERTS * 3);
    const idx = new Uint32Array(slots.length * TRIS * 3);
    const lift = frame.cell * 0.5;
    slots.forEach((s, si) => {
      const w = s.cells * frame.cell * 0.9;
      for (let j = 0; j <= S; j++) {
        for (let i = 0; i <= S; i++) {
          const x = s.x + (i / S - 0.5) * w;
          const z = s.z + (j / S - 0.5) * w;
          const v = (si * VERTS + j * (S + 1) + i) * 3;
          pos[v] = x;
          pos[v + 1] = frame.groundY(x, z) + lift;
          pos[v + 2] = z;
        }
      }
      let k = si * TRIS * 3;
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          const a = si * VERTS + j * (S + 1) + i;
          const b = a + 1;
          const d = a + S + 1;
          const e = d + 1;
          idx[k++] = a;
          idx[k++] = d;
          idx[k++] = b;
          idx[k++] = b;
          idx[k++] = d;
          idx[k++] = e;
        }
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setIndex(new BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }, [slots, frame]);

  useEffect(() => {
    const a = geom.getAttribute('color') as BufferAttribute;
    const arr = a.array as Float32Array;
    slots.forEach((s, si) => {
      const ok = s.buildable && !occupied.has(s.index);
      const base = occupied.has(s.index) ? GREY : ok ? GREEN : RED;
      const boost = s.index === selected ? 1.6 : s.index === hover ? 1.35 : 0.75;
      for (let v = 0; v < VERTS; v++) {
        const o = (si * VERTS + v) * 3;
        arr[o] = Math.min(1, base[0] * boost);
        arr[o + 1] = Math.min(1, base[1] * boost);
        arr[o + 2] = Math.min(1, base[2] * boost);
      }
    });
    a.needsUpdate = true;
  }, [geom, slots, occupied, hover, selected]);

  const slotOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.faceIndex == null ? null : Math.floor(e.faceIndex / TRIS));

  return (
    <mesh
      geometry={geom}
      renderOrder={5}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(slotOf(e));
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        const i = slotOf(e);
        if (i != null) onTap(i);
      }}
    >
      <meshBasicMaterial vertexColors transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
    </mesh>
  );
}
