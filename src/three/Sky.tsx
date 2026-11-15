import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, DirectionalLight, Group, HemisphereLight, Mesh, Object3D, Texture } from 'three';
import { CONFIG, useTier } from './config';
import { findTextures, loadTexture } from './data/textures';
import { sampleSeries, skyVec } from './math';
import type { SkyState } from './SkyContext';
import type { TerrainData, TerrainFrame } from './types';

export interface TimeState {
  day: number;
  hour: number;
}

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.08, 'rgba(255,248,220,0.95)');
  g.addColorStop(0.25, 'rgba(255,220,150,0.35)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

function Stars({ radius }: { radius: number }) {
  const { stars: n } = useTier();
  const geom = useMemo(() => {
    const p = new Float32Array(n * 3);
    let s = 12345;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      p[i * 3] = Math.cos(a) * r * radius;
      p[i * 3 + 1] = u * radius;
      p[i * 3 + 2] = Math.sin(a) * r * radius;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(p, 3));
    return g;
  }, [radius, n]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

export function Sky({ data, frame, timeRef, skyRef, fill }: { data: Pick<TerrainData, 'sun' | 'earth'>; frame: TerrainFrame; timeRef: MutableRefObject<TimeState>; skyRef: MutableRefObject<SkyState>; fill: boolean }) {
  const fillRef = useRef<HemisphereLight>(null);
  const shadowSize = useTier().shadow;
  const e = frame.extent;
  const light = useRef<DirectionalLight>(null);
  const target = useRef<Object3D>(null);
  const sunGroup = useRef<Group>(null);
  const earthGroup = useRef<Group>(null);
  const earthMesh = useRef<Mesh>(null);
  const glow = useMemo(glowTexture, []);
  const [earthTex, setEarthTex] = useState<Texture | null>(null);
  const LIGHT_DIST = e * 1.0;
  const SUN_DIST = e * 14;
  const EARTH_DIST = e * 10;
  const EARTH_R = EARTH_DIST * Math.tan((2.2 * Math.PI) / 180); // ~4.4 deg across: bigger than real (1.9) so kids can see it

  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const f = await findTextures('earth');
        if (!f.color) return;
        const tex = await loadTexture(f.color);
        if (!off) setEarthTex(tex);
      } catch {
        /* plain blue Earth */
      }
    })();
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    const l = light.current;
    if (!l || !target.current) return;
    l.target = target.current;
    const c = l.shadow.camera;
    const h = e * 0.72;
    c.left = -h;
    c.right = h;
    c.top = h;
    c.bottom = -h;
    c.near = Math.max(1, LIGHT_DIST - e * 0.8);
    c.far = LIGHT_DIST + e * 0.8; // tight depth range = fine depth precision = no acne
    c.updateProjectionMatrix();
    if (l.shadow.mapSize.x !== shadowSize) {
      l.shadow.mapSize.set(shadowSize, shadowSize);
      // tier change at runtime: drop the old map so three allocates one of the new size
      l.shadow.map?.dispose();
      l.shadow.map = null;
    }
    // Depth bias (not normal bias): at a ~1.5 degree Sun it moves the shadow only ~1 m vertically.
    l.shadow.bias = CONFIG.shadowBias;
    l.shadow.normalBias = frame.cell * 0.05;
  }, [e, LIGHT_DIST, frame.cell, shadowSize]);

  useFrame((_, dt) => {
    const t = timeRef.current;
    const s = sampleSeries(data.sun, t.day, t.hour);
    const ea = sampleSeries(data.earth, t.day, t.hour);
    if (fillRef.current) {
      const goal = fill ? CONFIG.fillIntensity : 0;
      fillRef.current.intensity += (goal - fillRef.current.intensity) * Math.min(1, dt * 8);
    }
    const sky = skyRef.current;
    sky.sunAz = s.az;
    sky.sunEl = s.el;
    sky.earthAz = ea.az;
    sky.earthEl = ea.el;
    const [sx, sy, sz] = skyVec(s.az, s.el);
    sky.sunDir.set(sx, sy, sz);
    const [ex, ey, ez] = skyVec(ea.az, ea.el);
    sky.earthDir.set(ex, ey, ez);
    const l = light.current;
    if (l) {
      l.position.set(sx * LIGHT_DIST, sy * LIGHT_DIST, sz * LIGHT_DIST);
      // The site-centre horizon is a geometric plane: ridges rise ~2 km above it, so the Sun still lights them
      // at -0.5 deg. Fade in over -1.5..-0.5 deg (shadow maps decide what is actually lit).
      l.intensity = CONFIG.sunIntensity * Math.max(0, Math.min(1, (s.el + 1.5) / 1.0));
    }
    if (sunGroup.current) {
      sunGroup.current.position.set(sx * SUN_DIST, sy * SUN_DIST, sz * SUN_DIST);
      sunGroup.current.visible = s.el > -1;
    }
    if (earthGroup.current) {
      earthGroup.current.position.set(ex * EARTH_DIST, ey * EARTH_DIST, ez * EARTH_DIST);
      earthGroup.current.visible = ea.el > -0.4; // below the local horizon: hidden, like the real thing
    }
    if (earthMesh.current) earthMesh.current.rotation.y += dt * 0.08;
  });

  return (
    <>
      <color attach="background" args={['#000000']} />
      <hemisphereLight ref={fillRef} args={[CONFIG.fillSky, CONFIG.fillGround, CONFIG.fillIntensity]} />
      <directionalLight ref={light} castShadow intensity={CONFIG.sunIntensity} color="#fff1dc" />
      <object3D ref={target} />
      <Stars radius={e * 30} />
      <group ref={sunGroup}>
        <mesh>
          <sphereGeometry args={[SUN_DIST * 0.0045, 16, 12]} />
          <meshBasicMaterial color="#fffbe8" toneMapped={false} />
        </mesh>
        <sprite scale={[SUN_DIST * 0.2, SUN_DIST * 0.2, 1]}>
          <spriteMaterial map={glow} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
        </sprite>
      </group>
      <group ref={earthGroup}>
        <mesh ref={earthMesh}>
          <sphereGeometry args={[EARTH_R, 48, 32]} />
          <meshBasicMaterial map={earthTex} color={earthTex ? '#ffffff' : '#3b78d8'} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
