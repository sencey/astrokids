import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import type { GaitDrive } from './primitives';
import type { Group } from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '../data/terrain';
import { useSky } from '../SkyContext';
import type { ModelId } from '../types';
import { MODELS } from './registry';

const probes = new Map<string, Promise<boolean>>();
/** Vite answers 200 + index.html for missing files, so the content type must not be HTML. */
export function glbExists(url: string): Promise<boolean> {
  let p = probes.get(url);
  if (!p) {
    p = fetch(url, { method: 'HEAD' })
      .then((r) => {
        const ct = (r.headers.get('content-type') ?? '').toLowerCase();
        return r.ok && !ct.includes('text/html') && !ct.includes('text/plain');
      })
      .catch(() => false);
    probes.set(url, p);
  }
  return p;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GlbModel({ url, id, anim, scale, yOffset }: { url: string; id: ModelId; anim: string; scale: number; yOffset: number }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => {
    const s = clone(gltf.scene);
    s.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return s;
  }, [gltf]);
  const group = useRef<Group>(null);
  const { actions } = useAnimations(gltf.animations, group);
  useEffect(() => {
    const a = actions[anim] ?? actions['idle'];
    a?.reset().fadeIn(0.2).play();
    return () => {
      a?.fadeOut(0.2);
    };
  }, [actions, anim]);
  const sky = useSky();
  useFrame(() => {
    if (id !== 'solarTower') return;
    const panel = scene.getObjectByName('panel');
    if (panel) panel.rotation.y = Math.atan2(sky.current.sunDir.x, sky.current.sunDir.z);
  });
  return (
    <group ref={group} scale={scale} position-y={yOffset}>
      <primitive object={scene} />
    </group>
  );
}

/** Real GLB when public/models/<id>.glb exists, otherwise the primitive fallback. */
export function Model({ id, anim = 'idle', drive, fill }: { id: ModelId; anim?: string; drive?: MutableRefObject<GaitDrive>; fill?: number }) {
  const def = MODELS[id];
  const url = assetUrl(def.glbPath);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let off = false;
    void glbExists(url).then((v) => !off && setOk(v));
    return () => {
      off = true;
    };
  }, [url]);
  const fb = def.fallback(anim, drive, fill);
  if (!ok) return fb;
  return (
    <Boundary fallback={fb}>
      <Suspense fallback={fb}>
        <GlbModel url={url} id={id} anim={anim} scale={def.scale} yOffset={def.yOffset} />
      </Suspense>
    </Boundary>
  );
}

