// The 3D world of the film. R3F hosts the canvas; all per-frame state is set imperatively by render(t) (no wall-clock).
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { loadTerrain } from '../three/data/terrain';
import { Astronaut, Habitat } from '../three/models/primitives';
import type { GaitDrive } from '../three/models/primitives';
import { Pati3D } from '../three/models/Pati3D';
import type { PatiGuideState } from '../three/models/PatiSprite';
import { buildTerrain } from './terrainMesh';
import type { FilmTerrain } from './terrainMesh';
import { T, rng, sampleCam } from './timeline';
import { keysFor } from './shots';
import { choreo } from './choreo';
import type { Rig } from './choreo';
import { buildSpace } from './space';
import { buildDome, buildSolarTower } from './props';
import { makeSparkles, makeStormRain } from './fx';

interface Api {
  ready: Promise<void>;
  warmup(t: number): void;
  render(t: number): void;
  terrain: FilmTerrain | null;
}
let resolveReady: () => void = () => undefined;
export const worldApi: Api = {
  ready: new Promise<void>((r) => (resolveReady = r)),
  warmup: () => undefined,
  render: () => undefined,
  terrain: null,
};

declare global {
  interface Window {
    __ov?: { sun?: boolean; ice?: boolean } | null;
    __dbg?: { p: [number, number, number]; l: [number, number, number]; fov?: number } | null;
  }
}

function makeStars(): Points {
  const n = 2600;
  const p = new Float32Array(n * 3);
  const c = new Float32Array(n * 3);
  const r = rng(4242);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const q = Math.sqrt(1 - u * u);
    p[i * 3] = Math.cos(a) * q * 100;
    p[i * 3 + 1] = u * 100;
    p[i * 3 + 2] = Math.sin(a) * q * 100;
    const b = 0.35 + Math.pow(r(), 2.5) * 0.65;
    const tint = r();
    c[i * 3] = b * (tint < 0.2 ? 0.8 : 1);
    c[i * 3 + 1] = b * (tint < 0.2 ? 0.9 : 1);
    c[i * 3 + 2] = b * (tint > 0.8 ? 0.85 : 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(p, 3));
  g.setAttribute('color', new BufferAttribute(c, 3));
  const m = new PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: AdditiveBlending, fog: false });
  const pts = new Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

