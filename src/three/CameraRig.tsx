import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { CONFIG } from './config';
import type { CamRuntime, CameraMode, CelebrateKind, ExploreApi, ExploreSnapshot } from './exploreTypes';
import { prefersReducedMotion } from './motion';
import type { TerrainFrame } from './types';

/** Imperative camera API used by the on-screen buttons (big rotate buttons help kids who struggle with drag). */
export interface CamApi {
  /** orbit: turn around the target by dTheta radians. iso: turn the view by one 90 degree step (sign of dTheta). */
  rotate(dTheta: number): void;
  tilt(dPhi: number): void;
  /** orbit: dolly by factor (<1 = closer). iso: change the follow distance by the same factor. */
  zoom(factor: number): void;
  overview(): void;
  /** low "commander's eye" view standing just behind (x,z), looking out toward grid azimuth azDeg (level, so the horizon and Earth/Sun are in frame) */
  ground(x: number, z: number, unit: number, azDeg: number): void;
  /** glide the orbit target to a ground point over ~0.8 s (ease-in-out), keeping distance and angle; clamped to the site */
  focusOn(point: [number, number, number] | { x: number; z: number }): void;
  /** 'iso' = fixed isometric view that follows the commander; 'orbit' = the free base-building camera (returns to the overview) */
  setCameraMode(mode: CameraMode): void;
  getCameraMode(): CameraMode;
  /** iso only: rotate the view by 90 degrees (+1 / -1) */
  isoRotate(step: 1 | -1): void;
  // ---- explore (no-ops / null while MoonScene's exploreMode is false)
  walkTo(target: [number, number]): void;
  goHome(): void;
  startOuting(budget?: number): void;
  setPatiTalking(on: boolean): void;
  /** star burst + Pati hop at the commander (explore only; one per success) */
  celebrate(kind: CelebrateKind): void;
  getExploreState(): ExploreSnapshot | null;
}

const PHI_MIN = 0.12;
const PHI_MAX = 1.53;
const D2R = Math.PI / 180;

/** Narrow (portrait) viewports pull the overview back so the site width still fits. */
export function overviewFactor(aspect: number): number {
  return Math.min(2.6, Math.max(1, 1.22 / Math.max(0.2, aspect)));
}
export function overviewPosition(e: number, aspect = 1.6): [number, number, number] {
  const f = overviewFactor(aspect);
  return [0, e * 0.5 * f, e * 0.8 * f];
}

interface Ctl {
  target: Vector3;
  update(): boolean;
  enableRotate: boolean;
  minDistance: number;
  maxDistance: number;
}
interface IsoState {
  on: boolean;
  yaw: number;
  pitch: number;
  tx: number;
  ty: number;
  tz: number;
  dist: number;
  goalDist: number;
  /** the distance this code wrote last frame; OrbitControls' wheel/pinch dolly shows up as a difference */
  written: number;
  fov0: number;
  near0: number;
  /** follow spring velocity (critically damped) */
  vx: number;
  vz: number;
  /** entry glide (0.6 s): start state and elapsed time; t >= dur means finished */
  entry: { t: number; yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number };
  /** 90 degree rotation animation (0.4 s) */
  rot: { t: number; from: number; to: number; step: number };
  /** iso was entered at least once (the first entry snaps instead of gliding) */
  entered: boolean;
}

const ENTRY_S = 0.6;
const ROT_S = 0.4;
const FOLLOW_SMOOTH_S = 0.35;
/** the child's zoom, as a multiple of the default distance; kept for the rest of the session (module scope survives re-entering explore) */
let sessionZoomMul = 1;
const smooth01 = (u: number) => u * u * (3 - 2 * u);

