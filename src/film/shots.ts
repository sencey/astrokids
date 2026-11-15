// Camera work. Each scene is a short list of keys; sampleCam turns them into one C1-smooth move.
import type { FilmTerrain } from './terrainMesh';
import { T } from './timeline';
import type { Key, V3 } from './timeline';
import { CRATER, HAB, STAGE3, TOWER_AT } from './choreo';

export interface ShotInfo {
  keys: Key[];
  fov: number;
  shadowHalf: number;
  shadowCenter: V3;
  near: number;
  far: number;
}

const rad = (d: number): number => (d * Math.PI) / 180;

export function keysFor(t: number, ft: FilmTerrain | null): ShotInfo {
  const G = (x: number, z: number): number => (ft ? ft.frame.groundY(x, z) : 0);
  const base = (keys: Key[], fov = 40, half = 9000, center: V3 = [0, 0, 0], near = 0.2, far = 400000): ShotInfo => ({ keys, fov, shadowHalf: half, shadowCenter: center, near, far });

  if (t < T.s2 + 3.0) {
    // scene 2a: globe dive toward the south pole
    return base(
      [
        { t: T.s2, p: [1.4, 0.7, 12], l: [-0.9, 0.3, 0], fov: 36 },
        { t: 4.5, p: [0.9, -0.1, 4.7], l: [0, -0.35, 0], fov: 38 },
        { t: 5.3, p: [0.2, -1.1, 2.4], l: [0, -0.9, 0], fov: 40, up: 0.6 },
        { t: 6.0, p: [0, -1.55, 0.6], l: [0, -1.0, 0], fov: 44, up: 1 },
      ],
      40,
      9000,
      [0, 0, 0],
      0.01,
      3000,
    );
  }
  if (t < T.s3) {
    // scene 2b: aerial over the Connecting Ridge while the data solidifies
    return base(
      [
        { t: 6.0, p: [-5200, 6400, 9300], l: [900, 300, 3200], fov: 44 },
        { t: 7.2, p: [-3600, 4300, 9400], l: [1400, 600, 3600], fov: 42 },
        { t: T.s3, p: [-1500, 2700, 8300], l: [1700, 700, 4000], fov: 40 },
      ],
      40,
      9500,
      [0, 0, 3000],
    );
  }
  if (t < T.s4) {
    // scene 3: low orbit around the commander and Pati, habitat behind
    const c: V3 = [STAGE3.x - 0.95, G(STAGE3.x, STAGE3.z) + 1.05, STAGE3.z + 0.5];
    const r = 5.4;
    const h = G(STAGE3.x, STAGE3.z) + 0.55;
    const at = (phiDeg: number, rr: number, hh: number): V3 => [c[0] + Math.sin(rad(phiDeg)) * rr, hh, c[2] + Math.cos(rad(phiDeg)) * rr];
    return base(
      [
        { t: T.s3, p: at(62, r + 0.8, h), l: [c[0], c[1] + 0.05, c[2]], fov: 34 },
        { t: 9.2, p: at(30, r, h + 0.1), l: [c[0], c[1] + 0.1, c[2]], fov: 34 },
        { t: T.s4, p: at(-8, r - 0.5, h + 0.2), l: [c[0], c[1] + 0.15, c[2]], fov: 33 },
      ],
      34,
      40,
      [c[0], c[1], c[2]],
      0.1,
      60000,
    );
  }
  if (t < T.s5) {
    // scene 4: glide over the ridge and tip toward the shadowed crater
    const p0: V3 = [2400, G(2400, 4800) + 260, 4800];
    const p1: V3 = [1500, G(1500, 4500) + 230, 4500];
    const p2: V3 = [880, G(880, 4300) + 400, 4300];
    const cl: V3 = [CRATER.x, G(CRATER.x, CRATER.z) - 20, CRATER.z];
    return base(
      [
        { t: T.s4, p: p0, l: [cl[0] + 500, cl[1] + 200, cl[2] + 600], fov: 46 },
        { t: 11.8, p: p1, l: [cl[0] + 100, cl[1] + 40, cl[2] + 140], fov: 44 },
        { t: T.s5, p: p2, l: [cl[0], cl[1] + 30, cl[2] + 80], fov: 42 },
      ],
      42,
      2600,
      [CRATER.x + 400, G(CRATER.x, CRATER.z), CRATER.z + 400],
    );
  }
  if (t < T.s6) {
    // scene 5: from a high view of the gold map down to the tower going up
    const tg = G(TOWER_AT.x, TOWER_AT.z);
    const tp: V3 = [TOWER_AT.x, tg + 5, TOWER_AT.z];
    return base(
      [
        { t: T.s5, p: [HAB.x - 800, G(HAB.x - 800, HAB.z + 900) + 700, HAB.z + 900], l: [HAB.x + 80, tg - 60, HAB.z - 160], fov: 46 },
        { t: 14.5, p: [TOWER_AT.x - 110, tg + 62, TOWER_AT.z + 150], l: [tp[0], tg + 6, tp[2]], fov: 40 },
        { t: 15.5, p: [TOWER_AT.x - 30, tg + 10, TOWER_AT.z + 40], l: [tp[0], tg + 5.8, tp[2]], fov: 38 },
        { t: T.s6, p: [TOWER_AT.x + 12, tg + 8, TOWER_AT.z + 36], l: [tp[0], tg + 6.4, tp[2]], fov: 36 },
      ],
      38,
      120,
      [TOWER_AT.x, tg, TOWER_AT.z],
      0.1,
      60000,
    );
  }
  if (t < T.s7) {
    // scene 6: the Sun erupts; the CME stream sweeps toward the Moon
    return base(
      [
        { t: T.s6, p: [2.6, 0.9, 4.6], l: [-3.2, 1.2, -9.0], fov: 42 },
        { t: 18.8, p: [2.3, 0.75, 3.9], l: [-3.0, 1.5, -9.5], fov: 41 },
        { t: T.s7, p: [2.0, 0.6, 3.4], l: [-2.8, 1.7, -10], fov: 40 },
      ],
      40,
      9000,
      [0, 0, 0],
      0.02,
      3000,
    );
  }
  if (t < T.s8) {
    // scene 7: tracking the run to the habitat, then the dome lights up
    const hg = G(HAB.x, HAB.z);
    return base(
      [
        { t: T.s7, p: [HAB.x - 5, hg + 1.3, HAB.z + 21.5], l: [HAB.x + 8, hg + 1.3, HAB.z + 16], fov: 38 },
        { t: 21.3, p: [HAB.x - 6.5, hg + 1.7, HAB.z + 15], l: [HAB.x + 2.5, hg + 1.6, HAB.z + 9.5], fov: 38 },
        { t: T.s8, p: [HAB.x - 19, hg + 5, HAB.z + 30], l: [HAB.x + 1, hg + 4.5, HAB.z + 6], fov: 40 },
      ],
      40,
      60,
      [HAB.x, hg, HAB.z + 8],
      0.1,
      60000,
    );
  }
  // scene 8 is pure HTML; keep the camera parked
  return base([{ t: 0, p: [0, 5000, 5000], l: [0, 0, 0] }]);
}


