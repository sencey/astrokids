// A small Earth sphere pinned to a screen position chosen by the UI (centre x,y and diameter in CSS px, viewport coordinates).
// The iso camera looks 35 degrees down, so the real sky is never in frame; this is only a badge. Visible while Earth is above the horizon.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { CanvasTexture, Group, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three';
import type { Texture } from 'three';
import { assetUrl } from './data/terrain';
import { findTextures, loadTexture } from './data/textures';
import { useSky } from './SkyContext';

function fallbackEarth(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1f5fbf';
  x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#3f9a52';
  for (const [cx, cy, rx, ry] of [[60, 55, 28, 22], [95, 85, 12, 22], [150, 50, 30, 18], [165, 80, 14, 16], [215, 95, 18, 10], [30, 30, 14, 8]]) {
    x.beginPath();
    x.ellipse(cx, cy, rx, ry, 0.3, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.75)';
  x.fillRect(0, 0, 256, 8);
  x.fillRect(0, 120, 256, 8);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const D = 3000; // metres in front of the camera (camera near is 300 in iso)
const MAX_PX = 56;
const _f = new Vector3();
const _r = new Vector3();
const _u = new Vector3();

export function EarthBadge({ spec }: { spec: { x: number; y: number; size: number } }) {
  const sky = useSky();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const grp = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let off = false;
    let made: Texture | null = null;
    void (async () => {
      // the shipped Blue Marble first (public/earth/blue-marble-1k.jpg, BASE_URL aware), then whatever credits.json names
      const urls = [assetUrl('earth/blue-marble-1k.jpg')];
      try {
        const f = await findTextures('earth');
        if (f.color) urls.push(f.color);
      } catch {
        /* optional */
      }
      for (const u of urls) {
        try {
          const t = await loadTexture(u);
          if (off) return t.dispose();
          made = t;
          setTex(t);
          return;
        } catch {
          /* try the next */
        }
      }
      // last resort: a painted planet so continents are still visible
      if (!off) {
        made = fallbackEarth();
        setTex(made);
      }
    })();
    return () => {
      off = true;
      made?.dispose();
    };
  }, []);

  useFrame((_, dt) => {
    const g = grp.current;
    if (!g) return;
    if (!camera.isPerspectiveCamera || sky.current.earthEl < 0.3) {
      g.visible = false;
      return;
    }
    const rect = gl.domElement.getBoundingClientRect();
    const H = Math.max(1, rect.height);
    const W = Math.max(1, rect.width);
    camera.updateMatrixWorld(); // mounted after CameraRig, so this frame's camera move is already applied
    camera.getWorldDirection(_f);
    _r.setFromMatrixColumn(camera.matrixWorld, 0);
    _u.setFromMatrixColumn(camera.matrixWorld, 1);
    const halfH = D * Math.tan((camera.fov * Math.PI) / 360);
    const halfW = halfH * (W / H);
    const nx = ((spec.x - rect.left) / W) * 2 - 1;
    const ny = 1 - ((spec.y - rect.top) / H) * 2;
    g.visible = true;
    g.position.copy(camera.position).addScaledVector(_f, D).addScaledVector(_r, nx * halfW).addScaledVector(_u, ny * halfH);
    g.scale.setScalar((Math.min(MAX_PX, spec.size) / 2) * ((2 * halfH) / H));
    if (spin.current) spin.current.rotation.y += dt * 0.15;
  });

  return (
    <group ref={grp} visible={false}>
      <group ref={spin}>
        <mesh raycast={() => null} renderOrder={31} rotation={[0.2, 0, 0.4]}>
          <sphereGeometry args={[1, 32, 20]} />
          <meshBasicMaterial key={tex ? 'tex' : 'plain'} map={tex} color={tex ? '#ffffff' : '#3b78d8'} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {/* thin blue rim so the disc reads as a planet even if the texture is pale */}
      <mesh raycast={() => null} renderOrder={30} scale={1.12}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#4d8fe8" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