export function CameraRig({
  frame,
  api,
  minDistance,
  rt,
  explore,
}: {
  frame: TerrainFrame;
  api: MutableRefObject<CamApi | null>;
  minDistance: number;
  rt: MutableRefObject<CamRuntime>;
  explore: MutableRefObject<ExploreApi | null>;
}) {
  const e = frame.extent;
  const controls = useRef<Ctl | null>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const touched = useRef(false);
  const goal = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  const sph = useRef(new Spherical());
  const glide = useRef<{ t: number; dur: number; p0: Vector3; t0: Vector3; p1: Vector3; t1: Vector3 } | null>(null);
  const iso = useRef<IsoState>({ on: false, yaw: 0, pitch: 0, tx: 0, ty: 0, tz: 0, dist: 0, goalDist: 0, written: 0, fov0: 45, near0: 1, vx: 0, vz: 0, entry: { t: 9, yaw: 0, pitch: 0, dist: 0, tx: 0, ty: 0, tz: 0 }, rot: { t: 9, from: 0, to: 0, step: 0 }, entered: false });
  // same scale in portrait and landscape (the vertical fov is fixed), so the commander never gets smaller on a phone
  const isoDefaultDist = () => CONFIG.iso.dist;

  useEffect(() => {
    const maxD = Math.max(e * 1.5, e * 0.94 * overviewFactor(aspect) * 1.05);
    const cur = () => {
      const t = goal.current?.target ?? controls.current!.target;
      const p = goal.current?.pos ?? camera.position;
      return { t: t.clone(), p: p.clone() };
    };
    const set = (p: Vector3, t: Vector3) => {
      glide.current = null;
      goal.current = { pos: p, target: t };
    };
    const spherical = (mod: (s: Spherical) => void) => {
      if (!controls.current) return;
      const { t, p } = cur();
      sph.current.setFromVector3(p.sub(t));
      mod(sph.current);
      sph.current.phi = Math.max(PHI_MIN, Math.min(PHI_MAX, sph.current.phi));
      sph.current.radius = Math.max(minDistance, Math.min(maxD, sph.current.radius));
      set(new Vector3().setFromSpherical(sph.current).add(t), t);
    };
    const inIso = () => rt.current.mode === 'iso';
    const toOrbit = () => {
      rt.current.mode = 'orbit';
    };
    api.current = {
      rotate: (d) => {
        if (inIso()) rt.current.yawStep += d >= 0 ? 1 : -1;
        else spherical((s) => (s.theta += d));
      },
      tilt: (d) => {
        if (!inIso()) spherical((s) => (s.phi += d));
      },
      zoom: (f) => {
        if (inIso()) {
          rt.current.userZoomAt = performance.now();
          iso.current.goalDist = Math.max(CONFIG.iso.minDist, Math.min(CONFIG.iso.maxDist, iso.current.goalDist * f));
          sessionZoomMul = iso.current.goalDist / isoDefaultDist();
        } else spherical((s) => (s.radius *= f));
      },
      overview: () => {
        toOrbit();
        set(new Vector3(...overviewPosition(e, aspect)), new Vector3(0, 0, 0));
      },
      ground: (x, z, unit, azDeg) => {
        toOrbit();
        const dx = Math.sin((azDeg * Math.PI) / 180);
        const dz = -Math.cos((azDeg * Math.PI) / 180);
        // aim at the middle of lander + astronaut + Pati (the crew stands at about +7.8,+3.7 units from the lander)
        const mx = x + 3.9 * unit;
        const mz = z + 1.85 * unit;
        const back = (aspect < 1 ? 30 : 26) * unit;
        const px = mx - dx * back;
        const pz = mz - dz * back;
        const y = Math.max(frame.groundY(px, pz), frame.groundY(mx, mz)) + 5 * unit;
        set(new Vector3(px, y, pz), new Vector3(mx + dx * 50 * unit, y - 4.4 * unit, mz + dz * 50 * unit));
      },
      focusOn: (pt) => {
        const c = controls.current;
        if (!c || inIso()) return;
        const px = Array.isArray(pt) ? pt[0] : pt.x;
        const pz = Array.isArray(pt) ? pt[2] : pt.z;
        const half = e * 0.5 * 0.96;
        const tx = Math.max(-half, Math.min(half, px));
        const tz = Math.max(-half, Math.min(half, pz));
        const t1 = new Vector3(tx, frame.groundY(tx, tz), tz);
        const t0 = c.target.clone();
        const p0 = camera.position.clone();
        const p1 = p0.clone().sub(t0).add(t1);
        const floor = frame.groundY(p1.x, p1.z) + Math.max(minDistance * 0.15, frame.cell * 0.6);
        if (p1.y < floor) p1.y = floor;
        goal.current = null;
        touched.current = true;
        glide.current = { t: 0, dur: prefersReducedMotion() ? 0.01 : 0.8, p0, t0, p1, t1 };
      },
      setCameraMode: (m) => {
        rt.current.mode = m;
        if (m === 'orbit') set(new Vector3(...overviewPosition(e, aspect)), new Vector3(0, 0, 0));
      },
      getCameraMode: () => rt.current.mode,
      isoRotate: (s) => {
        rt.current.yawStep += s;
      },
      walkTo: (p) => explore.current?.walkTo(p),
      goHome: () => explore.current?.goHome(),
      startOuting: (b) => explore.current?.startOuting(b),
      setPatiTalking: (on) => explore.current?.setPatiTalking(on),
      celebrate: (k) => explore.current?.celebrate(k),
      getExploreState: () => explore.current?.getState() ?? null,
    };
    return () => {
      api.current = null;
    };
  }, [api, camera, e, frame, minDistance, aspect, rt, explore]);

  // default framing follows the viewport shape (portrait phones need a farther camera); never fights the child's own camera moves
  useEffect(() => {
    if (touched.current || rt.current.mode === 'iso') return;
    camera.position.set(...overviewPosition(e, aspect));
    controls.current?.target.set(0, 0, 0);
    goal.current = null;
  }, [camera, e, aspect, rt]);

  const enterIso = (c: Ctl) => {
    const s = iso.current;
    s.entered = true;
    const cam = camera as PerspectiveCamera;
    const off = camera.position.clone().sub(c.target);
    const r = Math.max(1, off.length());
    s.on = true;
    s.yaw = Math.atan2(off.x, off.z);
    s.pitch = Math.asin(Math.max(-1, Math.min(1, off.y / r)));
    s.tx = c.target.x;
    s.ty = c.target.y;
    s.tz = c.target.z;
    s.dist = r;
    s.written = r;
    s.goalDist = Math.max(CONFIG.iso.minDist, Math.min(CONFIG.iso.maxDist, isoDefaultDist() * sessionZoomMul));
    s.vx = 0;
    s.vz = 0;
    s.entry = { t: 0, yaw: s.yaw, pitch: s.pitch, dist: s.dist, tx: s.tx, ty: s.ty, tz: s.tz };
    s.rot = { t: 9, from: 0, to: 0, step: rt.current.yawStep };
    s.fov0 = cam.fov;
    s.near0 = cam.near;
    glide.current = null;
    goal.current = null;
    touched.current = true;
    c.enableRotate = false;
    if (cam.isPerspectiveCamera) {
      cam.near = CONFIG.iso.near; // fov eases in with the entry glide
      cam.updateProjectionMatrix();
    }
  };
  /** jump straight to the iso follow pose behind the commander (no glide) */
  const snapToFollow = (c: Ctl, f: { x: number; z: number }) => {
    const s = iso.current;
    const I = CONFIG.iso;
    const cam = camera as PerspectiveCamera;
    s.entered = true;
    s.tx = f.x;
    s.tz = f.z;
    s.ty = frame.groundY(f.x, f.z);
    s.yaw = (I.yawDeg + rt.current.yawStep * 90) * D2R;
    s.pitch = I.pitchDeg * D2R;
    s.dist = s.goalDist;
    s.written = s.dist;
    s.vx = 0;
    s.vz = 0;
    s.entry.t = ENTRY_S;
    s.rot.step = rt.current.yawStep;
    if (cam.isPerspectiveCamera) {
      cam.fov = I.fov;
      cam.near = I.near;
      cam.updateProjectionMatrix();
    }
    const cp = Math.cos(s.pitch);
    c.target.set(s.tx, s.ty, s.tz);
    camera.position.set(s.tx + Math.sin(s.yaw) * cp * s.dist, s.ty + Math.sin(s.pitch) * s.dist, s.tz + Math.cos(s.yaw) * cp * s.dist);
    camera.lookAt(c.target);
  };
  const leaveIso = (c: Ctl) => {
    const s = iso.current;
    s.on = false;
    c.enableRotate = true;
    c.minDistance = minDistance;
    c.maxDistance = Math.max(e * 1.5, e * 0.94 * overviewFactor(aspect) * 1.05);
    // fov / near ease back in the orbit branch of useFrame
    goal.current = { pos: new Vector3(...overviewPosition(e, aspect)), target: new Vector3(0, 0, 0) };
  };

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const I = CONFIG.iso;
    const s = iso.current;
    const wantIso = rt.current.mode === 'iso';
    // First time in explore (the world flow is in explore from mount): wait until the commander exists, then SNAP to the follow pose so
    // the very first frame shows commander + Pati + base. Later entries (base-builder -> explore) keep the 0.6 s glide.
    if (wantIso && !s.on) {
      const f0 = rt.current.follow;
      if (!f0 && !s.entered) {
        /* commander not mounted yet: stay on the overview for a few frames */
      } else {
        const first = !s.entered;
        enterIso(c);
        if (first && f0) snapToFollow(c, f0);
      }
    } else if (!wantIso && s.on) leaveIso(c);

    if (s.on) {
      // OrbitControls has already run this frame (priority -1): its wheel / pinch dolly changed the distance. Take that as the zoom goal.
      const r = camera.position.distanceTo(c.target);
      if (Math.abs(r - s.written) > s.written * 1e-3) {
        s.goalDist = Math.max(I.minDist, Math.min(I.maxDist, r));
        sessionZoomMul = s.goalDist / isoDefaultDist();
        rt.current.userZoomAt = performance.now();
      }
      const reduce = prefersReducedMotion();
      const d = Math.min(dt, 0.05);
      const k = reduce ? 1 : 1 - Math.exp(-dt * 6);
      const f = rt.current.follow;
      // rotation: 90 degree steps, eased over ~0.4 s
      const goalYaw = (I.yawDeg + rt.current.yawStep * 90) * D2R;
      const rot = s.rot;
      if (rot.step !== rt.current.yawStep) {
        rot.step = rt.current.yawStep;
        rot.from = s.yaw;
        rot.to = goalYaw;
        rot.t = reduce ? ROT_S : 0;
      }
      if (rot.t < ROT_S) {
        rot.t = Math.min(ROT_S, rot.t + d);
        let dy = rot.to - rot.from;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        s.yaw = rot.from + dy * smooth01(rot.t / ROT_S);
      }
      const en = s.entry;
      const entering = en.t < ENTRY_S;
      if (entering) {
        en.t = reduce ? ENTRY_S : Math.min(ENTRY_S, en.t + d);
        const u = smooth01(en.t / ENTRY_S);
        let dy = goalYaw - en.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const gx = f ? f.x : s.tx;
        const gz = f ? f.z : s.tz;
        s.yaw = en.yaw + dy * u;
        s.pitch = en.pitch + (I.pitchDeg * D2R - en.pitch) * u;
        s.dist = en.dist + (s.goalDist - en.dist) * u;
        s.tx = en.tx + (gx - en.tx) * u;
        s.tz = en.tz + (gz - en.tz) * u;
        s.vx = 0;
        s.vz = 0;
        const cam = camera as PerspectiveCamera;
        if (cam.isPerspectiveCamera) {
          cam.fov = s.fov0 + (I.fov - s.fov0) * u;
          cam.updateProjectionMatrix();
        }
        s.ty = en.ty + (frame.groundY(s.tx, s.tz) - en.ty) * u;
      } else {
        s.pitch = I.pitchDeg * D2R;
        s.dist += (s.goalDist - s.dist) * k;
        if (f) {
          // critically damped follow (no overshoot), ~0.35 s smooth time; stands perfectly still when the commander does
          const om = 2 / FOLLOW_SMOOTH_S;
          const x = om * d;
          const ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
          const ox = s.tx - f.x;
          const oz = s.tz - f.z;
          const tx0 = s.vx + om * ox;
          const tz0 = s.vz + om * oz;
          s.vx = (s.vx - om * tx0 * d) * ex;
          s.vz = (s.vz - om * tz0 * d) * ex;
          s.tx = f.x + (ox + tx0 * d) * ex;
          s.tz = f.z + (oz + tz0 * d) * ex;
          if (reduce || (Math.abs(s.tx - f.x) < 0.01 && Math.abs(s.tz - f.z) < 0.01 && Math.abs(s.vx) < 0.01 && Math.abs(s.vz) < 0.01)) {
            s.tx = f.x;
            s.tz = f.z;
            s.vx = 0;
            s.vz = 0;
          }
        }
        s.ty += (frame.groundY(s.tx, s.tz) - s.ty) * k;
      }
      // keep the dolly limits wide enough while the first approach from the overview is still running
      c.minDistance = I.minDist;
      c.maxDistance = s.dist > I.maxDist ? 1e9 : I.maxDist;
      const cp = Math.cos(s.pitch);
      c.target.set(s.tx, s.ty, s.tz);
      camera.position.set(s.tx + Math.sin(s.yaw) * cp * s.dist, s.ty + Math.sin(s.pitch) * s.dist, s.tz + Math.cos(s.yaw) * cp * s.dist);
      camera.lookAt(c.target);
      s.written = s.dist;
      return;
    }

    const pc = camera as PerspectiveCamera;
    if (pc.isPerspectiveCamera && Math.abs(pc.fov - s.fov0) > 0.01 && s.entry.dist > 0) {
      pc.fov += (s.fov0 - pc.fov) * (prefersReducedMotion() ? 1 : 1 - Math.exp(-dt * 5));
      if (Math.abs(pc.fov - s.fov0) <= 0.01) {
        pc.fov = s.fov0;
        pc.near = s.near0;
      }
      pc.updateProjectionMatrix();
    }
    const gl = glide.current;
    if (gl) {
      gl.t += Math.min(dt, 0.05);
      const u = Math.min(1, gl.t / gl.dur);
      const k = u * u * (3 - 2 * u); // ease-in-out
      camera.position.lerpVectors(gl.p0, gl.p1, k);
      c.target.lerpVectors(gl.t0, gl.t1, k);
      if (u >= 1) glide.current = null;
    }
    const g = goal.current;
    if (g) {
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(g.pos, k);
      c.target.lerp(g.target, k);
      if (camera.position.distanceTo(g.pos) < e * 0.0005) goal.current = null;
    }
    // never under the ground
    const p = camera.position;
    const floor = frame.groundY(p.x, p.z) + Math.max(minDistance * 0.15, frame.cell * 0.6);
    if (p.y < floor) p.y = floor;
  });

  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={minDistance}
      maxDistance={Math.max(e * 1.5, e * 0.94 * overviewFactor(aspect) * 1.05)}
      minPolarAngle={PHI_MIN}
      maxPolarAngle={PHI_MAX}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      onStart={() => {
        touched.current = true;
        goal.current = null;
        glide.current = null;
      }}
    />
  );
}


