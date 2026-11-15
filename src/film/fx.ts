// Small shared effects: soft glow sprites and GPU-driven particle fields (all positions are pure functions of a time uniform).
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from 'three';
import type { Texture } from 'three';
import { rng } from './timeline';

let glowTex: Texture | null = null;
export function glowTexture(): Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.1, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  glowTex = t;
  return t;
}

export function glowSprite(color: string, scale: number, opacity = 1): Sprite {
  const m = new SpriteMaterial({ map: glowTexture(), color: new Color(color), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity, toneMapped: false, fog: false });
  const s = new Sprite(m);
  s.scale.set(scale, scale, 1);
  return s;
}

/** Lens-flare style horizontal streak texture sprite (anamorphic). */
export function streakSprite(color: string, w: number, h: number, opacity = 1): Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 512, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 28, 512, 8);
  const g2 = x.createLinearGradient(0, 0, 0, 64);
  g2.addColorStop(0, 'rgba(0,0,0,1)');
  g2.addColorStop(0.5, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = g2;
  x.fillRect(0, 0, 512, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  const m = new SpriteMaterial({ map: t, color: new Color(color), blending: AdditiveBlending, transparent: true, depthWrite: false, opacity, toneMapped: false });
  const s = new Sprite(m);
  s.scale.set(w, h, 1);
  return s;
}

const SPRITE_FRAG = `
varying float vA; varying vec3 vC;
void main(){
  vec2 q = gl_PointCoord - 0.5; float d = length(q);
  float a = smoothstep(0.5, 0.0, d); a = a*a;
  gl_FragColor = vec4(vC * a * vA, a * vA);
}`;

export interface TimedPoints {
  points: Points;
  mat: ShaderMaterial;
}

/** Coronal-mass-ejection particle stream: continuous emission from the Sun toward a target, additive orange glow. */
export function makeCme(n: number): TimedPoints {
  const r = rng(77);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seed[i] = r();
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSunP: { value: [0, 0, 0] }, uTarget: { value: [0, 0, 0] }, uPx: { value: 520 }, uSpeed: { value: 24 } },
    vertexShader: `
attribute vec4 aSeed; uniform float uT; uniform vec3 uSunP; uniform vec3 uTarget; uniform float uPx; uniform float uSpeed;
varying float vA; varying vec3 vC;
void main(){
  float t0 = aSeed.x * 3.4;
  float age = uT - t0;
  vec3 dir = normalize(uTarget - uSunP);
  vec3 side = normalize(cross(dir, vec3(0.0,1.0,0.0)));
  vec3 up2 = cross(side, dir);
  float ang = aSeed.y * 6.2831853; float rad = sqrt(aSeed.z);
  vec3 off = side * cos(ang) + up2 * sin(ang);
  float dist = max(age, 0.0) * (uSpeed * (0.7 + aSeed.w * 0.6));
  vec3 p = uSunP + dir * 8.0 + off * rad * 5.0 + dir * dist + off * rad * dist * 0.10;
  p += vec3(sin(aSeed.y*40.0+age*2.0), cos(aSeed.z*40.0+age*1.7), sin(aSeed.w*30.0+age*2.3)) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float fin = smoothstep(0.0, 0.3, age);
  float fout = 1.0 - smoothstep(55.0, 85.0, dist);
  vA = fin * fout * (age > 0.0 ? 1.0 : 0.0) * 1.4;
  vC = mix(vec3(1.0, 0.82, 0.35), vec3(1.0, 0.28, 0.08), clamp(dist / 50.0, 0.0, 1.0));
  gl_PointSize = clamp(uPx * (0.5 + aSeed.w) / max(-mv.z, 0.1), 1.5, 70.0);
}`,
    fragmentShader: SPRITE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return { points, mat };
}

/** Ice glints: sparkles hovering over given base positions, twinkling with time. */
export function makeSparkles(base: Float32Array, color: string, px: number, height: number): TimedPoints {
  const n = base.length / 3;
  const r = rng(991);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seed[i] = r();
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(base, 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const c = new Color(color);
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAmt: { value: 1 }, uPx: { value: px }, uH: { value: height }, uCol: { value: [c.r, c.g, c.b] } },
    vertexShader: `
attribute vec4 aSeed; uniform float uT; uniform float uAmt; uniform float uPx; uniform float uH; uniform vec3 uCol;
varying float vA; varying vec3 vC;
void main(){
  vec3 p = position;
  p.y += aSeed.x * uH + sin(uT * (0.6 + aSeed.y) + aSeed.z * 6.28) * uH * 0.15;
  p.x += sin(uT * 0.5 + aSeed.w * 12.0) * uH * 0.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = pow(max(0.0, sin(uT * (2.5 + aSeed.y * 5.0) + aSeed.z * 31.0)), 6.0);
  vA = uAmt * (0.12 + tw);
  vC = uCol;
  gl_PointSize = clamp(uPx * (0.4 + aSeed.w) * (1.0 + tw) / max(-mv.z, 0.1), 1.5, 42.0);
}`,
    fragmentShader: SPRITE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return { points, mat };
}

/** Falling storm particles in a box around a centre (diagonal streaks of hot red-orange), culled inside a dome. */
export function makeStormRain(n: number, box: number): TimedPoints {
  const r = rng(555);
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) seed[i] = r();
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 4));
  const mat = new ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAmt: { value: 1 }, uC: { value: [0, 0, 0] }, uR: { value: 12 }, uBox: { value: box }, uPx: { value: 26 } },
    vertexShader: `
attribute vec4 aSeed; uniform float uT; uniform float uAmt; uniform vec3 uC; uniform float uR; uniform float uBox; uniform float uPx;
varying float vA; varying vec3 vC;
void main(){
  vec3 p = uC + (aSeed.xyz - 0.5) * uBox;
  float spd = 26.0 + aSeed.w * 22.0;
  vec3 v = normalize(vec3(-0.55, -0.7, 0.25)) * spd;
  p += v * uT;
  vec3 rel = p - uC;
  rel = mod(rel + uBox * 0.5, uBox) - uBox * 0.5;
  rel.y = mod(rel.y + uBox * 0.3, uBox * 0.6) - uBox * 0.1;
  p = uC + rel;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float inside = smoothstep(uR * 0.9, uR * 1.05, length(vec3(rel.x, max(rel.y, 0.0) * 1.1, rel.z)));
  float vis = step(aSeed.w, uAmt);
  vA = vis * inside * 0.9;
  vC = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.2, 0.12), aSeed.x);
  gl_PointSize = clamp(uPx * (0.5 + aSeed.z) / max(-mv.z, 0.1), 1.2, 14.0);
}`,
    fragmentShader: SPRITE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return { points, mat };
}
