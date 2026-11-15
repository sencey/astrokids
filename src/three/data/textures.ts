// Find CGI Moon Kit / Blue Marble textures in public/moon and public/earth (file names are discovered
// from credits.json: any image file name it mentions; otherwise a few common names are probed).
import { SRGBColorSpace, TextureLoader } from 'three';
import type { Texture } from 'three';
import { assetUrl } from './terrain';

export interface FoundTextures {
  color?: string;
  displacement?: string;
}

const IMG = /\.(jpe?g|png|webp)$/i;
const cache = new Map<string, Promise<FoundTextures>>();

function walkStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') {
    if (IMG.test(v)) out.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => walkStrings(x, out));
}

async function isImage(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok && (r.headers.get('content-type') ?? '').toLowerCase().startsWith('image/');
  } catch {
    return false;
  }
}

export function findTextures(dir: 'moon' | 'earth'): Promise<FoundTextures> {
  let p = cache.get(dir);
  if (!p) {
    p = (async () => {
      const names: string[] = [];
      try {
        const r = await fetch(assetUrl(`${dir}/credits.json`));
        if ((r.headers.get('content-type') ?? '').includes('json') && r.ok) walkStrings(await r.json(), names);
      } catch {
        /* optional */
      }
      const common = dir === 'moon' ? ['color.jpg', 'lroc_color.jpg', 'moon.jpg', 'displacement.jpg', 'ldem.jpg'] : ['blue-marble.jpg', 'color.jpg', 'earth.jpg', 'blue_marble.jpg'];
      const all = [...new Set([...names, ...common])];
      const resolved: string[] = [];
      for (const n of all) {
        const rel = n.includes('/') ? n.replace(/^\//, '') : `${dir}/${n}`;
        if (await isImage(assetUrl(rel))) resolved.push(assetUrl(rel));
      }
      const isDisp = (s: string) => /(disp|height|elev|ldem|bump)/i.test(s);
      return { color: resolved.find((s) => !isDisp(s)), displacement: resolved.find(isDisp) } as FoundTextures;
    })();
    cache.set(dir, p);
  }
  return p;
}

export function loadTexture(url: string, srgb = true): Promise<Texture> {
  return new Promise((res, rej) =>
    new TextureLoader().load(
      url,
      (t) => {
        if (srgb) t.colorSpace = SRGBColorSpace;
        t.anisotropy = 4;
        res(t);
      },
      undefined,
      rej,
    ),
  );
}
