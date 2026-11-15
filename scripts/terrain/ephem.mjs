// Moon-fixed frame + Sun/Earth directions. IAU 2015 (Archinal et al. 2018) Moon rotation model used as a proxy for the LOLA "ME" frame.
import * as A from 'astronomy-engine';
const D2R = Math.PI / 180;
const AU_KM = 149597870.7;

export function moonRotation(tt) { // tt = days since J2000.0 (TT ~ TDB)
  const d = tt, T = d / 36525;
  const E = (a, b) => (a + b * d) * D2R;
  const E1 = E(125.045, -0.0529921), E2 = E(250.089, -0.1059842), E3 = E(260.008, 13.0120009), E4 = E(176.625, 13.3407154),
    E5 = E(357.529, 0.9856003), E6 = E(311.589, 26.4057084), E7 = E(134.963, 13.0649930), E8 = E(276.617, 0.3287146),
    E9 = E(34.226, 1.7484877), E10 = E(15.134, -0.1589763), E11 = E(119.743, 0.0036096), E12 = E(239.961, 0.1643573), E13 = E(25.053, 12.9590088);
  const ra = 269.9949 + 0.0031 * T - 3.8787 * Math.sin(E1) - 0.1204 * Math.sin(E2) + 0.0700 * Math.sin(E3) - 0.0172 * Math.sin(E4)
    + 0.0072 * Math.sin(E6) - 0.0052 * Math.sin(E10) + 0.0043 * Math.sin(E13);
  const dec = 66.5392 + 0.0130 * T + 1.5419 * Math.cos(E1) + 0.0239 * Math.cos(E2) - 0.0278 * Math.cos(E3) + 0.0068 * Math.cos(E4)
    - 0.0029 * Math.cos(E6) + 0.0009 * Math.cos(E7) + 0.0008 * Math.cos(E10) - 0.0009 * Math.cos(E13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * Math.sin(E1) + 0.1208 * Math.sin(E2) - 0.0642 * Math.sin(E3)
    + 0.0158 * Math.sin(E4) + 0.0252 * Math.sin(E5) - 0.0066 * Math.sin(E6) - 0.0047 * Math.sin(E7) - 0.0046 * Math.sin(E8)
    + 0.0028 * Math.sin(E9) + 0.0052 * Math.sin(E10) + 0.0040 * Math.sin(E11) + 0.0019 * Math.sin(E12) - 0.0044 * Math.sin(E13);
  return { ra, dec, W };
}
const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]]; };
const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; };
const mm = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
const mv = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

// EQJ -> Moon body-fixed (x to lon 0, z north pole)
export function eqjToBody(date) {
  const { ra, dec, W } = moonRotation(date.tt);
  return mm(Rz(W * D2R), mm(Rx((90 - dec) * D2R), Rz((ra + 90) * D2R)));
}
// Moon-centred vectors (km) in body-fixed frame
export function bodyVectors(date) {
  const R = eqjToBody(date);
  const m = A.GeoMoon(date);
  const s = A.GeoVector(A.Body.Sun, date, false);
  const moon = [m.x * AU_KM, m.y * AU_KM, m.z * AU_KM];
  const sun = [s.x * AU_KM, s.y * AU_KM, s.z * AU_KM];
  const toSun = mv(R, sun.map((v, i) => v - moon[i]));
  const toEarth = mv(R, moon.map((v) => -v));
  return { toSun, toEarth, moonDistKm: Math.hypot(...moon) };
}
export { A };
