// Build public/terrain/connecting-ridge/*. Run after extract.mjs. Usage: node build.mjs
import fs from 'fs';
import path from 'path';
import { loadWin, loadTif, RAW } from './lib.mjs';
import { SITE, R } from './site.mjs';
import { bodyVectors, A } from './ephem.mjs';

const OUT = path.resolve('../../public/terrain/connecting-ridge');
fs.mkdirSync(OUT, { recursive: true });
const N = SITE.N, cell = 2 * SITE.half / N, D2R = Math.PI / 180;
const days = []; for (let d = 8; d <= 22; d++) days.push('2024-05-' + String(d).padStart(2, '0'));
const NAZ = 360;           // horizon azimuth bins (1 deg)
const STEP_MIN = 10;       // lit-fraction time resolution (minutes)

const inner = loadWin('dem_inner_20m'), outer = loadWin('dem_outer_80m');
const bil = (w, x, y) => {
  const fx = (x - w.x0m) / w.resX - 0.5, fy = (y - w.y0m) / w.resY - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= w.W - 1 || j >= w.H - 1) return NaN;
  const tx = fx - i, ty = fy - j, d = w.data, W = w.W, k = j * W + i;
  return (d[k] * (1 - tx) + d[k + 1] * tx) * (1 - ty) + (d[k + W] * (1 - tx) + d[k + W + 1] * tx) * ty;
};
const elev = (x, y) => { let z = bil(inner, x, y); if (z !== z) z = bil(outer, x, y); return z; };

// ---- grid geometry
const gx = (j) => SITE.cx - SITE.half + (j + .5) * cell;
const gy = (i) => SITE.cy + SITE.half - (i + .5) * cell;
const H = new Float32Array(N * N);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  let s = 0; const SS = 4; // 4x4 box average of the 20 m DEM -> 70 m cell
  for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) s += elev(gx(j) - cell / 2 + (b + .5) * cell / SS, gy(i) + cell / 2 - (a + .5) * cell / SS);
  H[i * N + j] = s / (SS * SS);
}
let minE = Infinity, maxE = -Infinity; for (const v of H) { if (v < minE) minE = v; if (v > maxE) maxE = v; }

const latlon = (x, y) => { const rho = Math.hypot(x, y); return [-90 + 2 * Math.atan(rho / (2 * R)) / D2R, ((Math.atan2(x, y) / D2R) % 360 + 360) % 360]; };
// local frame at (x,y): unit position u, grid-east ex (+x_ps), grid-north ey (+y_ps), all in body-fixed coords
function frame(x, y) {
  const rho = Math.hypot(x, y), lam = Math.atan2(x, y), phi = -Math.PI / 2 + 2 * Math.atan(rho / (2 * R));
  const cp = Math.cos(phi), sp = Math.sin(phi), cl = Math.cos(lam), sl = Math.sin(lam);
  const u = [cp * cl, cp * sl, sp];
  const east = [-sl, cl, 0], north = [-sp * cl, -sp * sl, cp];
  const ex = [sl * north[0] + cl * east[0], sl * north[1] + cl * east[1], sl * north[2] + cl * east[2]];
  const ey = [cl * north[0] - sl * east[0], cl * north[1] - sl * east[1], cl * north[2] - sl * east[2]];
  return { u, ex, ey };
}

