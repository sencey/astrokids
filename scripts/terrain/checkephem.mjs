import { bodyVectors, A } from './ephem.mjs';
// Check 1: sub-Earth point vs astronomy-engine Libration; Check 2: Sun elevation at pole.
for (const iso of ['2024-05-08T00:00:00Z','2024-05-15T12:00:00Z','2024-05-22T00:00:00Z','2020-01-01T00:00:00Z']) {
  const date = new A.AstroTime(new Date(iso));
  const { toSun, toEarth } = bodyVectors(date);
  const n = (v) => Math.hypot(...v);
  const lon = Math.atan2(toEarth[1], toEarth[0]) * 180 / Math.PI, lat = Math.asin(toEarth[2] / n(toEarth)) * 180 / Math.PI;
  const L = A.Libration(date);
  const sunLat = Math.asin(toSun[2] / n(toSun)) * 180 / Math.PI;
  console.log(iso, 'subEarth mine', lon.toFixed(3), lat.toFixed(3), 'AE libration', L.elon.toFixed(3), L.elat.toFixed(3), ' subsolar lat', sunLat.toFixed(3));
}