export function World() {
  const { gl, scene, camera, advance } = useThree();
  const stars = useMemo(makeStars, []);
  const sunLight = useMemo(() => {
    const l = new DirectionalLight('#fff1dc', 9);
    l.castShadow = true;
    l.shadow.mapSize.set(4096, 4096);
    l.shadow.bias = -0.0015;
    l.shadow.normalBias = 0.05;
    return l;
  }, []);
  const kicker = useMemo(() => {
    const l = new DirectionalLight('#a9c4ff', 0);
    l.position.set(-1, 0.4, 1.4);
    return l;
  }, []);
  const fillLight = useMemo(() => new HemisphereLight('#9aa3b5', '#2a2d33', 0.6), []);
  const tower = useMemo(() => buildSolarTower(), []);
  const dome = useMemo(() => buildDome(12), []);
  const rain = useMemo(() => makeStormRain(1800, 90), []);
  const terrainGroup = useRef<Group>(null);
  const starGroup = useRef<Group>(null);
  const habitat = useRef<Group>(null);
  const commander = useRef<Group>(null);
  const pati = useRef<Group>(null);
  const drive = useRef<GaitDrive>({ speed: 0, phase: 0 });
  const patiState = useRef<PatiGuideState>({ pose: 'idle', face: 1, yaw: 0 });

  useEffect(() => {
    let alive = true;
    const g = gl as WebGLRenderer;
    const sc = scene as Scene;
    const cam = camera as PerspectiveCamera;
    sc.background = new Color('#000000');
    const rig: Rig = {
      terrain: null,
      space: null,
      sunLight,
      kicker,
      fill: fillLight,
      habitat: habitat.current,
      tower,
      dome,
      storm: rain,
      sparkles: null,
      commander: commander.current,
      commanderDrive: drive,
      pati: pati.current,
      patiState,
      terrainGroup: terrainGroup.current!,
      rain,
    };
    void (async () => {
      const [data, space] = await Promise.all([loadTerrain(), buildSpace()]);
      if (!alive) return;
      const ft = buildTerrain(data);
      worldApi.terrain = ft;
      rig.terrain = ft;
      rig.space = space;
      terrainGroup.current?.add(ft.mesh);
      sc.add(space.group);
      // ice glints over the real PSR cells of the small crater near the base
      const pts: number[] = [];
      const n = data.n;
      for (let r = 0; r < n; r += 1) {
        for (let c = 0; c < n; c += 1) {
          const i = r * n + c;
          if (!data.psr[i]) continue;
          if (((r * 7 + c * 13) & 1) !== 0) continue;
          const [x, z] = ft.cellXZ(r, c);
          if (Math.hypot(x - 250, z - 3270) > 1100) continue;
          pts.push(x, ft.frame.groundY(x, z) + 1.5, z);
        }
      }
      rig.sparkles = makeSparkles(new Float32Array(pts), '#bfe8ff', 9000, 22);
      terrainGroup.current?.add(rig.sparkles.points);
      resolveReady();
    })();

    const apply = (t: number): void => {
      const ft = rig.terrain;
      rig.habitat = habitat.current;
      rig.commander = commander.current;
      rig.pati = pati.current;
      const k = keysFor(t, ft);
      const dbg = window.__dbg;
      const cs = dbg ? { p: dbg.p, l: dbg.l, fov: dbg.fov ?? 40, up: 0 } : sampleCam(k.keys, t, k.fov);
      cam.fov = cs.fov;
      cam.near = dbg ? 0.2 : k.near;
      cam.far = dbg ? 400000 : k.far;
      cam.up.set(0, 1 - cs.up, cs.up).normalize();
      cam.position.set(...cs.p);
      cam.lookAt(cs.l[0], cs.l[1], cs.l[2]);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      if (starGroup.current) {
        starGroup.current.position.copy(cam.position);
        starGroup.current.scale.setScalar((cam.far * 0.4) / 100);
      }
      const ls = choreo(t, rig);
      const half = k.shadowHalf;
      const c = new Vector3(...k.shadowCenter);
      sunLight.position.copy(c).addScaledVector(ls.dir, half * 3);
      sunLight.target.position.copy(c);
      sunLight.target.updateMatrixWorld();
      const s2 = sunLight.shadow.camera;
      s2.left = -half;
      s2.right = half;
      s2.top = half;
      s2.bottom = -half;
      s2.near = half * 0.5;
      s2.far = half * 6;
      s2.updateProjectionMatrix();
      // kicker: a soft cool fill from the camera side
      kicker.position.copy(cam.position).sub(c).normalize().multiplyScalar(5).add(new Vector3(-1.5, 2, 0)).add(c);
      kicker.target.position.copy(c);
      kicker.target.updateMatrixWorld();
    };
    worldApi.render = (t) => {
      if (t < T.s2 - 0.001 || t >= T.s8) return;
      apply(t);
      advance(t);
    };
    worldApi.warmup = (t) => {
      if (t < T.s2 - 0.001) return;
      const r = g.render.bind(g);
      g.render = () => undefined;
      for (let i = 14; i >= 1; i--) {
        const tw = Math.max(0, t - i / 30);
        apply(tw);
        advance(tw);
      }
      g.render = r;
    };
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, advance, sunLight, kicker, fillLight, tower, dome, rain]);

  return (
    <>
      <primitive object={fillLight} />
      <primitive object={sunLight} />
      <primitive object={sunLight.target} />
      <primitive object={kicker} />
      <primitive object={kicker.target} />
      <group ref={starGroup}>
        <primitive object={stars} />
      </group>
      <group ref={terrainGroup}>
        <primitive object={tower.group} />
        <primitive object={dome.mesh} />
        <primitive object={rain.points} />
        <group ref={habitat} visible={false}>
          <Habitat />
        </group>
        <group ref={commander} visible={false} scale={1.15}>
          <Astronaut drive={drive} />
        </group>
        <group ref={pati} visible={false} scale={1.2}>
          <Pati3D state={patiState} />
        </group>
      </group>
    </>
  );
}