// ---- NASA products
const illT = await loadTif(RAW + '/AVGVISIB_85S_060M_201608.TIF');
const psrT = await loadTif(RAW + '/LPSR_85S_060M_201608.TIF');
const illum = new Uint8Array(N * N), psr = new Uint8Array(N * N), illF = new Float32Array(N * N);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
  const x = gx(j), y = gy(i);
  const fx = (x - illT.x0m) / illT.resX - .5, fy = (y - illT.y0m) / illT.resY - .5, i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
  const g = (a, b) => Math.max(0, illT.raw[b * illT.W + a]); // negative = nodata -> 0
  const v = (g(i0, j0) * (1 - tx) + g(i0 + 1, j0) * tx) * (1 - ty) + (g(i0, j0 + 1) * (1 - tx) + g(i0 + 1, j0 + 1) * tx) * ty;
  illF[i * N + j] = v * 4e-5 * 100; illum[i * N + j] = Math.max(0, Math.min(100, Math.round(illF[i * N + j])));
  const pi = Math.floor((x - psrT.x0m) / psrT.resX), pj = Math.floor((y - psrT.y0m) / psrT.resY);
  psr[i * N + j] = psrT.raw[pj * psrT.W + pi] > 10000 ? 1 : 0;   // raw +20000 -> 1.0 (PSR), -20000 -> 0.0
}

// ---- horizon profiles by ray-marching the DEM (planar polar-stereographic, with curvature drop d^2/2R)
const horizon = new Float32Array(N * N * NAZ); // tan-free: elevation angle in degrees
const sinT = new Float64Array(NAZ), cosT = new Float64Array(NAZ);
for (let a = 0; a < NAZ; a++) { sinT[a] = Math.sin(a * D2R); cosT[a] = Math.cos(a * D2R); }
const DIST = []; { let d = 35; while (d < 85000) { DIST.push(d); d = Math.max(d + 35, d * 1.04); } }
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    const x0 = gx(j), y0 = gy(i), z0 = H[i * N + j], base = (i * N + j) * NAZ;
    for (let a = 0; a < NAZ; a++) {
      const sx = sinT[a], cy = cosT[a]; // azimuth clockwise from +y toward +x
      let best = -90;
      for (let k = 0; k < DIST.length; k++) {
        const d = DIST[k], z = elev(x0 + sx * d, y0 + cy * d);
        if (z !== z) break;
        const e = Math.atan2(z - z0 - d * d / (2 * R), d) / D2R;
        if (e > best) best = e;
      }
      horizon[base + a] = best;
    }
  }
  if (i % 32 === 0) console.log('horizon row', i, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

// ---- Sun per cell at every time step -> lit fraction
const frames = new Array(N * N);
for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) frames[i * N + j] = frame(gx(j), gy(i));
const lit = new Uint8Array(days.length * N * N);
const perDay = Math.round(1440 / STEP_MIN);
const sunJson = { siteId: 'connecting-ridge', body: 'Sun', frame: 'azimuth clockwise from grid north (+y of polar stereographic map = image up) as seen looking down on the surface; elevation above the local horizontal plane of the site centre (no terrain, no refraction, geometric centre of disc)', days: {} };
const earthJson = { siteId: 'connecting-ridge', body: 'Earth', frame: sunJson.frame, days: {} };
const centre = frame(SITE.cx, SITE.cy);
const [cLat, cLon] = latlon(SITE.cx, SITE.cy);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const r3 = (v) => Math.round(v * 1000) / 1000;
for (let di = 0; di < days.length; di++) {
  const t00 = Date.parse(days[di] + 'T00:00:00Z');
  const hourly = [], hourlyE = [];
  for (let s = 0; s < perDay; s++) {
    const date = new A.AstroTime(new Date(t00 + s * STEP_MIN * 60000));
    const { toSun, toEarth } = bodyVectors(date);
    const sn = Math.hypot(...toSun), S = toSun.map((v) => v / sn);
    for (let c = 0; c < N * N; c++) {
      const f = frames[c];
      const el = Math.asin(dot(S, f.u)) / D2R;
      if (el < -5) continue;
      let az = Math.atan2(dot(S, f.ex), dot(S, f.ey)) / D2R; if (az < 0) az += 360;
      const a0 = Math.floor(az) % NAZ, a1 = (a0 + 1) % NAZ, t = az - Math.floor(az);
      const hz = horizon[c * NAZ + a0] * (1 - t) + horizon[c * NAZ + a1] * t;
      if (el > hz) lit[di * N * N + c]++;
    }
    if (s % (60 / STEP_MIN) === 0) {
      const mk = (v) => { // vector from site (on surface at centre) to body, km; site position uses mean radius + centre elevation
        const P = centre.u.map((q) => q * (R + H[(N >> 1) * N + (N >> 1)]) / 1000);
        const w = v.map((q, k) => q - P[k]); const n = Math.hypot(...w); const u = w.map((q) => q / n);
        let az = Math.atan2(dot(u, centre.ex), dot(u, centre.ey)) / D2R; if (az < 0) az += 360;
        return { t: new Date(t00 + s * STEP_MIN * 60000).toISOString().slice(0, 16) + 'Z', azDeg: r3(az), elDeg: r3(Math.asin(dot(u, centre.u)) / D2R) };
      };
      hourly.push(mk(toSun)); hourlyE.push(mk(toEarth));
    }
  }
  for (let c = 0; c < N * N; c++) lit[di * N * N + c] = Math.round(100 * lit[di * N * N + c] / perDay);
  sunJson.days[days[di]] = hourly; earthJson.days[days[di]] = hourlyE;
  console.log('day', days[di], 'done');
}

