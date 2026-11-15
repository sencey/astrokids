// Pati as a real 3D dog: a procedural low-poly corgi-ish pup in a white spacesuit with a glass helmet bubble.
// Model space: 1 unit = 1 m, origin at the ground between the paws, the dog faces +z, ~1.05 m tall (the astronaut is ~1.85 m).
// The parent group supplies position and the avatar scale; this component turns toward `state.yaw` and animates the gait,
// breathing, tail, ears and head from `state.pose` (no skeleton: small transform tweaks only). 24 meshes, 11 shared materials.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import type { Group, Material } from 'three';
import { useTier } from '../config';
import { angleDiff, approach, hopArc, TAU, trotSwing } from './patiGait';
import type { PatiGuideState } from './PatiSprite';

interface PatiMats {
  suit: MeshStandardMaterial;
  pack: MeshStandardMaterial;
  fur: MeshStandardMaterial;
  brown: MeshStandardMaterial;
  patch: MeshStandardMaterial;
  black: MeshStandardMaterial;
  badge: MeshStandardMaterial;
  boot: MeshStandardMaterial;
  shine: MeshBasicMaterial;
  glassHi: Material;
  glassLow: Material;
}
let cache: PatiMats | null = null;
function mats(): PatiMats {
  if (cache) return cache;
  cache = {
    suit: new MeshStandardMaterial({ color: '#dce3ee', roughness: 0.6, metalness: 0.05 }),
    pack: new MeshStandardMaterial({ color: '#a9b5c8', roughness: 0.5, metalness: 0.2 }),
    fur: new MeshStandardMaterial({ color: '#f6f2ec', roughness: 0.9 }),
    brown: new MeshStandardMaterial({ color: '#8b4a1c', roughness: 0.9 }),
    patch: new MeshStandardMaterial({ color: '#d9822f', roughness: 0.9 }),
    black: new MeshStandardMaterial({ color: '#1b1b20', roughness: 0.35 }),
    badge: new MeshStandardMaterial({ color: '#2f7bff', emissive: '#1d5fe0', emissiveIntensity: 0.55, roughness: 0.4 }),
    boot: new MeshStandardMaterial({ color: '#f1f3f8', roughness: 0.55 }),
    shine: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false }),
    glassHi: new MeshPhysicalMaterial({ color: '#d4eeff', transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1, depthWrite: false }),
    glassLow: new MeshStandardMaterial({ color: '#d4eeff', transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }),
  };
  return cache;
}

const LEG_X = 0.13;
const LEG_Z = 0.2;
const HIP_Y = 0.36;

