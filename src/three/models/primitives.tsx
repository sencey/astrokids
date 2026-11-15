// Procedural lunar hardware (1 unit = 1 m, origin at ground centre, Y up). These are the fallbacks used when no
// public/models/<id>.glb exists. Real-looking but light: canvas textures (<= 512 px, generated once), shared
// materials and geometry, a few hundred to ~2k triangles per model.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { DoubleSide, Group, LatheGeometry, Mesh, MeshStandardMaterial, Quaternion, Vector2, Vector3 } from 'three';
import { useSky } from '../SkyContext';
import { lumpyMound, meshWheelTexture, mliTexture, quiltTexture, regolithTexture, solarCellTexture, withRepeat } from './proc';

const WHITE = '#e9eaee';
const ORANGE = '#ff7a1a';
const GREY = '#8d9099';
const UP = new Vector3(0, 1, 0);

interface Mats {
  white: MeshStandardMaterial;
  orange: MeshStandardMaterial;
  orangeGlow: MeshStandardMaterial;
  grey: MeshStandardMaterial;
  silver: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  fabricBody: MeshStandardMaterial;
  fabricDome: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  panel: MeshStandardMaterial;
  panelBack: MeshStandardMaterial;
  mli: MeshStandardMaterial;
  mliTop: MeshStandardMaterial;
  regolith: MeshStandardMaterial;
  wheel: MeshStandardMaterial;
  visor: MeshStandardMaterial;
  leaf: MeshStandardMaterial;
  soil: MeshStandardMaterial;
  glassDome: MeshStandardMaterial;
  growLight: MeshStandardMaterial;
}

let cached: Mats | null = null;
/** Shared materials, created on first render (needs `document` for the canvas textures). */
function M(): Mats {
  if (cached) return cached;
  const quilt = quiltTexture();
  const mli = mliTexture();
  const reg = regolithTexture();
  const fabric = (rx: number, ry: number) => {
    const t = withRepeat(quilt, rx, ry);
    return new MeshStandardMaterial({ color: '#f6f6f8', map: t, bumpMap: t, bumpScale: 1.6, roughness: 0.9, metalness: 0 });
  };
  const mliTile = withRepeat(mli, 2, 1);
  cached = {
    white: new MeshStandardMaterial({ color: WHITE, roughness: 0.5, metalness: 0.1 }),
    orange: new MeshStandardMaterial({ color: ORANGE, roughness: 0.6 }),
    orangeGlow: new MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.6 }),
    grey: new MeshStandardMaterial({ color: GREY, metalness: 0.5, roughness: 0.5 }),
    silver: new MeshStandardMaterial({ color: '#c9ced8', metalness: 0.85, roughness: 0.35 }),
    dark: new MeshStandardMaterial({ color: '#2a2c33', roughness: 0.85 }),
    fabricBody: fabric(3, 0.6),
    fabricDome: fabric(3, 0.5),
    glass: new MeshStandardMaterial({ color: '#16202e', emissive: '#ffcf8a', emissiveIntensity: 0.75, roughness: 0.2, metalness: 0.2 }),
    panel: new MeshStandardMaterial({ map: solarCellTexture(), metalness: 0.55, roughness: 0.3, emissive: '#0a1a52', emissiveIntensity: 0.35 }),
    panelBack: new MeshStandardMaterial({ color: '#4a4f5c', roughness: 0.7, metalness: 0.45 }),
    mli: new MeshStandardMaterial({ color: '#ffffff', map: mliTile, bumpMap: mliTile, bumpScale: 2.2, roughnessMap: mliTile, roughness: 0.85, metalness: 0.85 }),
    mliTop: new MeshStandardMaterial({ color: '#e6c25a', map: mli, bumpMap: mli, bumpScale: 1.5, roughnessMap: mli, roughness: 0.8, metalness: 0.8 }),
    regolith: new MeshStandardMaterial({ color: '#6f6e6b', map: withRepeat(reg, 4, 2), bumpMap: withRepeat(reg, 4, 2), bumpScale: 2.5, roughness: 1 }),
    wheel: new MeshStandardMaterial({ map: meshWheelTexture(), roughness: 0.9, metalness: 0.4 }),
    visor: new MeshStandardMaterial({ color: '#d8a93a', metalness: 0.95, roughness: 0.12 }),
    leaf: new MeshStandardMaterial({ color: '#58c24a', emissive: '#1f7a2a', emissiveIntensity: 0.7, roughness: 0.8 }),
    soil: new MeshStandardMaterial({ color: '#3a2f28', roughness: 1 }),
    glassDome: new MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.26, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    growLight: new MeshStandardMaterial({ color: '#ffb0e8', emissive: '#ff6ad5', emissiveIntensity: 0.9 }),
  };
  return cached;
}