// ---- validation
const nonPsr = [], n = N * N;
const meanLit = new Float32Array(n);
for (let c = 0; c < n; c++) { let s = 0; for (let d = 0; d < days.length; d++) s += lit[d * n + c]; meanLit[c] = s / days.length; }
const corr = (xs, ys) => { const m = xs.length; let sx = 0, sy = 0; for (let k = 0; k < m; k++) { sx += xs[k]; sy += ys[k]; } sx /= m; sy /= m; let a = 0, b = 0, c2 = 0; for (let k = 0; k < m; k++) { a += (xs[k] - sx) * (ys[k] - sy); b += (xs[k] - sx) ** 2; c2 += (ys[k] - sy) ** 2; } return a / Math.sqrt(b * c2); };
const idxAll = [...Array(n).keys()], idxNon = idxAll.filter((c) => !psr[c]);
const stats = (idx) => ({ cells: idx.length, pearsonR: +corr(idx.map((c) => meanLit[c]), idx.map((c) => illF[c])).toFixed(3), meanAbsDiffPct: +(idx.reduce((s, c) => s + Math.abs(meanLit[c] - illF[c]), 0) / idx.length).toFixed(2), meanComputedPct: +(idx.reduce((s, c) => s + meanLit[c], 0) / idx.length).toFixed(2), meanNasaPct: +(idx.reduce((s, c) => s + illF[c], 0) / idx.length).toFixed(2) });
// slope (deg) from 70 m grid
const slope = new Float32Array(n);
for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) { const gxx = (H[i * N + j + 1] - H[i * N + j - 1]) / (2 * cell), gyy = (H[(i + 1) * N + j] - H[(i - 1) * N + j]) / (2 * cell); slope[i * N + j] = Math.atan(Math.hypot(gxx, gyy)) / D2R; }
const ridge = idxAll.filter((c) => !psr[c] && slope[c] <= 8 && illF[c] >= 30);
const crater = idxAll.filter((c) => psr[c]);
const grp = (idx) => days.map((_, d) => +(idx.reduce((s, c) => s + lit[d * n + c], 0) / Math.max(1, idx.length)).toFixed(2));
const psrZero = crater.filter((c) => meanLit[c] === 0).length / crater.length;
const nasaZeroNotPsr = idxNon.filter((c) => illum[c] === 0).length;
const validation = {
  note: 'Computed lit% = mean over the 15 May-2024 days (UTC, 10-min steps, point Sun). NASA map = LOLA average illumination over the 2009-2013 data / 18.6-year-style nutation average (Mazarico et al. 2011); they should NOT match exactly. In May 2024 the sub-solar latitude is +0.9..+1.2 deg (Sun sits BELOW the south-pole horizon in the mean), so this window is a seasonal low for south-pole illumination, hence computed < NASA long-term mean is expected.',
  allCells: stats(idxAll), nonPsrCells: stats(idxNon),
  psrCellsWithZeroLit15d: +psrZero.toFixed(4),
  nasaIllumZeroButNotPsr: nasaZeroNotPsr,
  groups: {
    habitatRidge: { definition: 'not PSR, slope <= 8 deg (70 m grid), NASA avg illumination >= 30%', cells: ridge.length, meanLitPctPerDay: grp(ridge) },
    psrCrater: { definition: 'psr.bin == 1 (official LOLA PSR map)', cells: crater.length, meanLitPctPerDay: grp(crater) }
  },
  maxLitPctAnyCellAnyDay: lit.reduce((a, b) => (b > a ? b : a), 0),
  ephemerisCheck: 'IAU 2015 Moon rotation model vs astronomy-engine Libration(): sub-Earth lon agrees to ~0.001 deg, lat to ~0.025 deg (checkephem.mjs)'
};

