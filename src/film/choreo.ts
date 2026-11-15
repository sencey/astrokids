// Choreography: everything that moves or changes in the world as a pure function of the film clock t.
import { Color, Vector3 } from 'three';
import type { DirectionalLight, Group, HemisphereLight } from 'three';
import type { MutableRefObject } from 'react';
import type { GaitDrive } from '../three/models/primitives';
import type { PatiGuideState } from '../three/models/PatiSprite';
import { skyVec } from '../three/math';
import type { FilmTerrain } from './terrainMesh';
import type { Space } from './space';
import { GLOBE_SUN, SUN_POS } from './space';
import type { SolarTowerAnim, Dome } from './props';
import type { TimedPoints } from './fx';
import { clamp01, easeInOut, lerp, seg, smooth, T } from './timeline';

export const SUN_DIR = new Vector3(...skyVec(172, 3.5)).normalize();
export const HAB = { x: 1723, z: 4113 };
export const TOWER_AT = { x: HAB.x + 40, z: HAB.z + 7 };
/** the small permanently shadowed crater north-west of the base (real PSR blob, 362 cells) */
export const CRATER = { x: 250, z: 3270 };
export const CRATER_UV = { u: 131 / 255, v: 174 / 255 };
export const SITE_UV = { u: 152 / 255, v: 186 / 255 };
export const TOWER_BUILD_T = 14.5;
export const DOME_R = 12;
export const STAGE3 = { x: HAB.x - 3, z: HAB.z + 14 };
export const RUN_FROM = { x: HAB.x + 9.5, z: HAB.z + 17 };
export const RUN_TO = { x: HAB.x + 0.9, z: HAB.z + 7.2 };

export interface Rig {
  terrain: FilmTerrain | null;
  space: Space | null;
  sunLight: DirectionalLight;
  kicker: DirectionalLight;
  fill: HemisphereLight;
  habitat: Group | null;
  tower: SolarTowerAnim;
  dome: Dome;
  storm: TimedPoints;
  sparkles: TimedPoints | null;
  commander: Group | null;
  commanderDrive: MutableRefObject<GaitDrive>;
  pati: Group | null;
  patiState: MutableRefObject<PatiGuideState>;
  terrainGroup: Group;
  rain: TimedPoints;
}

export interface LightState {
  dir: Vector3;
  shadow: boolean;
}

const col = new Color();
const mix = (a: string, b: string, k: number, out: Color): Color => out.set(a).lerp(col.set(b), clamp01(k));

