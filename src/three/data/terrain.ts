// THE terrain loader. Fetches public/terrain/connecting-ridge/*, validates, and falls back to an
// in-memory placeholder (with a visible dev warning) when anything is missing or malformed.
import type { DaySeries, TerrainData, TerrainMeta } from '../types';
import { makePlaceholder } from './placeholder';

export const SITE_DIR = 'terrain/connecting-ridge/';

export function assetUrl(path: string): string {
  const base = typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/';
  return base.replace(/\/$/, '/') + path.replace(/^\//, '');
}

/** Vite answers 200 + index.html for missing files, so reject HTML. */
async function getOk(url: string): Promise<Response | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    if ((r.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) return null;
    return r;
  } catch {
    return null;
  }
}

function validMeta(m: unknown): m is TerrainMeta {
  const o = m as Partial<TerrainMeta> | null;
  return (
    !!o &&
    typeof o.size === 'number' &&
    o.size >= 16 &&
    typeof o.cellMeters === 'number' &&
    o.cellMeters > 0 &&
    !!o.files &&
    Array.isArray(o.days) &&
    o.days.length > 0
  );
}
/** Accepts [{date,hours}] or the pipeline's { days: { 'YYYY-MM-DD': [{t,azDeg,elDeg}] } }; returns the array form in meta.days order. */
function normSeries(j: unknown, dayList: string[]): DaySeries[] | null {
  const o = j as { days?: Record<string, DaySeries['hours']> } | null;
  if (o && !Array.isArray(o) && o.days && typeof o.days === 'object') {
    const out = dayList.map((date) => ({ date, hours: o.days![date] }));
    return out.every((d) => Array.isArray(d.hours) && d.hours.length > 0) ? out : null;
  }
  return j as DaySeries[];
}
function validSeries(s: unknown, days: number): s is DaySeries[] {
  return (
    Array.isArray(s) &&
    s.length >= days &&
    s.every((d) => Array.isArray((d as DaySeries).hours) && (d as DaySeries).hours.length > 0)
  );
}

function fallback(warnings: string[]): TerrainData {
  const msg = `[moon3d] Using PLACEHOLDER terrain (not NASA data): ${warnings.join('; ')}`;
  console.warn(msg);
  return makePlaceholder(warnings);
}

let inflight: Promise<TerrainData> | null = null;
/** Start (or join) the one terrain load. App.tsx calls it at page start so the bins download while the 3D chunks do. Never rejects. */
export function loadTerrain(): Promise<TerrainData> {
  return (inflight ??= loadTerrainNow());
}

async function loadTerrainNow(): Promise<TerrainData> {
  const warnings: string[] = [];
  const dir = (f: string) => assetUrl(SITE_DIR + f);
  const metaRes = await getOk(dir('meta.json'));
  if (!metaRes) return fallback(['meta.json not found']);
  let meta: unknown;
  try {
    meta = await metaRes.json();
  } catch {
    return fallback(['meta.json is not valid JSON']);
  }
  if (!validMeta(meta)) return fallback(['meta.json has an unexpected shape']);
  const n = meta.size;
  const days = meta.days.length;
  const synth = makePlaceholder();
  const fetchSeries = async (file: string, label: string): Promise<DaySeries[]> => {
    const r = await getOk(dir(file));
    if (r) {
      try {
        const j = normSeries(await r.json(), meta.days);
        if (validSeries(j, days)) return j;
      } catch {
        /* fall through */
      }
    }
    const w = `${file} missing/invalid: using synthetic ${label}`;
    warnings.push(w);
    console.warn(`[moon3d] ${w}`);
    return synth[label === 'sun' ? 'sun' : 'earth'].slice(0, days);
  };
  // All six files go out at once (the browser multiplexes them); the sun/earth series used to wait for the bins.
  const [[h, i, p, l], [sun, earth]] = await Promise.all([
    Promise.all(
      [meta.files.height, meta.files.illum, meta.files.psr, meta.files.lit].map(async (f) => {
        const r = await getOk(dir(f));
        return r ? r.arrayBuffer() : null;
      }),
    ),
    Promise.all([fetchSeries('sun-may-2024.json', 'sun'), fetchSeries('earth-may-2024.json', 'earth')]),
  ]);
  if (!h || h.byteLength !== n * n * 4) return fallback([`height.bin missing or wrong size (want ${n * n * 4} bytes)`]);
  if (!i || i.byteLength !== n * n) return fallback([`illum.bin missing or wrong size (want ${n * n} bytes)`]);
  if (!p || p.byteLength !== n * n) return fallback([`psr.bin missing or wrong size (want ${n * n} bytes)`]);
  if (!l || l.byteLength !== days * n * n) return fallback([`lit file missing or wrong size (want ${days * n * n} bytes)`]);
  // height.bin is little-endian float32; copy so alignment never matters.
  const height = new Float32Array(n * n);
  const dv = new DataView(h);
  for (let k = 0; k < n * n; k++) height[k] = dv.getFloat32(k * 4, true);

  return {
    meta,
    n,
    height,
    illum: new Uint8Array(i),
    psr: new Uint8Array(p),
    lit: new Uint8Array(l),
    dayCount: days,
    sun,
    earth,
    placeholder: !!meta.placeholder,
    warnings,
  };
}