// ---- write
const fw = (n2, buf) => fs.writeFileSync(path.join(OUT, n2), Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength));
fw('height.bin', H); fw('illum.bin', illum); fw('psr.bin', psr); fw('lit-may-2024.bin', lit);
const fetched = JSON.parse(fs.readFileSync(path.join(RAW, 'dem_inner_20m.json'), 'utf8')).fetchedAt;
const fetched2 = JSON.parse(fs.readFileSync(path.join(RAW, 'dem_outer_80m.json'), 'utf8')).fetchedAt;
const nw = latlon(SITE.cx - SITE.half, SITE.cy + SITE.half), ne = latlon(SITE.cx + SITE.half, SITE.cy + SITE.half), sw = latlon(SITE.cx - SITE.half, SITE.cy - SITE.half), se = latlon(SITE.cx + SITE.half, SITE.cy - SITE.half);
const ll = (p) => [+p[0].toFixed(4), +p[1].toFixed(4)];
const fetchedIll = fs.statSync(RAW + '/AVGVISIB_85S_060M_201608.TIF').mtime.toISOString();
const meta = {
  siteId: 'connecting-ridge', nameTr: 'Bağlantı Sırtı (Shackleton - de Gerlache)', nameEn: 'Connecting Ridge (Shackleton - de Gerlache)',
  placeholder: false, size: N, cellMeters: +cell.toFixed(4), extentMeters: 2 * SITE.half,
  projection: 'south polar stereographic', projectionNote: 'LOLA/PGDA convention: true scale at the south pole, sphere R=1737400 m, x = rho*sin(lon_east), y = rho*cos(lon_east), x right / y up when looking down on the surface from above (not mirrored).',
  centerLatLon: ll([cLat, cLon]), centerPolarStereoM: [SITE.cx, SITE.cy],
  cornersLatLon: { nw: ll(nw), ne: ll(ne), sw: ll(sw), se: ll(se) },
  gridNorthNote: 'Row 0 = top of the map image = +y of the polar stereographic plane = "grid north" (direction of lunar 0 deg longitude as seen from the pole; at the site centre it points AWAY from the south pole along the meridian lon = centerLon... i.e. approx. local geographic north rotated by the convergence angle). +col = +x = grid east (clockwise 90 deg from grid north when viewed from above). +row = grid south. Azimuth in sun/earth json = degrees clockwise from grid north (0 = up in the image, 90 = right, 180 = down, 270 = left). Pole (lat -90) lies at PS (0,0) i.e. at col = (0 - cx + half)/cell, row = (cy + half - 0)/cell.',
  poleGridPosition: { col: +((0 - SITE.cx + SITE.half) / cell - 0.5).toFixed(2), row: +((SITE.cy + SITE.half) / cell - 0.5).toFixed(2), note: 'Cell-centre coordinates of the geographic south pole; outside the grid if <0 or >255.' },
  minElevM: +minE.toFixed(1), maxElevM: +maxE.toFixed(1), referenceRadiusM: R,
  files: { height: 'height.bin', illum: 'illum.bin', psr: 'psr.bin', lit: 'lit-may-2024.bin' },
  fileFormats: { height: 'Float32 LE, N*N row-major, metres relative to 1737400 m sphere', illum: 'Uint8 N*N, percent 0-100, NASA LOLA average illumination (bilinear resampled)', psr: 'Uint8 N*N, 1 = official LOLA permanently shadowed region', lit: 'Uint8 D*N*N day-major, percent of the UTC day sunlit (computed)' },
  days, sunFile: 'sun-may-2024.json', earthFile: 'earth-may-2024.json',
  sources: [
    { sourceId: 'LOLA_LDEM_80S_20MPP_ADJ', sourceUrl: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF', fetchedAt: fetched, isLive: false, usedFor: 'height.bin (13 km window around the site, 20 m/px, box-averaged to 70 m) and near-field horizon', citation: 'Barker et al. 2021, Planetary & Space Science 203, 105119, doi:10.1016/j.pss.2020.105119; NASA GSFC PGDA product 90' },
    { sourceId: 'LOLA_LDEM_80S_80MPP_ADJ', sourceUrl: 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF', fetchedAt: fetched2, isLive: false, usedFor: 'surrounding DEM (+-80 km, 80 m/px) so far ridges shadow the site (ray length 85 km)', citation: 'Barker et al. 2021, doi:10.1016/j.pss.2020.105119' },
    { sourceId: 'LOLA_AVGVISIB_85S_060M_201608', sourceUrl: 'https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_85S_060M_201608.TIF', fetchedAt: fetchedIll, isLive: false, usedFor: 'illum.bin (average solar illumination, 60 m/px; raw int16 x 4e-5 = fraction)', citation: 'Mazarico et al. 2011, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030; NASA GSFC PGDA product 69' },
    { sourceId: 'LOLA_LPSR_85S_060M_201608', sourceUrl: 'https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_85S_060M_201608.TIF', fetchedAt: fetchedIll, isLive: false, usedFor: 'psr.bin (official permanent-shadow map, 60 m/px, nearest-neighbour resampled)', citation: 'Mazarico et al. 2011, doi:10.1016/j.icarus.2010.10.030; NASA GSFC PGDA product 69' },
    { sourceId: 'astronomy-engine-2.1.19', sourceUrl: 'https://www.npmjs.com/package/astronomy-engine/v/2.1.19', fetchedAt: new Date().toISOString(), isLive: false, usedFor: 'Sun/Earth/Moon positions; Moon orientation from IAU 2015 rotation model (Archinal et al. 2018, doi:10.1007/s10569-017-9805-5)', citation: 'Don Cross, astronomy-engine (MIT)' }
  ],
  method: { lit: `Hourly-capable ephemeris sampled every ${STEP_MIN} min over each UTC day; per cell, horizon elevation profile (1 deg azimuth bins) by ray-marching the DEM out to 85 km (curvature drop d^2/2R included); sunlit if Sun centre elevation > horizon. Sun treated as a POINT at its centre (real disc ~0.53 deg: penumbra ignored, lit% slightly under-estimates edge cells and over-simplifies shadow edges). No refraction/dust. Cell observer height 0 m above the DEM.`, limitations: ['Point Sun', 'IAU Moon rotation used instead of exact LOLA ME frame (difference up to ~0.02 deg, ~0.5 km)', 'DEM-sampled shadows only; no boulders below ~70 m', 'Earth az/el computed from the site centre to the Earth centre'] },
  validation
};
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
fs.writeFileSync(path.join(OUT, 'sun-may-2024.json'), JSON.stringify(sunJson));
fs.writeFileSync(path.join(OUT, 'earth-may-2024.json'), JSON.stringify(earthJson));
console.log(JSON.stringify(validation, null, 1));

