import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { isLowTier, useTier } from './config';

export type DustEmit = (x: number, y: number, z: number, size: number) => void;

const N = 40;
const LIFE = 1.1;
const VERT = /* glsl */ `
attribute float aA;
attribute float aS;
uniform float uPx;
varying float vA;
void main() {
  vA = aA;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aS * uPx / max(0.001, -mv.z));
}`;
const FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.66, 0.63, 0.59, a);
}`;

/**
 * Footstep dust: a ring buffer of 40 soft round points drawn as one Points object (one draw call, no textures).
 * `emitRef.current(x, y, z, size)` spawns a puff. Disabled (no-op, nothing rendered) in CONFIG.lowPower.
 */
export function Dust({ emitRef }: { emitRef: MutableRefObject<DustEmit | null> }) {
  const { fx } = useTier();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const sim = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const aA = new Float32Array(N);
    const aS = new Float32Array(N);
    const age = new Float32Array(N).fill(LIFE);
    const base = new Float32Array(N);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aA', new BufferAttribute(aA, 1));
    g.setAttribute('aS', new BufferAttribute(aS, 1));
    const m = new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, uniforms: { uPx: { value: 1 } } });
    const pts = new Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    return { pos, aA, aS, age, base, g, m, pts, next: 0 };
  }, []);

  useEffect(() => {
    if (!fx) {
      emitRef.current = () => {};
      return;
    }
    emitRef.current = (x, y, z, size) => {
      const i = sim.next;
      sim.next = (i + 1) % N;
      sim.pos[i * 3] = x;
      sim.pos[i * 3 + 1] = y;
      sim.pos[i * 3 + 2] = z;
      sim.base[i] = size;
      sim.age[i] = 0;
    };
    return () => {
      emitRef.current = null;
    };
  }, [emitRef, sim, fx]);
  useEffect(
    () => () => {
      sim.g.dispose();
      sim.m.dispose();
    },
    [sim],
  );

  useFrame((_, dt) => {
    if (isLowTier()) return;
    let live = false;
    for (let i = 0; i < N; i++) {
      if (sim.age[i] >= LIFE) {
        sim.aA[i] = 0;
        continue;
      }
      live = true;
      sim.age[i] += dt;
      const u = Math.min(1, sim.age[i] / LIFE);
      sim.pos[i * 3 + 1] += dt * sim.base[i] * 0.8; // puffs drift up
      sim.aS[i] = sim.base[i] * (0.7 + 1.5 * u);
      sim.aA[i] = 0.5 * (1 - u) * (1 - u);
    }
    if (!live) return;
    (sim.g.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (sim.g.getAttribute('aA') as BufferAttribute).needsUpdate = true;
    (sim.g.getAttribute('aS') as BufferAttribute).needsUpdate = true;
    // pixels per world unit at distance 1 (device pixels)
    sim.m.uniforms.uPx.value = gl.domElement.height * 0.5 * (camera.projectionMatrix.elements[5] || 1);
  });

  if (!fx) return null;
  return <primitive object={sim.pts} />;
}
