// Film-only props: the solar tower with a build-up animation, and the shield dome.
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { solarCellTexture } from '../three/models/proc';
import { glowSprite, streakSprite } from './fx';
import { clamp01, easeOut, easeOutBack, seg, smooth, tri } from './timeline';

export interface SolarTowerAnim {
  group: Group;
  /** k = seconds since the build started; sunYaw = panel facing */
  update(k: number, sunYaw: number): void;
}

export function buildSolarTower(): SolarTowerAnim {
  const g = new Group();
  const grey = new MeshStandardMaterial({ color: '#8d9099', metalness: 0.5, roughness: 0.5 });
  const silver = new MeshStandardMaterial({ color: '#c9ced8', metalness: 0.85, roughness: 0.35 });
  const panelM = new MeshStandardMaterial({ map: solarCellTexture(), metalness: 0.55, roughness: 0.3, emissive: '#0a1a52', emissiveIntensity: 0.45 });
  const backM = new MeshStandardMaterial({ color: '#4a4f5c', roughness: 0.7, metalness: 0.45 });
  const orange = new MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a1f', emissiveIntensity: 0.5 });

  const base = new Mesh(new CylinderGeometry(1.2, 1.6, 0.6, 20), grey);
  base.position.y = 0.3;
  base.castShadow = base.receiveShadow = true;
  const ring = new Mesh(new CylinderGeometry(1.65, 1.65, 0.12, 24), orange);
  ring.position.y = 0.62;
  const mastG = new Group();
  const mast = new Mesh(new CylinderGeometry(0.18, 0.28, 9, 12), grey);
  mast.position.y = 4.5;
  mast.castShadow = true;
  mastG.add(mast);
  const yoke = new Mesh(new BoxGeometry(0.7, 1.4, 0.4), grey);
  yoke.position.set(0, 8.0, -0.3);
  mastG.add(yoke);

  // panel: two wings hinged at the centre line, facing +z (rotated toward the Sun by the parent)
  const panelRoot = new Group();
  panelRoot.position.y = 8.2;
  const wingGeo = new BoxGeometry(3.5, 9, 0.18);
  const sides = [silver, silver, silver, silver, panelM, backM];
  const wingL = new Group();
  const wingR = new Group();
  const mL = new Mesh(wingGeo, sides);
  mL.position.x = -1.75;
  mL.castShadow = true;
  wingL.add(mL);
  const mR = new Mesh(wingGeo, sides);
  mR.position.x = 1.75;
  mR.castShadow = true;
  wingR.add(mR);
  const frameBar = new Mesh(new BoxGeometry(7.2, 0.14, 0.26), silver);
  frameBar.position.y = 4.55;
  const frameBar2 = frameBar.clone();
  frameBar2.position.y = -4.55;
  panelRoot.add(wingL, wingR, frameBar, frameBar2);
  const pivot = new Group();
  pivot.add(panelRoot);
  g.add(base, ring, mastG, pivot);

  // glints
  const glint = glowSprite('#fff4c8', 9, 0);
  glint.position.set(1.6, 9.6, 0.5);
  const streak = streakSprite('#ffe9a8', 26, 2.2, 0);
  streak.position.copy(glint.position);
  const pop = glowSprite('#9fd8ff', 6, 0);
  pop.position.set(0, 1.0, 0);
  g.add(glint, streak, pop);

  return {
    group: g,
    update(k, sunYaw) {
      const a = easeOutBack(seg(k, 0, 0.4));
      base.scale.setScalar(Math.max(0.001, a));
      ring.scale.setScalar(Math.max(0.001, a));
      ring.visible = k > 0.02;
      const m = easeOut(seg(k, 0.28, 0.85));
      mastG.scale.set(1, Math.max(0.001, m), 1);
      mastG.visible = k > 0.28;
      // wings unfold from a stack at the hinge
      const u = easeOutBack(seg(k, 0.8, 1.45));
      panelRoot.visible = k > 0.8;
      panelRoot.scale.set(1, Math.max(0.001, clamp01(seg(k, 0.8, 1.0)) * 1), 1);
      wingL.rotation.y = (1 - Math.min(u, 1.0)) * (Math.PI / 2) + Math.max(0, u - 1) * -0.12;
      wingR.rotation.y = -((1 - Math.min(u, 1.0)) * (Math.PI / 2)) + Math.max(0, u - 1) * 0.12;
      pivot.rotation.y = sunYaw;
      yoke.visible = k > 0.78;
      yoke.rotation.y = 0;
      const gl = tri(k, 1.4, 1.7, 2.4);
      (glint.material as { opacity: number }).opacity = gl * 0.3;
      (streak.material as { opacity: number }).opacity = gl * 0.5;
      glint.scale.setScalar(2 + gl * 2.2);
      const pp = tri(k, 0.0, 0.2, 0.7);
      (pop.material as { opacity: number }).opacity = pp * 0.8;
      pop.scale.setScalar(4 + 6 * seg(k, 0, 0.7));
      void smooth;
    },
  };
}

export interface Dome {
  mesh: Mesh;
  mat: ShaderMaterial;
}
export function buildDome(radius: number): Dome {
  const mat = new ShaderMaterial({
    uniforms: { uA: { value: 0 }, uRip: { value: 0 }, uT: { value: 0 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uA; uniform float uRip; uniform float uT;
float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs((mod(p, 1.0) - 0.5)); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
void main(){
  vec3 n = normalize(vP);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  vec2 uv = vec2(atan(n.z, n.x) * 5.0, n.y * 7.0);
  float hx = smoothstep(0.06, 0.0, hex(uv));
  float el = asin(clamp(n.y, 0.0, 1.0)) / 1.5708;
  float rip = exp(-pow((el - uRip) * 9.0, 2.0)) * step(0.001, uRip) * (1.0 - smoothstep(0.92, 1.05, uRip));
  float base = 0.06 + fres * 0.9 + hx * (0.18 + 0.5 * rip) + rip * 1.2;
  vec3 col = mix(vec3(0.15, 0.55, 1.0), vec3(0.8, 0.95, 1.0), clamp(rip + fres * 0.5, 0.0, 1.0));
  float vis = smoothstep(0.0, 0.12, el + 0.02);
  gl_FragColor = vec4(col * base * uA * vis, base * uA * vis * 0.55);
}`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(new SphereGeometry(radius, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}
