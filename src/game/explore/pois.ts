// Points of interest derived from the REAL height / illumination / permanent-shadow grids. Pure TS, no rendering.
import type { DaySeries, TerrainData } from '../../three/types';
import { EXPLORE } from './config';

export type PoiKind = 'ice' | 'sun' | 'rim' | 'earth' | 'geology' | 'base';

export interface PoiSource {
  name: string;
  url: string;
  citation: string;
  /** second dataset used for the same fact (e.g. the Earth ephemeris behind the Earth lookout) */
  extra?: { name: string; url: string; citation: string };
}

export interface Poi {
  id: string;
  kind: PoiKind;
  /** [col, row] on the height grid (row 0 = grid north) */
  grid: [number, number];
  /** world metres (x east, z south), same frame as the 3D scene */
  x: number;
  z: number;
  nameTr: string;
  nameEn: string;
  factTr: string;
  factEn: string;
  source: PoiSource;
  /** science points for discovering it (1-3); the landing site is never discovered, so its value is unused */
  science: 1 | 2 | 3;
  /** shortest walk from the landing site over ground the commander can climb, in metres */
  walkM: number;
}

type Grid = Pick<TerrainData, 'n' | 'height' | 'illum' | 'psr' | 'earth'> & {
  meta: Pick<TerrainData['meta'], 'cellMeters' | 'sources' | 'poleGridPosition'>;
};

const D2R = Math.PI / 180;
const MOON_R = 1737400;

export const isDiscoverable = (p: Pick<Poi, 'kind'>) => p.kind !== 'base';

// ---- sources (taken from meta.sources when present, so URLs always match the shipped data)
const FALLBACK_SRC: Record<string, { name: string; url: string; citation: string }> = {
  ldem: {
    name: 'LOLA LDEM_80S_20MPP_ADJ',
    url: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF',
    citation: 'Barker et al. 2021, doi:10.1016/j.pss.2020.105119; NASA GSFC PGDA product 90',
  },
  illum: {
    name: 'LOLA AVGVISIB_85S_060M_201608',
    url: 'https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF',
    citation: 'Mazarico et al. 2011, doi:10.1016/j.icarus.2010.10.030; NASA GSFC PGDA product 69',
  },
  psr: {
    name: 'LOLA LPSR_85S_060M_201608',
    url: 'https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF',
    citation: 'Mazarico et al. 2011, doi:10.1016/j.icarus.2010.10.030; NASA GSFC PGDA product 69',
  },
  eph: {
    name: 'astronomy-engine 2.1.19 (Earth position)',
    url: 'https://www.npmjs.com/package/astronomy-engine/v/2.1.19',
    citation: 'Don Cross, astronomy-engine (MIT)',
  },
};
function src(d: Grid, key: keyof typeof FALLBACK_SRC): { name: string; url: string; citation: string } {
  const id = { ldem: 'LOLA_LDEM_80S_20MPP_ADJ', illum: 'LOLA_AVGVISIB_85S_060M_201608', psr: 'LOLA_LPSR_85S_060M_201608', eph: 'astronomy-engine-2.1.19' }[key];
  const m = d.meta.sources?.find((s) => s.sourceId === id);
  const fb = FALLBACK_SRC[key];
  return { name: fb.name, url: m?.sourceUrl ?? fb.url, citation: m?.citation ?? fb.citation };
}

// ---- grid helpers
export function cellToWorld(d: Pick<Grid, 'n'> & { meta: { cellMeters: number } }, col: number, row: number): [number, number] {
  return [(col - (d.n - 1) / 2) * d.meta.cellMeters, (row - (d.n - 1) / 2) * d.meta.cellMeters];
}
export function worldToCell(d: Pick<Grid, 'n'> & { meta: { cellMeters: number } }, x: number, z: number): [number, number] {
  const c = Math.round(x / d.meta.cellMeters + (d.n - 1) / 2);
  const r = Math.round(z / d.meta.cellMeters + (d.n - 1) / 2);
  return [Math.max(0, Math.min(d.n - 1, c)), Math.max(0, Math.min(d.n - 1, r))];
}