export function Pati3D({ state, reduceMotion = false }: { state: MutableRefObject<PatiGuideState>; reduceMotion?: boolean }) {
  const m = mats();
  const tier = useTier().name;
  const lo = tier === 'low';
  const seg = lo ? 8 : 14;
  const seg2 = lo ? 6 : 10;

  const root = useRef<Group>(null);
  const bob = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const earL = useRef<Group>(null);
  const earR = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([null, null, null, null]);
  const sim = useRef({ yaw: 0, init: false, phase: 0, amp: 0, spin: 0, perk: 0, sit: 0, hopT: 0 });

  useFrame(({ clock }, dtRaw) => {
    if (!root.current || !bob.current || !body.current || !head.current) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.getElapsedTime();
    const s = state.current;
    const k = sim.current;
    const calm = reduceMotion ? 0.4 : 1;

    const moving = s.pose === 'walk' || s.pose === 'run';
    const running = s.pose === 'run';
    const jumping = s.pose === 'jump';
    const talking = s.pose === 'talk';
    const sitting = s.pose === 'sit';

    // ---- facing: movement direction while trotting, the commander (or the pointed place) otherwise
    const want = s.yaw ?? 0;
    if (!k.init) {
      k.yaw = want;
      k.init = true;
    }
    k.yaw += angleDiff(k.yaw, want) * Math.min(1, dt * (moving ? 10 : 6));
    if (jumping && !reduceMotion) k.spin += dt * 9;
    else if (k.spin !== 0) {
      k.spin = ((k.spin + Math.PI) % TAU) - Math.PI; // wrap, then ease back to facing front
      k.spin = approach(k.spin, 0, 8, dt);
      if (Math.abs(k.spin) < 0.002) k.spin = 0;
    }
    root.current.rotation.y = k.yaw + k.spin;

    // ---- gait
    const freq = running ? 14 : 9;
    k.phase = (k.phase + dt * freq * (moving ? 1 : 0.4)) % (TAU * 1000);
    k.amp = approach(k.amp, moving ? (running ? 0.85 : 0.55) : jumping ? 0.5 : 0, 10, dt);
    k.sit = approach(k.sit, sitting ? 1 : 0, 6, dt);
    k.perk = approach(k.perk, talking || jumping ? 1 : 0, 7, dt);
    const sw = trotSwing(k.phase, k.amp * calm);
    for (let i = 0; i < 4; i++) {
      const l = legs.current[i];
      if (!l) continue;
      // sitting folds the back legs forward under the body
      l.rotation.x = sw[i] - (i >= 2 ? k.sit * 1.1 : 0);
    }

    // ---- body height: floaty low-gravity hop while moving / celebrating, slow breathing at rest
    const breathe = Math.sin(t * 1.9) * (1 - Math.min(1, k.amp * 2));
    let y = hopArc(k.phase) * (running ? 0.1 : 0.06) * k.amp * 1.6 * calm;
    if (jumping) {
      k.hopT += dt;
      y += Math.pow(Math.abs(Math.sin(k.hopT * 4.2)), 0.7) * 0.5 * calm; // long, slow arcs: 1/6 g
    } else k.hopT = 0;
    bob.current.position.y = y - k.sit * 0.1 + breathe * 0.006;
    body.current.scale.set(1 + breathe * 0.01, 1 + breathe * 0.025, 1 + breathe * 0.01);
    body.current.rotation.x = Math.sin(k.phase * 2) * 0.035 * k.amp * calm - k.sit * 0.2 - (jumping ? 0.08 : 0);

    // ---- tail: lazy wag at rest, fast when happy / trotting
    if (tail.current) {
      const happy = jumping || talking || s.pose === 'wave';
      const f = happy ? 16 : moving ? 9 : 4;
      const a = happy ? 0.8 : moving ? 0.45 : 0.3;
      tail.current.rotation.y = Math.sin(t * f) * a * calm;
      tail.current.rotation.x = -0.8 - k.perk * 0.3 + k.sit * 0.5;
    }

    // ---- head: occasional curious tilt at rest, bob while talking, looks up with pride on celebrate
    {
      const q = Math.pow(Math.max(0, Math.sin(t * 0.35)), 2);
      const tilt = moving || talking ? 0 : q * 0.3 * Math.sin(t * 0.9) * calm;
      head.current.rotation.z = approach(head.current.rotation.z, tilt, 8, dt);
      const nod = talking ? Math.sin(t * 9) * 0.1 * calm : moving ? Math.sin(k.phase * 2) * 0.04 * k.amp : 0;
      head.current.rotation.x = nod - k.perk * 0.08 + k.sit * 0.2;
      head.current.position.y = 0.76 + (talking ? Math.abs(Math.sin(t * 9)) * 0.012 : 0);
    }

    // ---- ears: floppy flap while running, perk up while talking / celebrating
    const flap = Math.sin(k.phase * 2 + 0.6) * k.amp * 0.7 * calm;
    const droop = 0.55 - k.perk * 0.4;
    if (earL.current) {
      earL.current.rotation.z = -(droop + flap * 0.5);
      earL.current.rotation.x = -flap * 0.3 - k.perk * 0.15;
    }
    if (earR.current) {
      earR.current.rotation.z = droop + flap * 0.5;
      earR.current.rotation.x = -flap * 0.3 - k.perk * 0.15 + Math.sin(t * 2.3) * 0.03;
    }
  });

  const legSpecs: [number, number][] = [
    [-LEG_X, LEG_Z], // front left
    [LEG_X, LEG_Z], // front right
    [-LEG_X, -LEG_Z], // back left
    [LEG_X, -LEG_Z], // back right
  ];

  return (
    <group ref={root} dispose={null}>
      <group ref={bob}>
        {/* suit body (capsule lying along z) + backpack + chest badge */}
        <group ref={body} position={[0, 0.53, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.suit} castShadow receiveShadow>
            <capsuleGeometry args={[0.19, 0.3, 4, seg]} />
          </mesh>
          <mesh position={[0, 0.17, -0.13]} material={m.pack} castShadow>
            <boxGeometry args={[0.26, 0.2, 0.22]} />
          </mesh>
          <mesh position={[0, 0.03, 0.335]} rotation={[Math.PI / 2, 0, 0]} material={m.badge}>
            <cylinderGeometry args={[0.06, 0.06, 0.025, 12]} />
          </mesh>
        </group>

        {/* legs: hip pivot, white suit leg + big boot */}
        {legSpecs.map(([x, z], i) => (
          <group key={i} ref={(g) => void (legs.current[i] = g)} position={[x, HIP_Y, z]}>
            <mesh position={[0, -0.15, 0]} material={m.suit} castShadow>
              <cylinderGeometry args={[0.062, 0.07, 0.3, seg2]} />
            </mesh>
            <mesh position={[0, -0.325, 0.025]} scale={[1, 0.7, 1.35]} material={m.boot} castShadow>
              <sphereGeometry args={[0.08, seg2, seg2 - 2]} />
            </mesh>
          </group>
        ))}

        {/* tail */}
        <group ref={tail} position={[0, 0.62, -0.34]} rotation={[-0.8, 0, 0]}>
          <mesh position={[0, 0.1, 0]} material={m.brown} castShadow>
            <capsuleGeometry args={[0.04, 0.12, 3, seg2]} />
          </mesh>
        </group>

        {/* head inside the helmet */}
        <group ref={head} position={[0, 0.76, 0.38]}>
          <mesh material={m.fur} castShadow>
            <sphereGeometry args={[0.17, seg, seg2]} />
          </mesh>
          <mesh position={[0, -0.04, 0.15]} scale={[1, 0.8, 1.2]} material={m.fur}>
            <sphereGeometry args={[0.09, seg2, seg2 - 2]} />
          </mesh>
          <mesh position={[0, 0.0, 0.255]} material={m.black}>
            <sphereGeometry args={[0.034, seg2 - 2, seg2 - 2]} />
          </mesh>
          {/* orange-brown patch round the left eye */}
          <mesh position={[-0.07, 0.05, 0.125]} scale={[1, 1, 0.5]} material={m.patch}>
            <sphereGeometry args={[0.065, seg2, seg2 - 2]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.07, 0.05, 0.152]} material={m.black}>
              <sphereGeometry args={[0.03, seg2 - 2, seg2 - 2]} />
            </mesh>
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.07 + 0.01, 0.062, 0.177]} material={m.shine}>
              <sphereGeometry args={[0.011, 5, 4]} />
            </mesh>
          ))}
          {/* big floppy ears: pivot at the top side of the head */}
          <group ref={earL} position={[-0.12, 0.11, -0.01]} rotation={[0, 0, -0.55]}>
            <mesh position={[0, -0.09, 0]} scale={[0.4, 1.3, 0.85]} material={m.brown} castShadow>
              <sphereGeometry args={[0.085, seg2, seg2 - 2]} />
            </mesh>
          </group>
          <group ref={earR} position={[0.12, 0.11, -0.01]} rotation={[0, 0, 0.55]}>
            <mesh position={[0, -0.09, 0]} scale={[0.4, 1.3, 0.85]} material={m.brown} castShadow>
              <sphereGeometry args={[0.085, seg2, seg2 - 2]} />
            </mesh>
          </group>
        </group>

        {/* glass helmet bubble (plain transparent on the low tier) + a small glint */}
        <mesh position={[0, 0.76, 0.38]} material={lo ? m.glassLow : m.glassHi} renderOrder={4}>
          <sphereGeometry args={[0.29, seg + 4, seg2 + 4]} />
        </mesh>
        <mesh position={[-0.12, 0.93, 0.5]} rotation={[-0.7, -0.4, 0]} scale={[1.7, 0.7, 0.3]} material={m.shine} renderOrder={5}>
          <sphereGeometry args={[0.035, 6, 5]} />
        </mesh>
      </group>
    </group>
  );
}