/** A cylinder strut between two points. */
function Strut({ a, b, r = 0.05, mat }: { a: [number, number, number]; b: [number, number, number]; r?: number; mat: MeshStandardMaterial }) {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const q = new Quaternion().setFromUnitVectors(UP, vb.clone().sub(va).normalize());
  return (
    <mesh position={mid} quaternion={q} material={mat} castShadow>
      <cylinderGeometry args={[r, r, va.distanceTo(vb), 6]} />
    </mesh>
  );
}

export function Habitat() {
  const m = M();
  const windows = [-2.0, -1.2, 1.2, 2.0, Math.PI];
  return (
    <group dispose={null}>
      {/* heaped regolith footing */}
      <mesh geometry={lumpyMound(3.3, 6.1, 1.0, 3)} material={m.regolith} castShadow receiveShadow />
      {/* inflatable module: quilted soft-fabric cylinder + dome */}
      <mesh position={[0, 1.9, 0]} material={m.fabricBody} castShadow receiveShadow>
        <cylinderGeometry args={[3, 3, 3.8, 32]} />
      </mesh>
      <mesh position={[0, 3.8, 0]} material={m.fabricDome} castShadow>
        <sphereGeometry args={[3, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* orange band */}
      <mesh position={[0, 1.8, 0]} material={m.orange}>
        <cylinderGeometry args={[3.05, 3.05, 0.6, 32]} />
      </mesh>
      {/* windows that glow faintly */}
      {windows.map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <mesh position={[0, 2.75, 3.0]} material={m.dark}>
            <boxGeometry args={[0.66, 0.82, 0.1]} />
          </mesh>
          <mesh position={[0, 2.75, 3.06]} material={m.glass}>
            <boxGeometry args={[0.5, 0.66, 0.06]} />
          </mesh>
        </group>
      ))}
      {/* airlock tube + hatch */}
      <mesh position={[0, 1.3, 3.6]} rotation={[Math.PI / 2, 0, 0]} material={m.white} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 1.4, 20]} />
      </mesh>
      <mesh position={[0, 1.3, 4.32]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.7, 0.7, 0.1, 20]} />
      </mesh>
      <mesh position={[0, 1.3, 4.38]} rotation={[Math.PI / 2, 0, 0]} material={m.orange}>
        <torusGeometry args={[0.72, 0.06, 6, 20]} />
      </mesh>
      {/* comms whip on the dome */}
      <mesh position={[0, 7.3, 0]} material={m.silver} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.8, 6]} />
      </mesh>
      <mesh position={[0, 8.25, 0]} material={m.orangeGlow}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </mesh>
    </group>
  );
}

export function SolarTower() {
  const sky = useSky();
  const panel = useRef<Group>(null);
  const m = M();
  useFrame(() => {
    const d = sky.current.sunDir;
    if (panel.current) panel.current.rotation.y = Math.atan2(d.x, d.z); // panel stands vertical, turns to face the Sun
  });
  // BoxGeometry material order: +x -x +y -y +z -z  (+z faces the Sun, -z is the grey back)
  const sides = [m.silver, m.silver, m.silver, m.silver, m.panel, m.panelBack];
  return (
    <group dispose={null}>
      <mesh position={[0, 4.5, 0]} material={m.grey} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 9, 12]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={m.grey} receiveShadow>
        <cylinderGeometry args={[1.2, 1.6, 0.6, 14]} />
      </mesh>
      <group ref={panel} position={[0, 8.2, 0]} name="panel">
        <mesh castShadow material={sides}>
          <boxGeometry args={[7, 9, 0.18]} />
        </mesh>
        {/* silver frame */}
        <mesh position={[0, 4.55, 0]} material={m.silver}>
          <boxGeometry args={[7.2, 0.14, 0.26]} />
        </mesh>
        <mesh position={[0, -4.55, 0]} material={m.silver}>
          <boxGeometry args={[7.2, 0.14, 0.26]} />
        </mesh>
        <mesh position={[-3.55, 0, 0]} material={m.silver}>
          <boxGeometry args={[0.14, 9, 0.26]} />
        </mesh>
        <mesh position={[3.55, 0, 0]} material={m.silver}>
          <boxGeometry args={[0.14, 9, 0.26]} />
        </mesh>
        {/* yoke where the mast meets the panel */}
        <mesh position={[0, -0.2, -0.3]} material={m.grey}>
          <boxGeometry args={[0.7, 1.4, 0.4]} />
        </mesh>
      </group>
    </group>
  );
}

