// Procedural canvas textures + lumpy geometry for the lunar-hardware fallbacks. Everything is generated lazily
// (first render), once, and cached. Every texture is <= 512 px. No network, no assets.
import { BufferGeometry, CanvasTexture, LatheGeometry, NoColorSpace, RepeatWrapping, SRGBColorSpace, TorusGeometry, Vector2 } from 'three';
import type { Texture } from 'three';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, x: c.getContext('2d')! };
}

function finish(c: HTMLCanvasElement, srgb: boolean, repeat = true, flipY = true): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.flipY = flipY;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, Texture>();
function once<T extends Texture>(key: string, make: () => T): T {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t as T;
}

/** Same image, own repeat (clones share the GPU upload). */
const reps = new Map<string, Texture>();
export function withRepeat(base: Texture, x: number, y: number): Texture {
  const key = `${base.uuid}:${x}:${y}`;
  let t = reps.get(key);
  if (!t) {
    t = base.clone();
    t.repeat.set(x, y);
    t.needsUpdate = true;
    reps.set(key, t);
  }
  return t;
}

/** Periodic value noise in [0,1], `cells` lattice cells across `size` pixels. */
function periodicNoise(size: number, cells: number, rand: () => number): Float32Array {
  const lat = new Float32Array(cells * cells);
  for (let i = 0; i < lat.length; i++) lat[i] = rand();
  const out = new Float32Array(size * size);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const iy = Math.floor(fy);
    const ty = s(fy - iy);
    const y0 = iy % cells;
    const y1 = (iy + 1) % cells;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const ix = Math.floor(fx);
      const tx = s(fx - ix);
      const x0 = ix % cells;
      const x1 = (ix + 1) % cells;
      const a = lat[y0 * cells + x0] * (1 - tx) + lat[y0 * cells + x1] * tx;
      const b = lat[y1 * cells + x0] * (1 - tx) + lat[y1 * cells + x1] * tx;
      out[y * size + x] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

/**
 * Terrain micro-detail, 512 px, tiles seamlessly. R = albedo variation (mean 0.5), G/B = surface normal x/z
 * (0.5 = flat). Sampled twice at different scales in the terrain shader. flipY is off so v follows world +z.
 */
export function terrainDetailTexture(): CanvasTexture {
  return once('terrainDetail', () => {
    const S = 512;
    const rand = rng(1969);
    const h = new Float32Array(S * S);
    let amp = 1;
    let cells = 4;
    for (let o = 0; o < 5; o++) {
      const n = periodicNoise(S, cells, rand);
      for (let i = 0; i < h.length; i++) h[i] += (n[i] - 0.5) * amp;
      amp *= 0.55;
      cells *= 2;
    }
    // craterlets (wrap-around bowls with a faint raised rim)
    for (let k = 0; k < 150; k++) {
      const cx = rand() * S;
      const cy = rand() * S;
      const r = 4 + rand() * rand() * 26;
      const depth = r * 0.035;
      const R = Math.ceil(r * 1.4);
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy) / r;
          if (d > 1.4) continue;
          const f = d < 1 ? -(1 - d * d) * depth : Math.exp(-((d - 1.05) * (d - 1.05)) * 40) * depth * 0.35;
          const x = (((Math.floor(cx) + dx) % S) + S) % S;
          const y = (((Math.floor(cy) + dy) % S) + S) % S;
          h[y * S + x] += f;
        }
      }
    }
    let mean = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < h.length; i++) {
      mean += h[i];
      lo = Math.min(lo, h[i]);
      hi = Math.max(hi, h[i]);
    }
    mean /= h.length;
    const span = Math.max(1e-6, hi - lo);
    // gradient scale: typical magnitude -> about 0.25 of the 0..1 range
    let g2 = 0;
    const at = (x: number, y: number) => h[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) g2 += (at(x + 1, y) - at(x - 1, y)) ** 2;
    const k = 0.25 / Math.max(1e-6, Math.sqrt(g2 / ((S / 4) * (S / 4))));
    const { c, x: g } = canvas(S, S);
    const img = g.createImageData(S, S);
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        const a = 0.5 + ((h[i] - mean) / span) * 1.6;
        const nx = -(at(x + 1, y) - at(x - 1, y)) * k;
        const nz = -(at(x, y + 1) - at(x, y - 1)) * k;
        img.data[i * 4] = clamp(a);
        img.data[i * 4 + 1] = clamp(0.5 + nx);
        img.data[i * 4 + 2] = clamp(0.5 + nz);
        img.data[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return finish(c, false, true, false);
  });
}

