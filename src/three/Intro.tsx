import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { CanvasTexture, Mesh, SRGBColorSpace, Texture, Vector3 } from 'three';
import { CONFIG, useTier } from './config';
import { findTextures, loadTexture } from './data/textures';

const DIVE_START = 3.2;
const DIVE_END = 9;
const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function proceduralMoon(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#8d8d90';
  x.fillRect(0, 0, 1024, 512);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(60,60,66,${0.1 + rnd() * 0.2})`;
    x.beginPath();
    x.ellipse(rnd() * 1024, 80 + rnd() * 350, 20 + rnd() * 90, 15 + rnd() * 60, 0, 0, 7);
    x.fill();
  }
  for (let i = 0; i < 700; i++) {
    const r = 2 + rnd() * rnd() * 26;
    const px = rnd() * 1024;
    const py = rnd() * 512;
    x.strokeStyle = 'rgba(215,215,220,0.5)';
    x.fillStyle = 'rgba(50,50,56,0.35)';
    x.lineWidth = 1.2;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
    x.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function Globe({ started, skip, wrap, onDone }: { started: boolean; skip: boolean; wrap: RefObject<HTMLDivElement>; onDone: () => void }) {
  const t = useRef(0);
  const done = useRef(false);
  const moon = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const fallback = useMemo(proceduralMoon, []);
  const [color, setColor] = useState<Texture | null>(null);
  const [disp, setDisp] = useState<Texture | null>(null);
  const look = useRef(new Vector3());

  useEffect(() => {
    let off = false;
    void findTextures('moon').then(async (f) => {
      if (f.color) {
        const c = await loadTexture(f.color).catch(() => null);
        if (!off && c) setColor(c);
      }
      if (f.displacement) {
        const d = await loadTexture(f.displacement, false).catch(() => null);
        if (!off && d) setDisp(d);
      }
    });
    return () => {
      off = true;
    };
  }, []);

  useFrame(({ camera }, dt) => {
    if (started) t.current += Math.min(dt, 0.1);
    const fadeStart = DIVE_END;
    if (skip && t.current < fadeStart) t.current = fadeStart;
    const total = CONFIG.introSeconds;
    const f = ease(clamp01((t.current - DIVE_START) / (DIVE_END - DIVE_START)));
    const th = f * 1.4; // radians along the meridian toward the south pole
    const r = 4.2 - f * 3.1;
    camera.position.set(0, -Math.sin(th) * r, Math.cos(th) * r);
    camera.up.set(0, Math.cos(th), Math.sin(th));
    look.current.set(0, -f * 0.95, 0);
    camera.lookAt(look.current);
    if (moon.current) moon.current.rotation.y = t.current * 0.12;
    if (ring.current) {
      const a = clamp01((t.current - 5.5) / 1.5);
      ring.current.visible = a > 0;
      ring.current.scale.setScalar(0.04 + 0.01 * Math.sin(t.current * 5)) ;
    }
    if (wrap.current) wrap.current.style.opacity = String(1 - clamp01((t.current - DIVE_END) / (total - DIVE_END)));
    if (t.current >= total && !done.current) {
      done.current = true;
      onDone();
    }
  });

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[4, -1.5, 3]} intensity={3.2} color="#fff4e0" />
      <mesh ref={moon}>
        <sphereGeometry args={[1, 128, 64]} />
        <meshStandardMaterial map={color ?? fallback} roughness={1} displacementMap={disp ?? undefined} displacementScale={disp ? 0.03 : 0} displacementBias={disp ? -0.015 : 0} />
      </mesh>
      <mesh ref={ring} position={[0, -1.01, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial color="#5fd0ff" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </mesh>
      <Stars />
    </>
  );
}

function Stars() {
  const pos = useMemo(() => {
    const n = 1500;
    const a = new Float32Array(n * 3);
    let s = 99;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const p = rnd() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      a[i * 3] = Math.cos(p) * q * 40;
      a[i * 3 + 1] = u * 40;
      a[i * 3 + 2] = Math.sin(p) * q * 40;
    }
    return a;
  }, []);
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={pos} count={pos.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#fff" size={1.5} sizeAttenuation={false} />
    </points>
  );
}

/** 3D Moon globe that dives to the south pole, then fades out (revealing the terrain scene beneath). */
export default function IntroGlobe({ started, skip, wrapRef, onDone }: { started: boolean; skip: boolean; wrapRef: MutableRefObject<HTMLDivElement | null>; onDone: () => void }) {
  const dprCap = useTier().dpr;
  return (
    // 'demand' while waiting at the start gate (the globe is static until the intro runs): no per-frame rendering of a hidden-ish second canvas
    <Canvas frameloop={started ? 'always' : 'demand'} dpr={[1, dprCap]} camera={{ fov: 40, near: 0.05, far: 200, position: [0, 0, 4.2] }} style={{ position: 'absolute', inset: 0 }}>
      <Globe started={started} skip={skip} wrap={wrapRef as RefObject<HTMLDivElement>} onDone={onDone} />
    </Canvas>
  );
}