export function Greenhouse() {
  const m = M();
  const rows = [-1.4, 0, 1.4];
  return (
    <group dispose={null}>
      <mesh position={[0, 0.25, 0]} material={m.white} receiveShadow>
        <cylinderGeometry args={[3.8, 4, 0.5, 32]} />
      </mesh>
      {/* planting beds with plants */}
      <mesh position={[0, 0.55, 0]} material={m.soil}>
        <cylinderGeometry args={[2.9, 3, 0.2, 24]} />
      </mesh>
      {rows.flatMap((x) =>
        [-1.6, -0.5, 0.6, 1.6].map((z, j) => {
          const edge = Math.hypot(x, z * 0.9);
          if (edge > 2.5) return null;
          return (
            <group key={`${x}_${z}`} position={[x, 0.65, z]} rotation={[0, (x + z) * 2.3, 0]}>
              <mesh position={[0, 0.35 + (j % 2) * 0.1, 0]} material={m.leaf} castShadow>
                <icosahedronGeometry args={[0.38, 0]} />
              </mesh>
              <mesh position={[0.18, 0.15, 0.1]} material={m.leaf}>
                <coneGeometry args={[0.2, 0.55, 6]} />
              </mesh>
            </group>
          );
        }),
      )}
      {/* grow-light strip under the apex */}
      <mesh position={[0, 3.0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.growLight}>
        <cylinderGeometry args={[0.07, 0.07, 3.2, 6]} />
      </mesh>
      {/* translucent dome and its ribs */}
      <mesh position={[0, 0.5, 0]} material={m.glassDome}>
        <sphereGeometry args={[3.7, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.5, 0]} rotation={[0, (i * Math.PI) / 4, 0]} material={m.silver}>
          <torusGeometry args={[3.7, 0.05, 6, 28, Math.PI]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Six-wheeled rover on a rocker-bogie suspension (per side: a rocker from the front wheel up to the chassis pivot and back to a
 * bogie that carries the middle and rear wheels), low chassis, small solar deck, mast with a camera head. Front = +x.
 * `drive.current.phase` (radians) turns the wheels; the day actors advance it with the distance driven.
 */
export function Rover({ drive }: { drive?: MutableRefObject<GaitDrive> }) {
  const m = M();
  const wheels = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const ph = drive?.current.phase ?? 0;
    wheels.current.forEach((w) => {
      if (w) w.rotation.y = -ph;
    });
  });
  const R = 0.46;
  const zs = [-1.15, 1.15];
  const wx = [1.5, -0.1, -1.55]; // front, middle, rear wheel centres
  const pivotY = 1.12;
  return (
    <group dispose={null}>
      {/* low chassis + orange trim */}
      <mesh position={[0, 1.25, 0]} material={m.white} castShadow>
        <boxGeometry args={[2.9, 0.55, 1.6]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={m.orange}>
        <boxGeometry args={[2.94, 0.1, 1.64]} />
      </mesh>
      {/* science bay at the front */}
      <mesh position={[1.0, 1.7, 0]} material={m.white} castShadow>
        <boxGeometry args={[1.0, 0.4, 1.2]} />
      </mesh>
      <mesh position={[1.52, 1.72, 0]} material={m.glass}>
        <boxGeometry args={[0.05, 0.22, 0.9]} />
      </mesh>
      {/* small solar deck on the back */}
      <mesh position={[-0.55, 1.56, 0]} material={m.panel} castShadow>
        <boxGeometry args={[1.5, 0.05, 1.4]} />
      </mesh>
      {/* mast with camera head */}
      <mesh position={[0.35, 2.2, 0.55]} material={m.grey}>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 6]} />
      </mesh>
      <mesh position={[0.35, 2.9, 0.55]} material={m.dark}>
        <boxGeometry args={[0.36, 0.2, 0.3]} />
      </mesh>
      <mesh position={[0.54, 2.9, 0.45]} material={m.glass}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 8]} />
      </mesh>
      <mesh position={[0.54, 2.9, 0.65]} material={m.glass}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 8]} />
      </mesh>
      {/* differential bar across the chassis */}
      <mesh position={[0.25, pivotY, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.grey}>
        <cylinderGeometry args={[0.06, 0.06, 2.3, 6]} />
      </mesh>
      {zs.map((z) => (
        <group key={z}>
          {/* rocker: front wheel -> chassis pivot -> bogie pivot */}
          <Strut a={[wx[0], R, z]} b={[0.25, pivotY, z]} r={0.065} mat={m.silver} />
          <Strut a={[0.25, pivotY, z]} b={[-0.85, 0.95, z]} r={0.065} mat={m.silver} />
          {/* bogie: middle and rear wheels */}
          <Strut a={[-0.85, 0.95, z]} b={[wx[1], R, z]} r={0.06} mat={m.silver} />
          <Strut a={[-0.85, 0.95, z]} b={[wx[2], R, z]} r={0.06} mat={m.silver} />
          <mesh position={[-0.85, 0.95, z]} material={m.dark}>
            <sphereGeometry args={[0.1, 8, 6]} />
          </mesh>
        </group>
      ))}
      {/* six mesh wheels: rotated so the cylinder axis lies along z; the inner group spins about it */}
      {zs.flatMap((z, zi) =>
        wx.map((x, xi) => (
          <group key={`${z}_${x}`} position={[x, R, z + (z > 0 ? 0.1 : -0.1)]} rotation={[Math.PI / 2, 0, 0]}>
            <group ref={(g) => void (wheels.current[zi * 3 + xi] = g)}>
              <mesh material={m.wheel} castShadow>
                <cylinderGeometry args={[R, R, 0.4, 16]} />
              </mesh>
              <mesh position={[0, z > 0 ? 0.22 : -0.22, 0]} material={m.silver}>
                <cylinderGeometry args={[0.16, 0.16, 0.05, 8]} />
              </mesh>
              <mesh position={[0.3, z > 0 ? 0.22 : -0.22, 0]} material={m.orange}>
                <boxGeometry args={[0.1, 0.04, 0.1]} />
              </mesh>
            </group>
          </group>
        )),
      )}
    </group>
  );
}