/** Solar panel: dark-blue cells with thin silver busbars and a silver grid between cells. 512 px. */
export function solarCellTexture(): CanvasTexture {
  return once('solarCells', () => {
    const S = 512;
    const COLS = 8;
    const ROWS = 10;
    const { c, x } = canvas(S, S);
    x.fillStyle = '#aeb4c2'; // silver backing / grid
    x.fillRect(0, 0, S, S);
    const rand = rng(77);
    const cw = S / COLS;
    const ch = S / ROWS;
    const gap = 3;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x0 = i * cw + gap;
        const y0 = j * ch + gap;
        const w = cw - gap * 2;
        const h = ch - gap * 2;
        const v = rand() * 0.12;
        const gr = x.createLinearGradient(x0, y0, x0 + w, y0 + h);
        gr.addColorStop(0, `rgb(${Math.round(22 + v * 60)},${Math.round(44 + v * 80)},${Math.round(112 + v * 90)})`);
        gr.addColorStop(1, `rgb(${Math.round(14 + v * 40)},${Math.round(30 + v * 60)},${Math.round(84 + v * 70)})`);
        x.fillStyle = gr;
        x.fillRect(x0, y0, w, h);
        // busbars: three thin silver lines per cell
        x.fillStyle = 'rgba(214,220,232,0.9)';
        for (let b = 1; b <= 3; b++) x.fillRect(x0 + (w * b) / 4 - 0.75, y0, 1.5, h);
        // faint cross-fingers
        x.fillStyle = 'rgba(150,170,215,0.18)';
        for (let f = 1; f < 8; f++) x.fillRect(x0, y0 + (h * f) / 8, w, 0.8);
      }
    }
    return finish(c, true);
  });
}

/** Quilted fabric: soft white puffs with darker seams; used as colour and bump. 256 px. */
export function quiltTexture(): CanvasTexture {
  return once('quilt', () => {
    const S = 256;
    const N = 8;
    const { c, x } = canvas(S, S);
    x.fillStyle = '#d4d6dc';
    x.fillRect(0, 0, S, S);
    const cell = S / N;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const cx = (i + 0.5) * cell;
        const cy = (j + 0.5) * cell;
        const gr = x.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.75);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.7, '#eceef2');
        gr.addColorStop(1, '#c4c7cf');
        x.fillStyle = gr;
        x.fillRect(i * cell + 1.5, j * cell + 1.5, cell - 3, cell - 3);
      }
    }
    return finish(c, true);
  });
}

/** Crinkled gold MLI foil (colour, bump and roughness variation). 256 px. */
export function mliTexture(): CanvasTexture {
  return once('mli', () => {
    const S = 256;
    const rand = rng(2024);
    const { c, x } = canvas(S, S);
    x.fillStyle = '#c99a32';
    x.fillRect(0, 0, S, S);
    for (let k = 0; k < 420; k++) {
      const cx = rand() * S;
      const cy = rand() * S;
      const r = 6 + rand() * 26;
      const a = rand() * Math.PI * 2;
      const lightness = rand();
      x.fillStyle = lightness > 0.5 ? `rgba(255,224,130,${0.1 + rand() * 0.22})` : `rgba(90,56,10,${0.1 + rand() * 0.25})`;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      x.lineTo(cx + Math.cos(a + 2.1) * r * (0.4 + rand() * 0.8), cy + Math.sin(a + 2.1) * r * (0.4 + rand() * 0.8));
      x.lineTo(cx + Math.cos(a + 4.2) * r * (0.4 + rand() * 0.8), cy + Math.sin(a + 4.2) * r * (0.4 + rand() * 0.8));
      x.closePath();
      x.fill();
    }
    // creases
    for (let k = 0; k < 90; k++) {
      x.strokeStyle = rand() > 0.5 ? 'rgba(255,238,170,0.35)' : 'rgba(70,40,5,0.35)';
      x.lineWidth = 0.8 + rand() * 1.2;
      x.beginPath();
      const px = rand() * S;
      const py = rand() * S;
      x.moveTo(px, py);
      x.lineTo(px + (rand() - 0.5) * 70, py + (rand() - 0.5) * 70);
      x.stroke();
    }
    return finish(c, true);
  });
}

