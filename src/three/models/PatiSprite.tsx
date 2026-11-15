import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import { CanvasTexture, DoubleSide, Group, LinearFilter, SRGBColorSpace } from 'three';
import type { Mesh, MeshBasicMaterial } from 'three';
import { PATI_ART_SI_GENERATED, PATI_WATERMARK_TEXT } from '../../ui3d/pati/config';
import { assetUrl } from '../data/terrain';
import { Model } from './Model';

const H = 1.5; // metres tall (the astronaut is ~1.8 m)

/** Legible "SI-generated" pill, drawn into its own canvas texture (the art files stay clean). */
function useWatermarkTexture(): CanvasTexture | null {
  const [tex, setTex] = useState<CanvasTexture | null>(null);
  useEffect(() => {
    if (!PATI_ART_SI_GENERATED) return;
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 100;
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = 'rgba(0,0,0,0.72)';
    g.beginPath();
    g.roundRect(2, 2, 316, 96, 48);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '600 46px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(PATI_WATERMARK_TEXT, 160, 53);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    setTex(t);
    return () => t.dispose();
  }, []);
  return tex;
}

/** Loads view-front.webp into a canvas texture; the SI-generated watermark is drawn into the texture (assets stay clean). */
function useFrontTexture(): CanvasTexture | 'failed' | null {
  const [tex, setTex] = useState<CanvasTexture | 'failed' | null>(null);
  useEffect(() => {
    let off = false;
    let made: CanvasTexture | null = null;
    const img = new Image();
    img.onload = () => {
      if (off) return;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      if (!g) return setTex('failed');
      g.drawImage(img, 0, 0);
      made = new CanvasTexture(c);
      made.colorSpace = SRGBColorSpace;
      made.minFilter = LinearFilter;
      made.generateMipmaps = false;
      made.anisotropy = 4;
      setTex(made);
    };
    img.onerror = () => !off && setTex('failed');
    img.src = assetUrl('pati/view-front.webp');
    return () => {
      off = true;
      made?.dispose();
    };
  }, []);
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------
// Pati as the explorer's companion: one billboard that swaps between the artist's existing poses.
// Real animation: bob / roll / flip driven here. Sprite-faked: every pose is a single still picture.

export type PatiPose = 'idle' | 'walk' | 'run' | 'wave' | 'point' | 'talk' | 'sit' | 'jump';
export interface PatiGuideState {
  pose: PatiPose;
  /** which way Pati should face on screen: +1 right, -1 left (walk/run/point flip the sprite to match) */
  face: 1 | -1;
  /** world yaw (radians, atan2(dx, dz)) the 3D Pati should face: its heading while trotting, else toward the commander / the thing it points at */
  yaw?: number;
}

type ArtKey = 'front' | 'run' | 'wave' | 'point' | 'sit' | 'happy';
const ART_FILE: Record<ArtKey, string> = {
  front: 'view-front',
  run: 'pose-run',
  wave: 'pose-wave',
  point: 'pose-main',
  sit: 'pose-sit',
  happy: 'expr-happy',
};
/** Which way each picture faces as drawn (+1 = toward screen right). The art was not checked frame by frame: flip a value here if a pose looks backwards. */
const ART_FACES: Record<ArtKey, 1 | -1> = { front: 1, run: 1, wave: 1, point: 1, sit: 1, happy: 1 };
/** Height of each picture relative to the standing sprite (the expression close-up and the sitting pose are smaller drawings). */
const ART_SCALE: Record<ArtKey, number> = { front: 1, run: 1, wave: 1, point: 1.05, sit: 0.85, happy: 0.7 };
const MAX_TEX_PX = 512;

interface Art {
  tex: CanvasTexture;
  aspect: number;
}

/** All Pati pictures as canvas textures (each at most 512 px on its long side). 'failed' = use the primitive dog. */
function usePatiArt(): Record<ArtKey, Art> | 'failed' | null {
  const [art, setArt] = useState<Record<ArtKey, Art> | 'failed' | null>(null);
  useEffect(() => {
    let off = false;
    const made: CanvasTexture[] = [];
    const keys = Object.keys(ART_FILE) as ArtKey[];
    void Promise.all(
      keys.map(
        (k) =>
          new Promise<[ArtKey, Art]>((res, rej) => {
            const img = new Image();
            img.onload = () => {
              const s = Math.min(1, MAX_TEX_PX / Math.max(img.naturalWidth, img.naturalHeight));
              const c = document.createElement('canvas');
              c.width = Math.max(1, Math.round(img.naturalWidth * s));
              c.height = Math.max(1, Math.round(img.naturalHeight * s));
              const g = c.getContext('2d');
              if (!g) return rej(new Error('2d'));
              g.drawImage(img, 0, 0, c.width, c.height);
              const t = new CanvasTexture(c);
              t.colorSpace = SRGBColorSpace;
              t.minFilter = LinearFilter;
              t.generateMipmaps = false;
              made.push(t);
              res([k, { tex: t, aspect: c.width / c.height }]);
            };
            img.onerror = () => rej(new Error(k));
            img.src = assetUrl(`pati/${ART_FILE[k]}.webp`);
          }),
      ),
    ).then(
      (pairs) => !off && setArt(Object.fromEntries(pairs) as Record<ArtKey, Art>),
      () => !off && setArt('failed'),
    );
    return () => {
      off = true;
      made.forEach((t) => t.dispose());
    };
  }, []);
  return art;
}

/** The companion sprite. `scale` is applied by the parent group. Keeps the SI-generated watermark pill. */
export function PatiGuide({ state }: { state: MutableRefObject<PatiGuideState> }) {
  const art = usePatiArt();
  const wm = useWatermarkTexture();
  const grp = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const shown = useRef<ArtKey | null>(null);
  useFrame(({ clock }) => {
    if (!art || art === 'failed' || !grp.current || !mesh.current) return;
    const t = clock.getElapsedTime();
    const s = state.current;
    let key: ArtKey = 'front';
    let bob = Math.max(0, Math.sin(t * 2.2)) * 0.03;
    let roll = Math.sin(t * 1.5) * 0.02;
    switch (s.pose) {
      case 'walk':
        key = 'run';
        bob = Math.abs(Math.sin(t * 8)) * 0.11;
        roll = Math.sin(t * 8) * 0.05;
        break;
      case 'run':
        key = 'run';
        bob = Math.abs(Math.sin(t * 13)) * 0.2;
        roll = Math.sin(t * 13) * 0.09;
        break;
      case 'wave':
        key = 'wave';
        bob = Math.abs(Math.sin(t * 5)) * 0.04;
        roll = Math.sin(t * 7) * 0.06;
        break;
      case 'point':
        key = 'point';
        bob = Math.abs(Math.sin(t * 3)) * 0.03;
        roll = 0;
        break;
      case 'jump':
        key = 'wave';
        bob = Math.abs(Math.sin(t * 6.5)) * 0.6; // two or three hops
        roll = Math.sin(t * 6.5) * 0.08;
        break;
      case 'talk':
        key = Math.floor(t * 4) % 2 === 0 ? 'happy' : 'front';
        bob = Math.abs(Math.sin(t * 8)) * 0.03;
        break;
      case 'sit':
        key = 'sit';
        bob = 0;
        roll = Math.sin(t * 0.9) * 0.01;
        break;
      default:
        break;
    }
    const a = art[key];
    const m = mesh.current.material as MeshBasicMaterial;
    if (shown.current !== key) {
      m.map = a.tex;
      shown.current = key;
    }
    const h = H * ART_SCALE[key];
    const flip = s.face * ART_FACES[key];
    mesh.current.scale.set(h * a.aspect * flip, h, 1);
    mesh.current.position.y = h / 2;
    grp.current.position.y = bob;
    grp.current.rotation.z = roll;
  });
  if (!art || art === 'failed') return <Model id="pati" anim="wag" />;
  return (
    <Billboard lockX lockZ>
      <group ref={grp}>
        <mesh ref={mesh} position={[0, H / 2, 0]} renderOrder={5}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={art.front.tex} transparent alphaTest={0.08} toneMapped={false} side={DoubleSide} />
        </mesh>
        {wm && (
          <mesh position={[0, 0.3, 0.02]} renderOrder={6}>
            <planeGeometry args={[1.5, 0.47]} />
            <meshBasicMaterial map={wm} transparent toneMapped={false} depthWrite={false} />
          </mesh>
        )}
      </group>
    </Billboard>
  );
}

/** Pati next to the lander: an upright camera-facing sprite of the artist's front view; the primitive dog is the fallback. */
export function PatiSprite({ anim = 'wag' }: { anim?: string }) {
  const tex = useFrontTexture();
  const wm = useWatermarkTexture();
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const grp = g.current;
    if (!grp) return;
    const t = clock.getElapsedTime();
    const alert = anim === 'alert';
    grp.position.y = alert ? Math.abs(Math.sin(t * 6)) * 0.08 : Math.max(0, Math.sin(t * 2.2)) * 0.03;
    grp.rotation.z = Math.sin(t * (anim === 'wag' ? 3 : 1.5)) * (anim === 'wag' ? 0.05 : 0.02);
  });
  if (!tex || tex === 'failed') return <Model id="pati" anim={anim} />;
  const aspect = (tex.image as HTMLCanvasElement).width / (tex.image as HTMLCanvasElement).height;
  return (
    <Billboard lockX lockZ>
      <group ref={g}>
        <mesh position={[0, H / 2, 0]} renderOrder={5}>
          <planeGeometry args={[H * aspect, H]} />
          <meshBasicMaterial map={tex} transparent alphaTest={0.08} toneMapped={false} />
        </mesh>
        {wm && (
          <mesh position={[0, 0.3, 0.02]} renderOrder={6}>
            <planeGeometry args={[1.5, 0.47]} />
            <meshBasicMaterial map={wm} transparent toneMapped={false} depthWrite={false} />
          </mesh>
        )}
      </group>
    </Billboard>
  );
}