/**
 * Energy storage unit: a squat insulated cabinet with radiator fins on both sides and a front charge bar.
 * `fill` 0..1 = battery / capacity (green above 50%, amber above 20%, red below). Front = +z.
 */
export function BatteryUnit({ fill = 0.5 }: { fill?: number }) {
  const m = M();
  const f = Math.max(0, Math.min(1, fill));
  const barColor = f > 0.5 ? '#3ddc7a' : f > 0.2 ? '#ffc933' : '#ff5a4a';
  const H = 0.9; // charge bar full height
  return (
    <group dispose={null}>
      {/* footing + cabinet + gold insulation lid */}
      <mesh position={[0, 0.2, 0]} material={m.grey} receiveShadow>
        <boxGeometry args={[4.2, 0.4, 3.0]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={m.white} castShadow>
        <boxGeometry args={[3.4, 1.6, 2.2]} />
      </mesh>
      <mesh position={[0, 2.05, 0]} material={m.mliTop} castShadow>
        <boxGeometry args={[3.5, 0.18, 2.3]} />
      </mesh>
      <mesh position={[0, 0.75, 0]} material={m.orange}>
        <boxGeometry args={[3.44, 0.12, 2.24]} />
      </mesh>
      {/* radiator fins on both ends */}
      {[-1, 1].flatMap((s) =>
        [0, 1, 2, 3, 4].map((i) => (
          <mesh key={`${s}${i}`} position={[s * 2.05, 1.2, -0.85 + i * 0.425]} material={m.silver} castShadow>
            <boxGeometry args={[0.6, 1.3, 0.06]} />
          </mesh>
        )),
      )}
      {/* front panel: dark slot with the charge bar */}
      <mesh position={[0, 1.25, 1.12]} material={m.dark}>
        <boxGeometry args={[0.5, 1.1, 0.06]} />
      </mesh>
      <mesh position={[0, 0.75 + 0.1 + (H * Math.max(f, 0.02)) / 2, 1.16]}>
        <boxGeometry args={[0.34, H * Math.max(f, 0.02), 0.05]} />
        <meshStandardMaterial color={barColor} emissive={barColor} emissiveIntensity={0.9} />
      </mesh>
      {/* cable stub + indicator light */}
      <mesh position={[1.2, 0.75, 1.2]} rotation={[Math.PI / 2, 0, 0]} material={m.dark}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 6]} />
      </mesh>
      <mesh position={[-1.0, 1.9, 1.12]} material={m.orangeGlow}>
        <boxGeometry args={[0.2, 0.1, 0.04]} />
      </mesh>
    </group>
  );
}