/** Terrain slope (degrees) at a cell from central differences. */
export function slopeDegAt(d: Grid, col: number, row: number): number {
  const n = d.n;
  const at = (r: number, c: number) => d.height[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))];
  const cell = d.meta.cellMeters;
  const gx = (at(row, col + 1) - at(row, col - 1)) / (2 * cell);
  const gz = (at(row + 1, col) - at(row - 1, col)) / (2 * cell);
  return Math.atan(Math.hypot(gx, gz)) / D2R;
}

/** Walking distance (m) from `home` to every cell, moving between neighbouring cells (8 directions) only over ground not steeper than the limit. Infinity = cannot be reached. */
export function walkDistances(d: Grid, home: [number, number], maxSlopeDeg: number = EXPLORE.slopeLimitDeg): Float64Array {
  const n = d.n;
  const cell = d.meta.cellMeters;
  const tan = Math.tan(maxSlopeDeg * D2R);
  // Float64 on purpose: float32 rounding lets equal costs pass the "better than" test again and again.
  const dist = new Float64Array(n * n).fill(Infinity);
  // binary min-heap of [cost, index]
  const hc: number[] = [];
  const hi: number[] = [];
  const push = (c: number, i: number) => {
    let k = hc.length;
    hc.push(c);
    hi.push(i);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hc[p] <= hc[k]) break;
      [hc[p], hc[k]] = [hc[k], hc[p]];
      [hi[p], hi[k]] = [hi[k], hi[p]];
      k = p;
    }
  };
  const pop = (): [number, number] => {
    const c = hc[0];
    const i = hi[0];
    const lc = hc.pop()!;
    const li = hi.pop()!;
    if (hc.length) {
      hc[0] = lc;
      hi[0] = li;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < hc.length && hc[l] < hc[m]) m = l;
        if (r < hc.length && hc[r] < hc[m]) m = r;
        if (m === k) break;
        [hc[m], hc[k]] = [hc[k], hc[m]];
        [hi[m], hi[k]] = [hi[k], hi[m]];
        k = m;
      }
    }
    return [c, i];
  };
  const start = home[1] * n + home[0];
  dist[start] = 0;
  push(0, start);
  const nb = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  while (hc.length) {
    const [c, i] = pop();
    if (c > dist[i]) continue;
    const col = i % n;
    const row = (i - col) / n;
    for (const [dc, dr, w] of nb) {
      const cc = col + dc;
      const rr = row + dr;
      if (cc < 0 || rr < 0 || cc >= n || rr >= n) continue;
      const j = rr * n + cc;
      const len = w * cell;
      if (Math.abs(d.height[j] - d.height[i]) / len > tan) continue;
      const nc = c + len;
      if (nc < dist[j]) {
        dist[j] = nc;
        push(nc, j);
      }
    }
  }
  return dist;
}

// ---- number / text helpers (kid facts: short, true, with the real numbers from the grids)
const round10 = (v: number) => Math.max(10, Math.round(v / 10) * 10);
const round1 = (v: number) => Math.round(v * 10) / 10;
export const wordCount = (s: string) => s.trim().split(/\s+/).length;
const trNum = (v: number) => String(v).replace('.', ',');

/** Horizon elevation (degrees) seen from a cell toward grid azimuth az (clockwise from grid north), ray-marched over the grid with curvature drop. */
function horizonDeg(d: Grid, col: number, row: number, azDeg: number): number {
  const n = d.n;
  const cell = d.meta.cellMeters;
  const dc = Math.sin(azDeg * D2R);
  const dr = -Math.cos(azDeg * D2R);
  const h0 = d.height[row * n + col];
  let best = -90;
  for (let k = 1; k < n; k++) {
    const c = Math.round(col + dc * k);
    const r = Math.round(row + dr * k);
    if (c < 0 || r < 0 || c >= n || r >= n) break;
    const dd = k * cell;
    const dh = d.height[r * n + c] - h0 - (dd * dd) / (2 * MOON_R);
    const e = Math.atan2(dh, dd) / D2R;
    if (e > best) best = e;
  }
  return best;
}

