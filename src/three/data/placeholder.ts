// Synthetic, in-memory stand-in for public/terrain/connecting-ridge/* (same shapes). NOT real NASA data.
import { skyVec } from '../math';
import type { DaySeries, TerrainData } from '../types';

const N = 256;
const CELL = 20;
const DAYS = 15;

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function crater(u: number, v: number, cu: number, cv: number, r: number, depth: number): number {
  const t = Math.hypot(u - cu, v - cv) / r;
  if (t < 1) return -(1 - t * t) * depth;
  return depth * 0.22 * Math.exp(-(((t - 1) / 0.3) ** 2));
}

function series(fn: (day: number, hour: number) => [number, number]): DaySeries[] {
  const out: DaySeries[] = [];
  for (let d = 0; d < DAYS; d++) {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      const [azDeg, elDeg] = fn(d, h);
      hours.push({ t: h, azDeg, elDeg });
    }
    out.push({ date: `2024-05-${String(8 + d).padStart(2, '0')}`, hours });
  }
  return out;
}

export function makePlaceholder(warnings: string[] = []): TerrainData {
  const height = new Float32Array(N * N);
  let mn = Infinity;
  let mx = -Infinity;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const u = c / (N - 1);
      const v = r / (N - 1);
      // Ridge running from lower-left to upper-right between two craters.
      const dist = Math.abs((v - 0.9) + (u - 0.2) * 0.8 * 1.0) / Math.hypot(1, 0.8);
      let h = 700 * Math.exp(-((dist / 0.16) ** 2));
      h += crater(u, v, 0.12, 0.16, 0.26, 1000);
      h += crater(u, v, 0.92, 0.88, 0.22, 800);
      h += 70 * vnoise(c / 24, r / 24) + 30 * vnoise(c / 9, r / 9) + 10 * vnoise(c / 3, r / 3);
      height[r * N + c] = h;
      if (h < mn) mn = h;
      if (h > mx) mx = h;
    }
  }
  const sun = series((d, h) => {
    const az = (20 + (d * 24 + h) * 0.508) % 360;
    return [az, 0.6 + 2.2 * Math.sin((az + 30) * (Math.PI / 180))];
  });
  const earth = series((d, h) => [75 + d * 0.2 + h * 0.01, 5 + 2 * Math.sin(d * 0.4)]);

  // Horizon ray-march per day (noon sun) -> lit%, average -> illum, never-lit -> PSR.
  const lit = new Uint8Array(DAYS * N * N);
  const sumLit = new Float32Array(N * N);
  for (let d = 0; d < DAYS; d++) {
    const s = sun[d].hours[12];
    const el = Math.max(0.3, s.elDeg);
    const [dx, , dz] = skyVec(s.azDeg, 0);
    const tanEl = Math.tan((el * Math.PI) / 180);
    const stepM = CELL * 3;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const h0 = height[r * N + c];
        let shadowed = false;
        for (let k = 1; k <= 30; k++) {
          const cc = Math.round(c + (dx * stepM * k) / CELL);
          const rr = Math.round(r + (dz * stepM * k) / CELL);
          if (cc < 0 || rr < 0 || cc >= N || rr >= N) break;
          if (height[rr * N + cc] > h0 + stepM * k * tanEl) {
            shadowed = true;
            break;
          }
        }
        const v = shadowed ? 0 : 100;
        lit[d * N * N + r * N + c] = v;
        sumLit[r * N + c] += v;
      }
    }
  }
  const illum = new Uint8Array(N * N);
  const psr = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) {
    illum[i] = Math.round(sumLit[i] / DAYS);
    psr[i] = illum[i] === 0 ? 1 : 0;
  }
  return {
    meta: {
      siteId: 'placeholder',
      nameTr: 'Bağlantı Sırtı (örnek arazi)',
      nameEn: 'Connecting Ridge (placeholder terrain)',
      size: N,
      cellMeters: CELL,
      minElevM: mn,
      maxElevM: mx,
      referenceRadiusM: 1737400,
      gridNorthNote: 'Map up = north (placeholder)',
      files: { height: 'height.bin', illum: 'illum.bin', psr: 'psr.bin', lit: 'lit-may-2024.bin' },
      days: sun.map((s) => s.date),
      sources: [],
      placeholder: true,
      poleGridPosition: { col: 191.5, row: -0.5 },
    },
    n: N,
    height,
    illum,
    psr,
    lit,
    dayCount: DAYS,
    sun,
    earth,
    placeholder: true,
    warnings,
  };
}
