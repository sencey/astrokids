// Space-side props: NASA SVS Moon (colour + displacement), Blue Marble Earth, the Sun and the CME particle stream.
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Texture } from 'three';
import { findTextures, loadTexture } from '../three/data/textures';
import { glowSprite, makeCme, streakSprite } from './fx';
import { seg, smooth, T, tri } from './timeline';

export const EARTH_POS = new Vector3(-16, 5.5, -44);
export const SUN_POS = new Vector3(-26, 15, -62);
/** direction of sunlight in the globe scene (toward the camera side, grazing the south pole) */
export const GLOBE_SUN = new Vector3(4, -1.5, 3).normalize();

export interface Space {
  group: Group;
  moon: Mesh;
  update(t: number): void;
  /** brightness pulse of the Moon surface when the CME arrives (0..1) */
  moonHit: number;
}

export async function buildSpace(): Promise<Space> {
  const group = new Group();
  const [mt, et] = await Promise.all([findTextures('moon'), findTextures('earth')]);
  const load = async (u: string | undefined, srgb = true): Promise<Texture | null> => (u ? loadTexture(u, srgb).catch(() => null) : null);
  const [moonC, moonD, earthC] = await Promise.all([load(mt.color), load(mt.displacement, false), load(et.color)]);

  const moonMat = new MeshStandardMaterial({
    map: moonC ?? undefined,
    color: moonC ? '#ffffff' : '#9a9a9a',
    roughness: 1,
    displacementMap: moonD ?? undefined,
    displacementScale: moonD ? 0.03 : 0,
    displacementBias: moonD ? -0.015 : 0,
    emissive: new Color('#ff4a22'),
    emissiveMap: moonC ?? undefined,
    emissiveIntensity: 0,
  });
  const moon = new Mesh(new SphereGeometry(1, 160, 80), moonMat);
  group.add(moon);

  const earth = new Mesh(new SphereGeometry(3.67, 96, 48), new MeshStandardMaterial({ map: earthC ?? undefined, color: earthC ? '#ffffff' : '#3b78d8', roughness: 0.9, emissive: new Color('#0b1a40'), emissiveIntensity: 0.6 }));
  earth.position.copy(EARTH_POS);
  earth.rotation.y = 2.3;
  group.add(earth);
  const atmo = new Mesh(
    new SphereGeometry(3.67 * 1.045, 64, 32),
    new ShaderMaterial({
      uniforms: {},
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.25,0.55,1.0) * f * 1.6, f); }',
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide,
    }),
  );
  atmo.position.copy(EARTH_POS);
  group.add(atmo);

  // pole marker ring (the Connecting Ridge site sits ~0.3 deg from the pole, i.e. at the bottom of the globe)
  const ring = new Mesh(new RingGeometry(0.9, 1, 64), new MeshBasicMaterial({ color: '#5fd0ff', transparent: true, opacity: 0, side: DoubleSide, toneMapped: false, depthWrite: false, blending: AdditiveBlending }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, -1.012, 0);
  group.add(ring);

  // Sun for the storm shot
  const sunG = new Group();
  const sunBall = new Mesh(
    new SphereGeometry(7.5, 96, 48),
    new ShaderMaterial({
      uniforms: { uT: { value: 0 }, uFlare: { value: 0 } },
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `
varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uT; uniform float uFlare;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float n3(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x), f.y), f.z); }
void main(){
  vec3 p = normalize(vP) * 3.0;
  float g = n3(p * 2.0 + uT * 0.15) * 0.55 + n3(p * 5.0 - uT * 0.25) * 0.3 + n3(p * 11.0 + uT * 0.4) * 0.15;
  float limb = pow(max(dot(vN, vV), 0.0), 0.6);
  vec3 col = mix(vec3(1.0, 0.38, 0.05), vec3(1.0, 0.88, 0.42), g) * (0.55 + 0.75 * limb);
  // an active region (the flare) near the lower-right limb toward the Moon
  float ar = exp(-pow(length(normalize(vP) - normalize(vec3(0.55, -0.35, 0.75))) * 5.0, 2.0));
  col += vec3(1.0, 0.95, 0.8) * ar * (0.4 + 2.2 * uFlare);
  gl_FragColor = vec4(col * 1.25, 1.0);
}`,
    }),
  );
  sunG.add(sunBall);
  const halo1 = glowSprite('#ff8a30', 46, 0.9);
  const halo2 = glowSprite('#ffd070', 22, 0.9);
  const flareHalo = glowSprite('#fff2c8', 12, 0);
  const streak = streakSprite('#ffcf80', 70, 5, 0);
  sunG.add(halo1, halo2, flareHalo, streak);
  sunG.position.copy(SUN_POS);
  group.add(sunG);
  const cme = makeCme(9000);
  group.add(cme.points);

  const space: Space = {
    group,
    moon,
    moonHit: 0,
    update(t) {
      const globe = t >= T.s2 && t < T.s2 + 3.4;
      const storm = t >= T.s6 - 0.01 && t < T.s7 + 0.01;
      group.visible = (t >= T.s2 - 0.01 && t < 6.1) || storm;
      moon.rotation.y = 0.5 + t * 0.04;
      earth.visible = !storm;
      atmo.visible = !storm;
      earth.rotation.y = 2.3 + t * 0.05;
      void globe;
      // pole ring: appears while the camera dives in, pulsing
      const rk = smooth(seg(t, 4.9, 5.3)) * (1 - smooth(seg(t, 5.7, 6.0)));
      (ring.material as MeshBasicMaterial).opacity = rk * (0.6 + 0.4 * Math.sin(t * 12));
      ring.scale.setScalar(0.06 + 0.012 * Math.sin(t * 10) + 0.16 * (1 - smooth(seg(t, 4.9, 5.6))));
      // sun + CME
      sunG.visible = storm;
      cme.points.visible = storm;
      const te = t - (T.s6 + 0.55); // eruption at 17.35 s
      const flare = tri(te, 0, 0.35, 1.4);
      (sunBall.material as ShaderMaterial).uniforms.uT.value = t;
      (sunBall.material as ShaderMaterial).uniforms.uFlare.value = flare;
      (flareHalo.material as { opacity: number }).opacity = flare * 0.95;
      (streak.material as { opacity: number }).opacity = flare * 0.8;
      flareHalo.scale.setScalar(12 + flare * 22);
      halo1.scale.setScalar(46 + 4 * Math.sin(t * 2) + flare * 12);
      cme.mat.uniforms.uT.value = Math.max(0, te);
      cme.mat.uniforms.uSunP.value = [SUN_POS.x, SUN_POS.y, SUN_POS.z];
      cme.mat.uniforms.uTarget.value = [0, 0, 0];
      // the front of the stream reaches the Moon ~2.4 s after the eruption
      space.moonHit = tri(te, 2.0, 2.7, 3.6);
      moonMat.emissiveIntensity = space.moonHit * 0.5;
    },
  };
  return space;
}