/** Light speckled regolith (tinted by the material colour). 256 px. */
export function regolithTexture(): CanvasTexture {
  return once('regolith', () => {
    const S = 256;
    const rand = rng(11);
    const { c, x } = canvas(S, S);
    x.fillStyle = '#d8d6d2';
    x.fillRect(0, 0, S, S);
    const n = periodicNoise(S, 8, rand);
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 0.78 + n[i] * 0.3 + (rand() - 0.5) * 0.12;
      const g = Math.max(0, Math.min(255, Math.round(v * 232)));
      img.data[i * 4] = g;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = Math.round(g * 0.97);
    }
    x.putImageData(img, 0, 0);
    for (let k = 0; k < 140; k++) {
      const px = rand() * S;
      const py = rand() * S;
      const r = 1 + rand() * 3.5;
      x.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(40,38,36,0.4)';
      x.beginPath();
      x.arc(px, py, r, 0, Math.PI * 2);
      x.fill();
    }
    return finish(c, true);
  });
}

/** Dark wire-mesh wheel surface. 128 px. */
export function meshWheelTexture(): CanvasTexture {
  return once('meshWheel', () => {
    const S = 128;
    const { c, x } = canvas(S, S);
    x.fillStyle = '#17181c';
    x.fillRect(0, 0, S, S);
    x.strokeStyle = '#6b6f7a';
    x.lineWidth = 2;
    for (let k = -S; k <= S * 2; k += 16) {
      x.beginPath();
      x.moveTo(k, 0);
      x.lineTo(k + S, S);
      x.stroke();
      x.beginPath();
      x.moveTo(k, S);
      x.lineTo(k + S, 0);
      x.stroke();
    }
    return finish(c, true);
  });
}

/** Cheap smooth pseudo-noise in about [-1, 1]. */
function lump(x: number, y: number, z: number): number {
  return (
    0.55 * Math.sin(x * 1.3 + Math.sin(y * 1.9 + z * 0.7)) * Math.cos(z * 1.1 + y * 0.8) +
    0.3 * Math.sin(x * 3.1 + z * 2.7 + y * 1.3) +
    0.15 * Math.sin(y * 5.3 + x * 4.1 - z * 3.7)
  );
}

const geoCache = new Map<string, BufferGeometry>();

/** A torus whose surface is displaced into heaped-soil lumps (shared per key). */
export function lumpyTorus(R: number, r: number, seed: number): BufferGeometry {
  const key = `torus:${R}:${r}:${seed}`;
  let g = geoCache.get(key);
  if (!g) {
    const t = new TorusGeometry(R, r, 12, 48);
    const p = t.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const l = Math.hypot(x, y) || 1;
      const cx = (x / l) * R;
      const cy = (y / l) * R;
      const f = 1 + 0.28 * lump(x * 0.6 + seed, y * 0.6 - seed, z * 1.4);
      p.setXYZ(i, cx + (x - cx) * f, cy + (y - cy) * f, z * f);
    }
    t.computeVertexNormals();
    geoCache.set(key, t);
    g = t;
  }
  return g;
}

/** A low lumpy mound (lathe) for the habitat footing. */
export function lumpyMound(rIn: number, rOut: number, h: number, seed: number): BufferGeometry {
  const key = `mound:${rIn}:${rOut}:${h}:${seed}`;
  let g = geoCache.get(key);
  if (!g) {
    const pts: Vector2[] = [new Vector2(0.01, h), new Vector2(rIn, h), new Vector2((rIn + rOut) / 2, h * 0.75), new Vector2(rOut, 0.02)];
    const t = new LatheGeometry(pts, 40);
    const p = t.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      if (y > 0.03) p.setY(i, y * (1 + 0.22 * lump(x * 0.9 + seed, y, z * 0.9)));
      const l = Math.hypot(x, z);
      if (l > rIn) {
        const f = 1 + 0.06 * lump(x * 1.5, 0, z * 1.5 + seed);
        p.setX(i, x * f);
        p.setZ(i, z * f);
      }
    }
    t.computeVertexNormals();
    geoCache.set(key, t);
    g = t;
  }
  return g;
}