export function Antenna() {
  const sky = useSky();
  const dish = useRef<Group>(null);
  const q = useRef(new Quaternion());
  const m = M();
  useFrame(() => {
    if (!dish.current) return;
    q.current.setFromUnitVectors(UP, sky.current.earthDir);
    dish.current.quaternion.slerp(q.current, 0.2);
  });
  const R = 2.8;
  const a = 0.18; // paraboloid y = a r^2
  const focus = 1 / (4 * a);
  const bowl = useRef<LatheGeometry | null>(null);
  if (!bowl.current) {
    const pts: Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const r = (R * i) / 10;
      pts.push(new Vector2(Math.max(0.001, r), a * r * r));
    }
    bowl.current = new LatheGeometry(pts, 28);
  }
  return (
    <group dispose={null}>
      <mesh position={[0, 2, 0]} material={m.grey} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 4, 10]} />
      </mesh>
      <mesh position={[0, 0.25, 0]} material={m.grey} receiveShadow>
        <cylinderGeometry args={[1.1, 1.4, 0.5, 12]} />
      </mesh>
      <mesh position={[0, 4.0, 0]} material={m.silver}>
        <sphereGeometry args={[0.32, 10, 8]} />
      </mesh>
      <group ref={dish} position={[0, 4.3, 0]}>
        <mesh geometry={bowl.current} castShadow receiveShadow>
          <meshStandardMaterial color="#f2f2f4" side={DoubleSide} roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, a * R * R, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.silver}>
          <torusGeometry args={[R, 0.05, 6, 36]} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const t = (i * Math.PI * 2) / 3;
          return <Strut key={i} a={[Math.cos(t) * R, a * R * R, Math.sin(t) * R]} b={[0, focus, 0]} r={0.035} mat={m.grey} />;
        })}
        <mesh position={[0, focus + 0.05, 0]} rotation={[Math.PI, 0, 0]} material={m.white}>
          <coneGeometry args={[0.2, 0.4, 10]} />
        </mesh>
        <mesh position={[0, focus + 0.35, 0]} material={m.orangeGlow}>
          <sphereGeometry args={[0.12, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

export function Lander() {
  const m = M();
  return (
    <group dispose={null}>
      {/* descent stage: gold MLI foil */}
      <mesh position={[0, 3.2, 0]} material={m.mli} castShadow>
        <cylinderGeometry args={[1.9, 2.3, 2.4, 8]} />
      </mesh>
      {/* deck ring */}
      <mesh position={[0, 4.42, 0]} material={m.silver}>
        <cylinderGeometry args={[1.95, 1.95, 0.1, 8]} />
      </mesh>
      {/* white ascent cabin + window + antenna */}
      <mesh position={[0, 5.0, 0]} material={m.white} castShadow>
        <cylinderGeometry args={[0.9, 1.7, 1.1, 8]} />
      </mesh>
      <mesh position={[0, 5.9, 0]} material={m.white} castShadow>
        <cylinderGeometry args={[0.55, 0.9, 0.7, 8]} />
      </mesh>
      <mesh position={[0, 5.2, 0.97]} rotation={[-0.4, 0, 0]} material={m.glass}>
        <boxGeometry args={[0.6, 0.35, 0.08]} />
      </mesh>
      <mesh position={[0.3, 6.7, 0]} material={m.silver}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 5]} />
      </mesh>
      {/* engine bell */}
      <mesh position={[0, 1.7, 0]} material={m.dark}>
        <cylinderGeometry args={[0.35, 0.95, 1.1, 14, 1, true]} />
      </mesh>
      {/* four legs with foot pads */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={i} rotation={[0, -a, 0]}>
            <mesh position={[2.85, 1.66, 0]} rotation={[0, 0, 0.55]} material={m.grey} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 3.64, 8]} />
            </mesh>
            <Strut a={[1.7, 2.3, 0]} b={[3.3, 0.9, 0]} r={0.06} mat={m.silver} />
            <mesh position={[3.8, 0.12, 0]} material={m.silver} receiveShadow castShadow>
              <cylinderGeometry args={[0.8, 0.9, 0.24, 16]} />
            </mesh>
            <mesh position={[3.8, 0.28, 0]} material={m.mliTop}>
              <sphereGeometry args={[0.2, 8, 6]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Drives the astronaut's walk cycle from the outside: speed 0..1 (0 = standing, breathing), phase in radians (advance it by distance walked so the feet match the ground). */
export interface GaitDrive {
  speed: number;
  phase: number;
}

export function Astronaut({ anim = 'idle', drive }: { anim?: string; drive?: MutableRefObject<GaitDrive> }) {
  const m = M();
  const g = useRef<Group>(null);
  const torso = useRef<Mesh>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.getElapsedTime();
    if (drive) {
      // explorer mode: gait comes from the walker (phase follows distance), idle = slow breathing
      const { speed: sp, phase } = drive.current;
      const sw = Math.sin(phase) * 0.7 * sp;
      const br = Math.sin(t * 1.9) * (1 - sp);
      g.current.position.y = Math.abs(Math.sin(phase)) * 0.09 * sp + br * 0.012;
      g.current.rotation.x = 0.09 * sp;
      if (torso.current) torso.current.scale.set(1 + br * 0.012, 1 + br * 0.025, 1 + br * 0.012);
      if (armL.current) armL.current.rotation.x = sw;
      if (armR.current) armR.current.rotation.x = -sw;
      if (legL.current) legL.current.rotation.x = -sw * 1.1;
      if (legR.current) legR.current.rotation.x = sw * 1.1;
      return;
    }
    const moving = anim === 'walk' || anim === 'run';
    g.current.position.y = moving ? Math.abs(Math.sin(t * 4)) * 0.08 : Math.sin(t * 1.3) * 0.02;
    const sw = moving ? Math.sin(t * 4) * 0.6 : 0;
    if (armL.current) armL.current.rotation.x = sw;
    if (armR.current) armR.current.rotation.x = -sw;
    if (legL.current) legL.current.rotation.x = -sw;
    if (legR.current) legR.current.rotation.x = sw;
  });
  return (
    <group ref={g} dispose={null}>
      {/* torso + life-support backpack */}
      <mesh ref={torso} position={[0, 0.98, 0]} material={m.white} castShadow>
        <capsuleGeometry args={[0.26, 0.4, 4, 12]} />
      </mesh>
      <mesh position={[0, 0.78, 0]} material={m.orange}>
        <cylinderGeometry args={[0.27, 0.27, 0.07, 14]} />
      </mesh>
      <mesh position={[0, 1.1, 0.27]} material={m.orangeGlow}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
      </mesh>
      <mesh position={[0, 1.02, -0.32]} material={m.silver} castShadow>
        <boxGeometry args={[0.46, 0.66, 0.22]} />
      </mesh>
      {/* helmet, gold visor, orange stripe */}
      <mesh position={[0, 1.58, 0]} material={m.white} castShadow>
        <sphereGeometry args={[0.27, 16, 12]} />
      </mesh>
      <mesh position={[0, 1.58, 0.1]} material={m.visor}>
        <sphereGeometry args={[0.22, 16, 12]} />
      </mesh>
      <mesh position={[-0.08, 1.64, 0.285]} scale={[1.6, 0.8, 0.5]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshBasicMaterial color="#fffbe6" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.78, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.orange}>
        <torusGeometry args={[0.12, 0.02, 6, 16]} />
      </mesh>
      {/* bold orange side stripes: readable from the iso camera */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.255, 1.0, 0]} material={m.orange}>
          <boxGeometry args={[0.05, 0.62, 0.2]} />
        </mesh>
      ))}
      {/* arms */}
      {[
        [-1, armL],
        [1, armR],
      ].map(([s, ref]) => (
        <group key={s as number} ref={ref as React.RefObject<Group>} position={[(s as number) * 0.36, 1.25, 0]}>
          <mesh position={[0, -0.22, 0]} material={m.white} castShadow>
            <capsuleGeometry args={[0.085, 0.3, 4, 8]} />
          </mesh>
          <mesh position={[0, -0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.orange}>
            <torusGeometry args={[0.09, 0.022, 6, 12]} />
          </mesh>
          <mesh position={[0, -0.5, 0]} material={m.grey}>
            <sphereGeometry args={[0.095, 8, 6]} />
          </mesh>
        </group>
      ))}
      {/* legs + boots */}
      {[
        [-1, legL],
        [1, legR],
      ].map(([s, ref]) => (
        <group key={s as number} ref={ref as React.RefObject<Group>} position={[(s as number) * 0.13, 0.62, 0]}>
          <mesh position={[0, -0.27, 0]} material={m.white} castShadow>
            <capsuleGeometry args={[0.11, 0.3, 4, 8]} />
          </mesh>
          <mesh position={[0, -0.32, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.orange}>
            <torusGeometry args={[0.115, 0.022, 6, 12]} />
          </mesh>
          <mesh position={[0, -0.56, 0.04]} material={m.dark} castShadow>
            <boxGeometry args={[0.2, 0.12, 0.3]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Pati: low-poly dog in a round helmet bubble. anim: idle | wag | alert | run | sit | walk */
export function Pati({ anim = 'idle' }: { anim?: string }) {
  const body = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (tail.current) tail.current.rotation.y = Math.sin(t * (anim === 'wag' || anim === 'run' ? 14 : 3)) * (anim === 'wag' ? 0.8 : 0.3);
    const moving = anim === 'walk' || anim === 'run';
    const f = anim === 'run' ? 12 : 7;
    legs.current.forEach((l, i) => {
      if (l) l.rotation.z = moving ? Math.sin(t * f + (i % 2 ? Math.PI : 0)) * 0.6 : 0;
    });
    if (body.current) {
      body.current.rotation.z = anim === 'sit' ? 0.5 : 0;
      body.current.position.y = anim === 'alert' ? 0.03 + Math.abs(Math.sin(t * 6)) * 0.05 : moving ? Math.abs(Math.sin(t * f)) * 0.04 : 0;
    }
  });
  const fur = '#d9a066';
  return (
    <group ref={body}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.62, 0.3, 0.3]} />
        <meshStandardMaterial color={fur} roughness={0.9} />
      </mesh>
      <mesh position={[0.34, 0.6, 0]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color={fur} roughness={0.9} />
      </mesh>
      <mesh position={[0.5, 0.56, 0]}>
        <boxGeometry args={[0.16, 0.1, 0.12]} />
        <meshStandardMaterial color="#f3e6d3" />
      </mesh>
      <mesh position={[0.34, 0.8, 0.12]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.1, 0.18, 0.06]} />
        <meshStandardMaterial color="#8a5a2b" />
      </mesh>
      <mesh position={[0.34, 0.8, -0.12]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[0.1, 0.18, 0.06]} />
        <meshStandardMaterial color="#8a5a2b" />
      </mesh>
      <mesh position={[0.22, 0.46, 0]} rotation={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.13, 0.13, 0.32, 14]} />
        <meshStandardMaterial color={ORANGE} />
      </mesh>
      <group ref={tail} position={[-0.32, 0.5, 0]}>
        <mesh position={[-0.12, 0.1, 0]} rotation={[0, 0, 0.9]}>
          <boxGeometry args={[0.3, 0.07, 0.07]} />
          <meshStandardMaterial color={fur} />
        </mesh>
      </group>
      {[
        [0.22, 0.14],
        [0.22, -0.14],
        [-0.22, 0.14],
        [-0.22, -0.14],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.3, z]} ref={(el) => (legs.current[i] = el)}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <boxGeometry args={[0.09, 0.28, 0.09]} />
            <meshStandardMaterial color={fur} />
          </mesh>
        </group>
      ))}
      {/* helmet bubble */}
      <mesh position={[0.34, 0.62, 0]}>
        <sphereGeometry args={[0.32, 18, 14]} />
        <meshStandardMaterial color="#dff3ff" transparent opacity={0.28} roughness={0.05} depthWrite={false} />
      </mesh>
    </group>
  );
}


