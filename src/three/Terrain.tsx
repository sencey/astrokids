import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { terrainDetailTexture } from './models/proc';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RedFormat,
  UnsignedByteType,
} from 'three';
import type { Texture, Vector3 } from 'three';
import { useTier } from './config';
import type { TerrainData, TerrainFrame } from './types';

export interface Overlays {
  sun: boolean;
  ice: boolean;
}

/**
 * Terrain mesh. `step` > 1 decimates the render mesh (256 -> 128 for step 2) by sampling the full-resolution
 * height grid (normals still come from the full-res data); the gameplay data (frame.groundY, slots, ...) is untouched.
 * `src[j]` maps mesh vertex j to its full-res cell index (for the overlay colours).
 */
function buildGeometry(d: TerrainData, f: TerrainFrame, step: number): { g: BufferGeometry; src: Uint32Array } {
  const n = d.n;
  const m = step <= 1 ? n : Math.max(2, Math.round(n / step));
  const at0 = (k: number) => (step <= 1 ? k : Math.round((k * (n - 1)) / (m - 1)));
  const pos = new Float32Array(m * m * 3);
  const nor = new Float32Array(m * m * 3);
  const col = new Float32Array(m * m * 3);
  const src = new Uint32Array(m * m);
  const h = d.height;
  const at = (r: number, c: number) => h[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))];
  for (let rm = 0; rm < m; rm++) {
    const r = at0(rm);
    for (let cm = 0; cm < m; cm++) {
      const c = at0(cm);
      const i3 = rm * m + cm;
      const i = r * n + c;
      src[i3] = i;
      const o = i3 * 3;
      pos[o] = (c - (n - 1) / 2) * f.cell;
      pos[o + 1] = (h[i] - f.baseH) * f.exag;
      pos[o + 2] = (r - (n - 1) / 2) * f.cell;
      const gx = ((at(r, c + 1) - at(r, c - 1)) * f.exag) / (2 * f.cell);
      const gz = ((at(r + 1, c) - at(r - 1, c)) * f.exag) / (2 * f.cell);
      const l = Math.hypot(gx, 1, gz);
      nor[o] = -gx / l;
      nor[o + 1] = 1 / l;
      nor[o + 2] = -gz / l;
      // regolith grey with soft mottling, fading to black toward the map edge so the patch melts into space
      const mott = 0.5 + 0.5 * Math.sin(c * 0.37 + Math.sin(r * 0.23) * 2) * Math.sin(r * 0.31 + c * 0.05);
      const slope = Math.min(1, Math.hypot(gx, gz) * 1.2); // steep ground is a touch brighter (fresher regolith)
      const g = 0.2 + 0.05 * mott + 0.035 * slope + 0.02 * Math.sin(c * 1.7) * Math.sin(r * 2.1);
      const ex = Math.abs(c / (n - 1) - 0.5) * 2;
      const ey = Math.abs(r / (n - 1) - 0.5) * 2;
      const edge = Math.max(0, Math.min(1, (1 - Math.max(ex, ey)) / 0.1));
      col[o] = g * 1.03 * edge;
      col[o + 1] = g * 1.0 * edge;
      col[o + 2] = g * 0.95 * edge;
    }
  }
  const idx = new Uint32Array((m - 1) * (m - 1) * 6);
  let k = 0;
  for (let r = 0; r < m - 1; r++) {
    for (let c = 0; c < m - 1; c++) {
      const a = r * m + c;
      const b = a + 1;
      const dd = a + m;
      const e = dd + 1;
      idx[k++] = a;
      idx[k++] = dd;
      idx[k++] = b;
      idx[k++] = b;
      idx[k++] = dd;
      idx[k++] = e;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aOverlay', new BufferAttribute(new Float32Array(m * m * 4), 4));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return { g, src };
}

/** dark navy -> orange-brown -> gold */
function sunRamp(p: number, out: number[]): void {
  const t = Math.max(0, Math.min(1, p / 100));
  if (t < 0.5) {
    const u = t / 0.5;
    out[0] = 0.04 + u * 0.55;
    out[1] = 0.05 + u * 0.22;
    out[2] = 0.14 - u * 0.1;
  } else {
    const u = (t - 0.5) / 0.5;
    out[0] = 0.59 + u * 0.41;
    out[1] = 0.27 + u * 0.6;
    out[2] = 0.04 + u * 0.1;
  }
}

function fillOverlay(arr: Float32Array, d: TerrainData, o: Overlays, src: Uint32Array): void {
  const rgb = [0, 0, 0];
  for (let j = 0; j < src.length; j++) {
    const i = src[j];
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    if (o.sun) {
      sunRamp(d.illum[i], rgb);
      [r, g, b] = rgb;
      a = 0.92;
    }
    if (o.ice && d.psr[i]) {
      r = 0.3;
      g = 0.72;
      b = 1;
      a = 0.9;
    }
    arr[j * 4] = r;
    arr[j * 4 + 1] = g;
    arr[j * 4 + 2] = b;
    arr[j * 4 + 3] = a;
  }
}

function dotTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(200,235,255,0.7)');
  gr.addColorStop(1, 'rgba(200,235,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 32, 32);
  return new CanvasTexture(c);
}

/** A short tap (< 250 ms, < 8 px) on the ground; drags and orbits do not count. */
const TAP_MS = 250;
const TAP_PX = 8;
/** Metres per repeat of the fine regolith detail (the coarse layer repeats 7.3x larger). */
const DETAIL_TILE_M = 26;

/** Fog-of-war uniforms (explore mode). uFogK 0 = off: the shader then multiplies by exactly 1. */
export interface FogUniforms {
  uFogTex: { value: Texture };
  uFogExtent: { value: number };
  uFogK: { value: number };
  uFogDim: { value: number };
  /** explore only: share of the albedo added as soft fill inside the revealed area (0 = off) */
  uFogLift: { value: number };
}
export function makeFogUniforms(extent: number): FogUniforms {
  const t = new DataTexture(new Uint8Array([255]), 1, 1, RedFormat, UnsignedByteType);
  t.needsUpdate = true;
  return { uFogTex: { value: t }, uFogExtent: { value: extent }, uFogK: { value: 0 }, uFogDim: { value: 0.5 }, uFogLift: { value: 0 } };
}

export function Terrain({ data, frame, overlays, onGroundTap, fog }: { data: TerrainData; frame: TerrainFrame; overlays: Overlays; onGroundTap?: (point: Vector3) => void; fog?: FogUniforms }) {
  const { terrainStep } = useTier();
  const built = useMemo(() => buildGeometry(data, frame, terrainStep), [data, frame, terrainStep]);
  const geom = built.g;
  useEffect(() => () => geom.dispose(), [geom]);
  const fogRef = useRef(fog);
  fogRef.current = fog;
  const { mat, uOv } = useMemo(() => {
    const uOv = { value: 0 };
    const fogU = fogRef.current ?? makeFogUniforms(frame.extent);
    const detail = terrainDetailTexture();
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    // Shader blend: per-vertex overlay colour (aOverlay.rgb) mixed by its weight (aOverlay.a) and uOv (fade).
    // Plus one small tiling detail texture (albedo noise + normal bumps) sampled at two scales, so close-ups are not flat.
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uOv = uOv;
      sh.uniforms.uDetail = { value: detail };
      sh.uniforms.uTile = { value: DETAIL_TILE_M };
      sh.uniforms.uFogTex = fogU.uFogTex;
      sh.uniforms.uFogExtent = fogU.uFogExtent;
      sh.uniforms.uFogK = fogU.uFogK;
      sh.uniforms.uFogDim = fogU.uFogDim;
      sh.uniforms.uFogLift = fogU.uFogLift;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aOverlay;\nvarying vec4 vOv;\nvarying vec2 vTXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOv = aOverlay;\nvTXZ = position.xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uOv;\nuniform sampler2D uDetail;\nuniform float uTile;\nuniform sampler2D uFogTex;\nuniform float uFogExtent;\nuniform float uFogK;\nuniform float uFogDim;\nuniform float uFogLift;\nvarying vec4 vOv;\nvarying vec2 vTXZ;')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vOv.rgb, vOv.a * uOv);\n' +
            'float fogSeen = texture2D(uFogTex, vTXZ / uFogExtent + 0.5).r;\n' +
            'diffuseColor.rgb *= mix(1.0, uFogDim + (1.0 - uFogDim) * fogSeen, uFogK);\n' +
            'vec3 dA = texture2D(uDetail, vTXZ / uTile).rgb;\n' +
            'vec3 dB = texture2D(uDetail, vTXZ / (uTile * 7.3) + vec2(0.37, 0.11)).rgb;\n' +
            'diffuseColor.rgb *= 1.0 + ((dA.r - 0.5) * 0.5 + (dB.r - 0.5) * 0.45) * 0.9;',
        )
        .replace(
          '#include <normal_fragment_maps>',
          '#include <normal_fragment_maps>\n' +
            'vec2 dg = (dA.gb - 0.5) * 1.1 + (dB.gb - 0.5) * 0.7;\n' +
            'normal = normalize(normal + (viewMatrix * vec4(dg.x, 0.0, dg.y, 0.0)).xyz * 0.6);',
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vOv.rgb * vOv.a * uOv * 0.38;\ntotalEmissiveRadiance += diffuseColor.rgb * (uFogLift * fogSeen);');
    };
    mat.customProgramCacheKey = () => 'moon-terrain-overlay-detail-fog-lift';
    return { mat, uOv };
  }, []);

  // tap detection (works for mouse and touch; a second finger cancels it)
  const down = useRef<{ t: number; x: number; y: number } | null>(null);
  const tapHandlers = onGroundTap
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          down.current = e.nativeEvent.isPrimary ? { t: performance.now(), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY } : null;
        },
        onPointerUp: (e: ThreeEvent<PointerEvent>) => {
          const d = down.current;
          down.current = null;
          if (!d || !e.nativeEvent.isPrimary) return;
          if (performance.now() - d.t > TAP_MS) return;
          if (Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) > TAP_PX) return;
          onGroundTap(e.point.clone());
        },
      }
    : {};

  useEffect(() => {
    const a = geom.getAttribute('aOverlay') as BufferAttribute;
    fillOverlay(a.array as Float32Array, data, overlays, built.src);
    a.needsUpdate = true;
  }, [geom, built, data, overlays]);

  // Frost sparkle: sparse points over permanently shadowed cells, twinkling in two alternating sets.
  const sparkle = useMemo(() => {
    const A: number[] = [];
    const B: number[] = [];
    let k = 0;
    for (let r = 0; r < data.n; r += 3) {
      for (let c = 0; c < data.n; c += 3) {
        const i = r * data.n + c;
        if (!data.psr[i]) continue;
        if (((r * 7 + c * 13) & 3) !== 0) continue;
        const arr = k++ % 2 ? A : B;
        arr.push((c - (data.n - 1) / 2) * frame.cell, (data.height[i] - frame.baseH) * frame.exag + frame.cell * 0.4, (r - (data.n - 1) / 2) * frame.cell);
      }
    }
    const tex = dotTexture();
    const mk = (a: number[]) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(a), 3));
      const m = new PointsMaterial({ map: tex, color: '#d6f1ff', size: frame.cell * 2.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 });
      return new Points(g, m);
    };
    return [mk(A), mk(B)];
  }, [data, frame]);

  const target = useRef(0);
  target.current = overlays.sun || overlays.ice ? 1 : 0;
  useFrame(({ clock }, dt) => {
    uOv.value += (target.current - uOv.value) * Math.min(1, dt * 6);
    const t = clock.getElapsedTime();
    const ice = overlays.ice ? 1 : 0;
    sparkle[0].material.opacity = ice * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3)));
    sparkle[1].material.opacity = ice * (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.3 + Math.PI)));
  });

  return (
    <>
      <mesh geometry={geom} material={mat} castShadow receiveShadow {...tapHandlers} />
      <primitive object={sparkle[0]} />
      <primitive object={sparkle[1]} />
    </>
  );
}