export interface EarthVisibility {
  /** share of the sampled hours (0..1) when Earth's centre is above the local horizon */
  fraction: number;
  /** mean Earth elevation above the horizon, degrees (negative = below) */
  marginDeg: number;
}

/** Earth visibility at a cell over the ephemeris samples (az bins of 4 degrees share one horizon ray). */
export function earthVisibility(d: Grid, col: number, row: number, earth: DaySeries[]): EarthVisibility {
  const cache = new Map<number, number>();
  let up = 0;
  let cnt = 0;
  let margin = 0;
  for (const day of earth) {
    for (const s of day.hours) {
      const bin = Math.round(s.azDeg / 4);
      let hz = cache.get(bin);
      if (hz === undefined) {
        hz = horizonDeg(d, col, row, bin * 4);
        cache.set(bin, hz);
      }
      cnt++;
      margin += s.elDeg - hz;
      if (s.elDeg > hz) up++;
    }
  }
  return cnt ? { fraction: up / cnt, marginDeg: margin / cnt } : { fraction: 0, marginDeg: -90 };
}

interface Pick1 {
  col: number;
  row: number;
}

/** Derives the points of interest. `home` is the landing site in world metres. Deterministic. */
export function derivePois(d: Grid, home: { x: number; z: number }): Poi[] {
  const n = d.n;
  const cell = d.meta.cellMeters;
  const h = d.height;
  const homeCell = worldToCell(d, home.x, home.z);
  const walk = walkDistances(d, homeCell);
  const margin = 6;
  const slope = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) slope[r * n + c] = slopeDegAt(d, c, r);
  const homeH = h[homeCell[1] * n + homeCell[0]];

  const ok = (i: number, maxSlope = 20) => {
    const c = i % n;
    const r = (i - c) / n;
    return c >= margin && r >= margin && c < n - margin && r < n - margin && walk[i] <= EXPLORE.maxPoiWalkM && walk[i] > 0 && slope[i] <= maxSlope;
  };
  const chosen: Pick1[] = [{ col: homeCell[0], row: homeCell[1] }];
  const spaced = (c: number, r: number, minM: number = EXPLORE.minPoiSpacingM) => chosen.every((p) => Math.hypot(p.col - c, p.row - r) * cell >= minM);
  /** best cell by score among the allowed ones; NaN/-Infinity scores are skipped */
  const best = (score: (i: number) => number, maxSlope = 20, minM?: number): number => {
    let bi = -1;
    let bs = -Infinity;
    for (let i = 0; i < n * n; i++) {
      if (!ok(i, maxSlope)) continue;
      const c = i % n;
      const r = (i - c) / n;
      if (!spaced(c, r, minM)) continue;
      const s = score(i);
      if (s > bs) {
        bs = s;
        bi = i;
      }
    }
    return bi;
  };
  const colRow = (i: number): [number, number] => [i % n, Math.floor(i / n)];
  const out: Poi[] = [];
  const add = (p: Omit<Poi, 'grid' | 'x' | 'z' | 'walkM'> & { i: number }) => {
    const [c, r] = colRow(p.i);
    const [x, z] = cellToWorld(d, c, r);
    const { i, ...rest } = p;
    out.push({ ...rest, grid: [c, r], x, z, walkM: Math.round(walk[i]) });
    chosen.push({ col: c, row: r });
  };

  // landing site
  {
    const [x, z] = cellToWorld(d, homeCell[0], homeCell[1]);
    out.push({
      id: 'base',
      kind: 'base',
      grid: [homeCell[0], homeCell[1]],
      x,
      z,
      nameTr: 'İniş yeri',
      nameEn: 'Landing site',
      factTr: 'Üssün burada. Bu harita, NASA’nın lazerle yaptığı gerçek Ay ölçümlerinden geliyor.',
      factEn: 'Your base is here. This map comes from NASA laser measurements of the real Moon.',
      source: src(d, 'ldem'),
      science: 1,
      walkM: 0,
    });
  }

  // ever-sunny peak: most illuminated standable ground (ties -> higher)
  {
    const i = best((k) => (walk[k] <= 1000 ? d.illum[k] * 1000 + (h[k] - homeH) * 0.01 - walk[k] * 0.0001 : -Infinity));
    if (i >= 0) {
      const pct = d.illum[i];
      add({
        i,
        id: 'sun',
        kind: 'sun',
        nameTr: 'Hep güneşli tepe',
        nameEn: 'Ever-sunny peak',
        factTr: `Burada Güneş ortalama yüzde ${pct} süreyle parlıyor. Güneş panelleri için harika bir yer!`,
        factEn: `The Sun shines here about ${pct} percent of the time. A great spot for solar panels!`,
        source: src(d, 'illum'),
        science: 2,
      });
    }
  }

  // Shackleton rim: highest standable ground in the rim zone (9-12.5 km from the pole point)
  {
    const pole = d.meta.poleGridPosition;
    const dp = (i: number) => (pole ? Math.hypot((i % n) - pole.col, Math.floor(i / n) - pole.row) * cell : -1);
    let i = pole ? best((k) => (dp(k) >= 9000 && dp(k) <= 12500 ? h[k] - walk[k] * 0.01 : -Infinity)) : -1;
    if (i < 0) i = best((k) => h[k] - walk[k] * 0.01, 20);
    if (i >= 0) {
      add({
        i,
        id: 'rim',
        kind: 'rim',
        nameTr: 'Shackleton kenarı',
        nameEn: 'Shackleton rim',
        factTr: 'Ayın güney kutbundaki Shackleton krateri yaklaşık 21 kilometre geniş ve 4 kilometreden derin.',
        factEn: "Shackleton crater at the Moon's south pole is about 21 kilometres wide and over 4 kilometres deep.",
        source: src(d, 'ldem'),
        science: 2,
      });
    }
  }

  // Earth lookout: the standable cell where Earth is above the horizon most often
  {
    const earth = d.earth ?? [];
    if (earth.length && earth.every((s) => s.hours.length)) {
      let bi = -1;
      let bs = -Infinity;
      let bv: EarthVisibility | null = null;
      for (let r = margin; r < n - margin; r += 2) {
        for (let c = margin; c < n - margin; c += 2) {
          const i = r * n + c;
          if (!ok(i) || !spaced(c, r)) continue;
          const v = earthVisibility(d, c, r, earth);
          const s = v.fraction * 100 + v.marginDeg - walk[i] * 0.0005;
          if (s > bs) {
            bs = s;
            bi = i;
            bv = v;
          }
        }
      }
      if (bi >= 0 && bv) {
        const pct = Math.round(bv.fraction * 100);
        const seen = pct >= 1;
        const often = pct >= 95;
        add({
          i: bi,
          id: 'earth',
          kind: 'earth',
          nameTr: 'Dünya gözetleme noktası',
          nameEn: 'Earth lookout',
          factTr: often
            ? 'Buradan Dünya neredeyse her zaman ufkun üstünde görünür. Radyo sinyali dümdüz Dünya’ya gider.'
            : seen
              ? `Buradan Dünya zamanın yaklaşık yüzde ${pct} kadarında ufkun üstünde görünür. Radyo sinyali dümdüz gider.`
              : 'Dünya buradan ufka çok yakın durur. Tepeler çoğu zaman onu saklar.',
          factEn: often
            ? 'From here Earth is above the horizon almost all the time. Radio goes straight home.'
            : seen
              ? `From here Earth is above the horizon about ${pct} percent of the time. Radio goes straight home.`
              : 'From here Earth hangs very close to the horizon. Hills hide it most of the time.',
          source: { ...src(d, 'ldem'), extra: src(d, 'eph') },
          science: 3,
        });
      }
    }
  }

  // ice: deepest permanently shadowed craters, three different ones
  const rimMean = (i: number, rad = 8) => {
    const c0 = i % n;
    const r0 = (i - c0) / n;
    let sum = 0;
    let cnt = 0;
    for (let a = 0; a < 16; a++) {
      const c = Math.round(c0 + Math.cos((a / 16) * 2 * Math.PI) * rad);
      const r = Math.round(r0 + Math.sin((a / 16) * 2 * Math.PI) * rad);
      if (c < 0 || r < 0 || c >= n || r >= n) continue;
      sum += h[r * n + c];
      cnt++;
    }
    return cnt ? sum / cnt : h[i];
  };
  // label the permanently shadowed patches (8 neighbours) once; sizes in cells
  const psrLabel = new Int32Array(n * n).fill(-1);
  const psrSize: number[] = [];
  for (let s = 0; s < n * n; s++) {
    if (!d.psr[s] || psrLabel[s] >= 0) continue;
    const id = psrSize.length;
    let cnt = 0;
    const q = [s];
    psrLabel[s] = id;
    while (q.length) {
      const k = q.pop()!;
      cnt++;
      const c = k % n;
      const r = (k - c) / n;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c + dc;
          const rr = r + dr;
          if (cc < 0 || rr < 0 || cc >= n || rr >= n) continue;
          const j = rr * n + cc;
          if (d.psr[j] && psrLabel[j] < 0) {
            psrLabel[j] = id;
            q.push(j);
          }
        }
      }
    }
    psrSize.push(cnt);
  }
  const psrAreaM2 = (i: number): number => psrSize[psrLabel[i]] * cell * cell;
  const MIN_ICE_CELLS = 30;
  const sunnyNear = (i: number): number => {
    const c0 = i % n;
    const r0 = (i - c0) / n;
    let bd = Infinity;
    for (let r = Math.max(0, r0 - 120); r <= Math.min(n - 1, r0 + 120); r++) {
      for (let c = Math.max(0, c0 - 120); c <= Math.min(n - 1, c0 + 120); c++) {
        if (d.illum[r * n + c] >= 50) {
          const dd = Math.hypot(c - c0, r - r0);
          if (dd < bd) bd = dd;
        }
      }
    }
    return Number.isFinite(bd) ? bd * cell : -1;
  };
  for (let k = 1; k <= 3; k++) {
    // the first one is a short walk from base (<= 1.5 km, small patches allowed); the others are farther goals
    const near = k === 1;
    const i = best((j) => (d.psr[j] && psrSize[psrLabel[j]] >= (near ? 1 : MIN_ICE_CELLS) && (!near || walk[j] <= 1500) ? rimMean(j) - h[j] - walk[j] * 0.04 : -Infinity), 20, near ? 300 : Math.max(EXPLORE.minPoiSpacingM, 1200));
    if (i < 0) continue;
    const depth = round10(rimMean(i) - h[i]);
    let factEn: string;
    let factTr: string;
    if (k === 1) {
      factEn = `Sunlight never reaches this crater floor, ${depth} metres lower than the ground around it. Ice could hide here.`;
      factTr = `Bu krater tabanına hiç güneş ışığı girmez. Çevresinden ${depth} metre alçakta. Burada buz saklanabilir.`;
    } else if (k === 2) {
      const pitches = Math.round(psrAreaM2(i) / 7140);
      const km2 = round1(psrAreaM2(i) / 1e6);
      factEn = pitches < 1500 ? `This permanent shadow is as big as about ${pitches} football pitches. The Sun never shines there.` : `This permanent shadow covers about ${km2} square kilometres. The Sun never shines there.`;
      factTr = pitches < 1500 ? `Bu sürekli gölge yaklaşık ${pitches} futbol sahası büyüklüğünde. Güneş oraya hiç girmez.` : `Bu sürekli gölge yaklaşık ${trNum(km2)} kilometrekare. Güneş oraya hiç girmez.`;
    } else {
      const sm = sunnyNear(i);
      const km = sm > 0 ? round1(sm / 1000) : 0;
      factEn = km > 0 ? `Sunlight never reaches here, yet the Sun shines most of the time only ${km} kilometres away.` : `The Sun never shines here. Cold traps like this may keep frozen water.`;
      factTr = km > 0 ? `Buraya güneş hiç girmez, ama sadece ${trNum(km)} kilometre ötede Güneş çoğu zaman parlar.` : 'Buraya güneş hiç girmez. Böyle soğuk tuzaklar donmuş suyu saklayabilir.';
    }
    add({
      i,
      id: `ice-${k}`,
      kind: 'ice',
      nameTr: `Gölgeli krater ${'ABC'[k - 1]}`,
      nameEn: `Shadow crater ${'ABC'[k - 1]}`,
      factTr,
      factEn,
      source: src(d, 'psr'),
      science: k === 1 ? 3 : 2,
    });
  }

  // steepest crater wall you can still stand on (3x3 mean slope, at most 24 degrees)
  {
    const mean3 = (i: number) => {
      const c0 = i % n;
      const r0 = (i - c0) / n;
      let s = 0;
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= n || r >= n) continue;
        s += slope[r * n + c];
        cnt++;
      }
      return s / cnt;
    };
    const i = best((k) => mean3(k) - walk[k] * 0.0005, 24);
    if (i >= 0) {
      const deg = Math.round(mean3(i));
      add({
        i,
        id: 'wall',
        kind: 'geology',
        nameTr: 'Dik krater duvarı',
        nameEn: 'Steep crater wall',
        factTr: `Burada zemin yaklaşık ${deg} derece eğimli. Dik bir krater duvarı, dikkatli yürü!`,
        factEn: `The ground tilts about ${deg} degrees here, a steep crater wall. Walk carefully!`,
        source: src(d, 'ldem'),
        science: 1,
      });
    }
  }

  // lowest and highest ground you can walk to
  {
    const i = best((k) => -h[k] - walk[k] * 0.15);
    if (i >= 0) {
      const m = round10(homeH - h[i]);
      add({
        i,
        id: 'low',
        kind: 'geology',
        nameTr: 'En alçak nokta',
        nameEn: 'Lowest spot',
        factTr: `Yürüyebildiğin en alçak yer burası. İniş yerinden ${m} metre aşağıda.`,
        factEn: `This is the lowest spot you can walk to, ${m} metres below the landing site.`,
        source: src(d, 'ldem'),
        science: 1,
      });
    }
  }
  // flattest ground (mean slope over a 7x7 window): the best place to land and build
  {
    const win = (i: number) => {
      const c0 = i % n;
      const r0 = (i - c0) / n;
      let s = 0;
      for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) s += slope[(r0 + dr) * n + c0 + dc];
      return s / 49;
    };
    const i = best((k) => -win(k) - walk[k] * 0.0008, 6);
    if (i >= 0) {
      const deg = Math.max(1, Math.round(win(i)));
      add({
        i,
        id: 'flat',
        kind: 'geology',
        nameTr: 'Düz ova',
        nameEn: 'Flat plain',
        factTr: `Burada zemin neredeyse düz, sadece ${deg} derece eğimli. Düz yerler inmek ve üs kurmak için en iyisi.`,
        factEn: `The ground here is almost flat, tilting only ${deg} ${deg === 1 ? 'degree' : 'degrees'}. Flat places are best for landing and building.`,
        source: src(d, 'ldem'),
        science: 1,
      });
    }
  }
  return out;
}

/** The nearest not-yet-discovered point of interest, or null. */
export function nearestUndiscovered(pois: readonly Poi[], found: ReadonlySet<string>, x: number, z: number): Poi | null {
  let b: Poi | null = null;
  let bd = Infinity;
  for (const p of pois) {
    if (!isDiscoverable(p) || found.has(p.id)) continue;
    const dd = Math.hypot(p.x - x, p.z - z);
    if (dd < bd) {
      bd = dd;
      b = p;
    }
  }
  return b;
}