export function choreo(t: number, rig: Rig): LightState {
  const ft = rig.terrain;
  const inStorm = t >= T.s6 - 0.01 && t < T.s7 - 0.01;
  const terrainOn = ft !== null && ((t >= 5.95 && t < T.s6 - 0.01) || t >= T.s7 - 0.01);
  rig.terrainGroup.visible = terrainOn;
  rig.space?.update(t);

  const G = (x: number, z: number): number => (ft ? ft.frame.groundY(x, z) : 0);

  // ---------- terrain data layers ----------
  if (ft) {
    const u = ft.u;
    u.uTime.value = t;
    u.uSweepC.value.set(SITE_UV.u, SITE_UV.v);
    u.uIceC.value.set(CRATER_UV.u, CRATER_UV.v);
    // scene 2: data grid, then a sweep solidifies it
    if (t < T.s3) {
      u.uReveal.value = t < 7.95 ? lerp(0.0, 0.8, easeInOut(seg(t, 6.25, 7.8))) : 2;
      u.uDataAmt.value = t < 7.8 ? 1 : 1 - smooth(seg(t, 7.8, 8.4));
    } else {
      u.uReveal.value = 2;
      u.uDataAmt.value = 0;
    }
    // scene 4: ice glows
    let ice = smooth(seg(t, 10.45, 11.3)) * (1 - smooth(seg(t, 13.5, 13.95)));
    if (t < T.s4 - 0.01 || t >= T.s5) ice = 0;
    u.uIce.value = ice;
    // scene 5: sunlight heat map
    let sunA = 0;
    if (t >= T.s5 && t < T.s6) {
      sunA = smooth(seg(t, 13.65, 14.4));
      sunA = lerp(sunA, sunA * 0.5, smooth(seg(t, 14.8, 16.0)));
    }
    u.uSun.value = window.__ov ? u.uSun.value : sunA;
    if (window.__ov) {
      u.uSun.value = window.__ov.sun ? 1 : 0;
      u.uIce.value = window.__ov.ice ? 1 : 0;
    }
  }

  // ---------- actors ----------
  const actorsOn = terrainOn && ((t >= T.s3 && t < T.s4) || (t >= T.s5 - 0.01 && t < T.s6) || t >= T.s7 - 0.01);
  const hab = rig.habitat;
  if (hab && ft) {
    hab.visible = terrainOn && t >= T.s3 - 0.01 && !(t >= T.s4 && t < T.s5 - 0.01 && false);
    hab.position.set(HAB.x, G(HAB.x, HAB.z) - 0.1, HAB.z);
  }
  // tower
  const k = t - TOWER_BUILD_T;
  rig.tower.group.visible = terrainOn && t >= TOWER_BUILD_T - 0.01 && (t < T.s6 || t >= T.s7 - 0.01);
  rig.tower.group.position.set(TOWER_AT.x, G(TOWER_AT.x, TOWER_AT.z) - 0.2, TOWER_AT.z);
  rig.tower.update(Math.min(k, 10), Math.atan2(SUN_DIR.x, SUN_DIR.z));

  const cmd = rig.commander;
  const pati = rig.pati;
  const drive = rig.commanderDrive.current;
  const ps = rig.patiState.current;
  if (cmd) cmd.visible = actorsOn;
  if (pati) pati.visible = actorsOn;
  if (cmd && pati && ft && actorsOn) {
    if (t < T.s4) {
      // scene 3: commander at ease, Pati trots in and hops with joy
      const c = STAGE3;
      const p = { x: c.x - 2.2, z: c.z + 0.9 };
      cmd.position.set(c.x, G(c.x, c.z), c.z);
      cmd.rotation.y = 0.45 - 0.95 * smooth(seg(t, 9.0, 10.0)) + 0.06 * Math.sin(t * 1.3);
      drive.speed = 0;
      drive.phase = 0;
      pati.position.set(p.x, G(p.x, p.z), p.z);
      ps.pose = t < 8.75 ? 'talk' : 'jump';
      ps.yaw = Math.atan2(c.x - p.x, c.z - p.z) + smooth(seg(t, 8.8, 9.4)) * 1.2;
    } else if (t < T.s6) {
      // scene 5: the commander watches the tower go up from the side
      const c = { x: TOWER_AT.x - 11, z: TOWER_AT.z + 4 };
      cmd.position.set(c.x, G(c.x, c.z), c.z);
      cmd.rotation.y = Math.atan2(TOWER_AT.x - c.x, TOWER_AT.z - c.z) + 0.5;
      drive.speed = 0;
      const p = { x: c.x - 1.9, z: c.z + 1.0 };
      pati.position.set(p.x, G(p.x, p.z), p.z);
      ps.pose = t > 16.0 ? 'jump' : 'sit';
      ps.yaw = Math.atan2(TOWER_AT.x - p.x, TOWER_AT.z - p.z);
    } else {
      // scene 7: run for the habitat
      const f = easeInOut(seg(t, 20.66, 21.95));
      const x = lerp(RUN_FROM.x, RUN_TO.x, f);
      const z = lerp(RUN_FROM.z, RUN_TO.z, f);
      const heading = Math.atan2(RUN_TO.x - RUN_FROM.x, RUN_TO.z - RUN_FROM.z);
      const running = f < 0.98;
      cmd.position.set(x, G(x, z), z);
      cmd.rotation.y = running ? heading : lerp(heading, 0.4, smooth(seg(t, 21.95, 22.3)));
      drive.speed = running ? 1 : 0;
      drive.phase = t * 13;
      const px = lerp(RUN_FROM.x - 2.4, RUN_TO.x - 2.6, easeInOut(seg(t, 20.6, 21.85)));
      const pz = lerp(RUN_FROM.z + 0.2, RUN_TO.z + 0.4, easeInOut(seg(t, 20.6, 21.85)));
      pati.position.set(px, G(px, pz), pz);
      ps.pose = t < 21.9 ? 'run' : 'jump';
      ps.yaw = t < 21.9 ? heading : 0.2;
    }
  }

  // ---------- shield dome + storm rain ----------
  const domeA = smooth(seg(t, 21.15, 21.7));
  rig.dome.mesh.visible = terrainOn && t >= 21.1;
  rig.dome.mesh.position.set(HAB.x, G(HAB.x, HAB.z) - 0.5, HAB.z);
  rig.dome.mat.uniforms.uA.value = domeA * (0.8 + 0.2 * Math.sin(t * 3));
  rig.dome.mat.uniforms.uRip.value = seg(t, 21.15, 22.0);
  rig.dome.mat.uniforms.uT.value = t;
  const rainOn = t >= T.s7 - 0.01 && t < T.s8;
  rig.rain.points.visible = terrainOn && rainOn;
  rig.rain.mat.uniforms.uT.value = t;
  rig.rain.mat.uniforms.uAmt.value = 1 - smooth(seg(t, 21.2, 22.3));
  rig.rain.mat.uniforms.uC.value = [HAB.x, G(HAB.x, HAB.z) + 12, HAB.z];
  rig.rain.mat.uniforms.uR.value = DOME_R;

  // ice sparkles
  if (rig.sparkles) {
    rig.sparkles.points.visible = terrainOn && t >= T.s4 && t < T.s5 + 0.4;
    rig.sparkles.mat.uniforms.uT.value = t;
    rig.sparkles.mat.uniforms.uAmt.value = smooth(seg(t, 10.6, 11.4)) * (1 - smooth(seg(t, 13.4, 13.9)));
  }

  // ---------- lights ----------
  const L = rig.sunLight;
  const fill = rig.fill;
  const kick = rig.kicker;
  const dir = new Vector3();
  let shadow = true;
  if (terrainOn) {
    dir.copy(SUN_DIR);
    L.color.set('#fff1dc');
    L.intensity = t < T.s3 ? 6.0 : t < T.s4 ? 9 : t < T.s5 ? 6.5 : lerp(6.5, 8.5, smooth(seg(t, 14.3, 15.2)));
    fill.color.set('#9aa3b5');
    fill.groundColor.set('#2a2d33');
    fill.intensity = 0.62;
    kick.intensity = 0;
    if (t >= T.s3 && t < T.s4) {
      kick.intensity = 0.9;
      kick.color.set('#a9c4ff');
    }
    if (t >= T.s7 - 0.01) {
      const calm = smooth(seg(t, 21.3, 22.4));
      mix('#ff6a50', '#e8f3ff', calm, L.color);
      L.intensity = lerp(6.5, 8.5, calm);
      mix('#d04030', '#8fb4ff', calm, fill.color);
      fill.groundColor.copy(mix('#40100c', '#20283a', calm, new Color()));
      fill.intensity = lerp(0.7, 0.75, calm);
      kick.intensity = lerp(0.5, 0.9, calm);
      mix('#ff5a40', '#9fc8ff', calm, kick.color);
    }
  } else if (inStorm) {
    dir.copy(SUN_POS).normalize();
    shadow = false;
    L.color.set('#ffb070');
    L.intensity = 4.2;
    fill.color.set('#5a2418');
    fill.groundColor.set('#12060a');
    fill.intensity = 0.7 + 0.4 * (rig.space?.moonHit ?? 0);
    kick.intensity = 1.3;
    kick.color.set('#ff9a70');
  } else {
    dir.copy(GLOBE_SUN);
    shadow = false;
    L.color.set('#fff4e0');
    L.intensity = 3.4;
    fill.color.set('#6a7a9a');
    fill.groundColor.set('#0a0c14');
    fill.intensity = 0.28;
    kick.intensity = 0;
  }
  L.castShadow = shadow;
  return { dir, shadow };
}


