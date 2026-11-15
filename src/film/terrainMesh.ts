// The real LOLA south-pole terrain (public/terrain/connecting-ridge) as a film asset: one mesh, one material with
// time-driven "data" layers (contour/point-grid reveal, May-2024 sunlight heat map, PSR ice glow).
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
} from 'three';
import { terrainDetailTexture } from '../three/models/proc';
import { makeFrame } from '../three/math';
import type { TerrainData, TerrainFrame } from '../three/types';

export const EXAG = 1.5;
/** Days 0..5 of lit-may-2024 = 8-13 May (before the sunlight window closes on the 14th). */
const LIT_DAYS = 6;

export interface TerrainUniforms {
  uReveal: { value: number };
  uSweepC: { value: Vector2 };
  uDataAmt: { value: number };
  uSun: { value: number };
  uIce: { value: number };
  uIceC: { value: Vector2 };
  uTime: { value: number };
}

export interface FilmTerrain {
  mesh: Mesh;
  u: TerrainUniforms;
  frame: TerrainFrame;
  data: TerrainData;
  litAt(x: number, z: number): number;
  psrAt(x: number, z: number): number;
  /** world position (x, z) of grid cell (row, col) */
  cellXZ(r: number, c: number): [number, number];
}

export function buildTerrain(d: TerrainData): FilmTerrain {
  const n = d.n;
  const frame = makeFrame(d, EXAG);
  const cell = frame.cell;
  const h = d.height;
  const pos = new Float32Array(n * n * 3);
  const nor = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const at = (r: number, c: number): number => h[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const o = i * 3;
      pos[o] = (c - (n - 1) / 2) * cell;
      pos[o + 1] = (h[i] - frame.baseH) * EXAG;
      pos[o + 2] = (r - (n - 1) / 2) * cell;
      const gx = ((at(r, c + 1) - at(r, c - 1)) * EXAG) / (2 * cell);
      const gz = ((at(r + 1, c) - at(r - 1, c)) * EXAG) / (2 * cell);
      const l = Math.hypot(gx, 1, gz);
      nor[o] = -gx / l;
      nor[o + 1] = 1 / l;
      nor[o + 2] = -gz / l;
      const mott = 0.5 + 0.5 * Math.sin(c * 0.37 + Math.sin(r * 0.23) * 2) * Math.sin(r * 0.31 + c * 0.05);
      const slope = Math.min(1, Math.hypot(gx, gz) * 1.2);
      const g = 0.27 + 0.06 * mott + 0.04 * slope + 0.02 * Math.sin(c * 1.7) * Math.sin(r * 2.1);
      const ex = Math.abs(c / (n - 1) - 0.5) * 2;
      const ey = Math.abs(r / (n - 1) - 0.5) * 2;
      const edge = Math.max(0, Math.min(1, (1 - Math.max(ex, ey)) / 0.08));
      col[o] = g * 1.03 * edge;
      col[o + 1] = g * edge;
      col[o + 2] = g * 0.95 * edge;
    }
  }
  const uv = new Float32Array(n * n * 2);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    uv[(r * n + c) * 2] = c / (n - 1);
    uv[(r * n + c) * 2 + 1] = r / (n - 1);
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = r * n + c;
      const b = a + 1;
      const dd = a + n;
      const e = dd + 1;
      idx[k++] = a; idx[k++] = dd; idx[k++] = b;
      idx[k++] = b; idx[k++] = dd; idx[k++] = e;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('normal', new BufferAttribute(nor, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setIndex(new BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();

  // data texture: R = mean % sunlit 8-13 May, G = permanently shadowed, B = NASA average illumination
  const tex = new Uint8Array(n * n * 4);
  const litAvg = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    let s = 0;
    for (let day = 0; day < LIT_DAYS; day++) s += d.lit[day * n * n + i];
    litAvg[i] = s / LIT_DAYS;
    tex[i * 4] = Math.round((litAvg[i] / 100) * 255);
    tex[i * 4 + 1] = d.psr[i] ? 255 : 0;
    tex[i * 4 + 2] = Math.round((d.illum[i] / 100) * 255);
    tex[i * 4 + 3] = 255;
  }
  const dataTex = new DataTexture(tex, n, n, RGBAFormat, UnsignedByteType);
  dataTex.magFilter = LinearFilter;
  dataTex.minFilter = LinearFilter;
  dataTex.needsUpdate = true;

  const u: TerrainUniforms = {
    uReveal: { value: 2 },
    uSweepC: { value: new Vector2(0.5, 0.5) },
    uDataAmt: { value: 0 },
    uSun: { value: 0 },
    uIce: { value: 0 },
    uIceC: { value: new Vector2(0.8, 0.3) },
    uTime: { value: 0 },
  };
  const detail = terrainDetailTexture();
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uData: { value: dataTex }, uDetail: { value: detail } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vUv2;\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv;\nvWP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uData; uniform sampler2D uDetail;
uniform float uReveal, uDataAmt, uSun, uIce, uTime; uniform vec2 uSweepC, uIceC;
varying vec2 vUv2; varying vec3 vWP;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 filmEm = vec3(0.0);
vec4 fd = texture2D(uData, vUv2);
float dSw = distance(vUv2, uSweepC);
float edgeSw = uReveal * 1.35;
float solid = 1.0 - smoothstep(-0.035, 0.0, dSw - edgeSw);
if (uReveal > 1.5) solid = 1.0;
float frontG = exp(-abs(dSw - edgeSw) * 55.0) * (uReveal > 0.001 && uReveal < 1.5 ? 1.0 : 0.0);
// data look (contours + point grid + sweep front)
float cy = vWP.y / 70.0;
float cl = 1.0 - clamp(abs(fract(cy - 0.5) - 0.5) / (fwidth(cy) * 1.1), 0.0, 1.0);
vec2 gq = vUv2 * 64.0;
vec2 gl = abs(fract(gq - 0.5) - 0.5) / (fwidth(gq) * 1.2);
float gridL = 1.0 - clamp(min(gl.x, gl.y), 0.0, 1.0);
vec2 dq = fract(vUv2 * 128.0) - 0.5;
float dotv = smoothstep(0.2, 0.08, length(dq));
vec3 cy3 = vec3(0.30, 0.72, 1.0);
filmEm += cy3 * (cl * 1.1 + gridL * 0.45 + dotv * 0.5) * (1.0 - solid) * uDataAmt;
filmEm += vec3(0.7, 0.95, 1.0) * frontG * 1.6 * uDataAmt;
// thin contour lines survive on the solid terrain (briefly) so the transition reads as data becoming ground
filmEm += cy3 * cl * 0.5 * solid * uDataAmt * 0.6;
diffuseColor.rgb *= mix(0.05, 1.0, solid);
// detail
vec3 dA = texture2D(uDetail, vWP.xz / 26.0).rgb;
vec3 dB = texture2D(uDetail, vWP.xz / (26.0 * 7.3) + vec2(0.37, 0.11)).rgb;
diffuseColor.rgb *= 1.0 + ((dA.r - 0.5) * 0.5 + (dB.r - 0.5) * 0.45) * 0.9;
// sunlight map
float lit = fd.r;
vec3 warm = mix(vec3(0.5, 0.15, 0.03), vec3(1.0, 0.68, 0.16), smoothstep(0.35, 1.0, lit));
float sunA = uSun * smoothstep(0.06, 0.55, lit) * solid;
diffuseColor.rgb *= mix(1.0, 0.55 + 0.45 * smoothstep(0.0, 0.25, lit), uSun * solid);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * warm * 2.4, sunA * 0.75);
filmEm += warm * sunA * (0.2 + 0.06 * sin(uTime * 2.4 + vUv2.x * 38.0 + vUv2.y * 22.0));
// ice (permanently shadowed regions)
float psrM = smoothstep(0.3, 0.7, fd.g);
vec3 iceC = vec3(0.35, 0.8, 1.0);
float pulse = 0.7 + 0.3 * sin(uTime * 3.2 - length(vUv2 - uIceC) * 70.0);
diffuseColor.rgb = mix(diffuseColor.rgb, iceC * vec3(0.55, 0.8, 1.0) * 0.9, uIce * psrM * 0.6 * solid);
filmEm += iceC * uIce * psrM * (0.22 + 0.16 * pulse) * solid;
filmEm += iceC * uIce * exp(-pow((fd.g - 0.5) * 6.0, 2.0)) * 1.1 * solid;
vec2 sg = floor(vWP.xz / 3.0);
float hs = fract(sin(dot(sg, vec2(12.9898, 78.233)) + floor(uTime * 9.0) * 1.7) * 43758.5453);
filmEm += vec3(0.85, 0.97, 1.0) * step(0.9955, hs) * uIce * psrM * 1.8 * solid;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec2 dgv = (dA.gb - 0.5) * 1.1 + (dB.gb - 0.5) * 0.7;
normal = normalize(normal + (viewMatrix * vec4(dgv.x, 0.0, dgv.y, 0.0)).xyz * 0.6);`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += filmEm;');
  };
  mat.customProgramCacheKey = () => 'film-terrain-v1';
  const mesh = new Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const sample = (arr: ArrayLike<number>, x: number, z: number, scale: number): number => {
    const c = Math.max(0, Math.min(n - 1, Math.round(x / cell + (n - 1) / 2)));
    const r = Math.max(0, Math.min(n - 1, Math.round(z / cell + (n - 1) / 2)));
    return arr[r * n + c] * scale;
  };
  return {
    mesh,
    u,
    frame,
    data: d,
    litAt: (x, z) => sample(litAvg, x, z, 1),
    psrAt: (x, z) => sample(d.psr, x, z, 1),
    cellXZ: (r, c) => [(c - (n - 1) / 2) * cell, (r - (n - 1) / 2) * cell],
  };
}

