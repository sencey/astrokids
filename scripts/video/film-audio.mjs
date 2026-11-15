// Synthesizes the ORIGINAL music bed + SFX for the film (no samples, no downloads, no SI music).
//   node scripts/video/film-audio.mjs   ->  art/video/film/music.wav , art/video/film/sfx.wav   (48 kHz stereo, float32)
// Music: warm detuned-saw pad through a slow low-pass, hopeful D-major progression, a dark turn for the storm, a soft
// sine "star-bell" arpeggio. SFX: launch rumble + riser, flash hit, whooshes, data pings, build thumps, storm boom, chimes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'art', 'video', 'film');
fs.mkdirSync(outDir, { recursive: true });
const SR = 48000;
const DUR = 26.5;
const N = Math.ceil(SR * DUR);
const TAU = Math.PI * 2;

let seed = 1234567;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => x * x * (3 - 2 * x);

const mk = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const music = mk();
const sfx = mk();

/** one-pole low-pass state helper */
function lp() { let y = 0; return (x, a) => (y += a * (x - y)); }
const alpha = (fc) => 1 - Math.exp((-TAU * fc) / SR);

function addMono(bus, i, v, pan = 0) {
  if (i < 0 || i >= N) return;
  bus.L[i] += v * (1 - Math.max(0, pan));
  bus.R[i] += v * (1 + Math.min(0, pan));
}

// ------------------------------------------------------------------ pad
// chord = { t0, t1, notes: [midi...] }   (voices cross-fade with 1.2 s attack / 1.6 s release)
const CHORDS = [
  { t0: 0.0, t1: 3.2, notes: [38, 45, 50, 57], dark: 0.4 }, // D2 A2 D3 A3 (sus, launch tension)
  { t0: 3.0, t1: 7.4, notes: [50, 54, 57, 64, 61] }, // Dmaj9
  { t0: 7.2, t1: 11.6, notes: [47, 50, 54, 61, 57] }, // Bm9
  { t0: 11.4, t1: 15.8, notes: [43, 50, 59, 66, 62] }, // Gmaj9
  { t0: 15.6, t1: 17.2, notes: [50, 57, 65, 70, 60] }, // Dm(b6) turning dark
  { t0: 17.0, t1: 20.9, notes: [38, 45, 53, 58, 60], dark: 1 }, // storm: Bb/D cluster
  { t0: 20.6, t1: 24.4, notes: [50, 54, 57, 62, 64, 69] }, // D major resolves
  { t0: 24.2, t1: 26.5, notes: [50, 57, 62, 66, 69, 74] }, // D add9, held to the end
];
{
  const lpA = [lp(), lp(), lp(), lp()];
  const lpB = [lp(), lp(), lp(), lp()];
  for (const ch of CHORDS) {
    const dark = ch.dark ?? 0;
    for (const midi of ch.notes) {
      const f0 = hz(midi);
      const ph = [rnd(), rnd(), rnd()];
      const det = [-0.0045, 0.0007, 0.0052];
      const filt = lp();
      const filt2 = lp();
      const s0 = Math.max(0, Math.floor((ch.t0 - 0.1) * SR));
      const s1 = Math.min(N, Math.floor((ch.t1 + 1.8) * SR));
      const pan = (rnd() - 0.5) * 0.9;
      for (let i = s0; i < s1; i++) {
        const t = i / SR;
        const env = smooth(clamp01((t - ch.t0) / 1.2)) * (1 - smooth(clamp01((t - ch.t1) / 1.6)));
        if (env <= 0) continue;
        let v = 0;
        for (let k = 0; k < 3; k++) {
          ph[k] = (ph[k] + (f0 * (1 + det[k])) / SR) % 1;
          v += ph[k] * 2 - 1;
        }
        const cut = (500 + 450 * (0.5 + 0.5 * Math.sin(t * 0.35 + midi)) + 700 * (1 - dark)) * (midi < 45 ? 0.7 : 1);
        const a = alpha(cut);
        const y = filt2(filt(v, a), a);
        addMono(music, i, y * env * 0.11, pan);
      }
    }
  }
  void lpA; void lpB;
}
// sub drone on the root of each section (sine)
for (const [t0, t1, midi, g] of [[0, 3.2, 26, 0.35], [3, 15.8, 26, 0.16], [15.6, 20.9, 26, 0.28], [20.6, 26.5, 26, 0.16]]) {
  const f = hz(midi);
  for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t1 + 1.2) * SR)); i++) {
    const t = i / SR;
    const env = smooth(clamp01((t - t0) / 1.0)) * (1 - smooth(clamp01((t - t1) / 1.2)));
    const v = Math.sin(TAU * f * t) * env * g * (1 + 0.25 * Math.sin(t * 5.2) * (t > 15.6 && t < 21 ? 1 : 0));
    addMono(music, i, v * 0.5);
  }
}
// star-bell arpeggio over the hopeful sections
function bell(bus, t0, f, g, dec = 1.1, pan = 0) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dec * 4 * SR);
  for (let k = 0; k < len; k++) {
    const i = s0 + k;
    if (i >= N) break;
    const t = k / SR;
    const e = Math.exp(-t / dec) * (1 - Math.exp(-t * 400));
    const v = (Math.sin(TAU * f * t) + 0.42 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t / (dec * 0.5)) + 0.18 * Math.sin(TAU * f * 3.97 * t) * Math.exp(-t / (dec * 0.25))) * e * g;
    addMono(bus, i, v, pan);
  }
}
{
  const seq = [
    { t0: 3.3, t1: 7.2, notes: [74, 78, 81, 85, 81, 78] },
    { t0: 7.4, t1: 11.4, notes: [71, 74, 78, 83, 78, 74] },
    { t0: 11.6, t1: 15.6, notes: [71, 74, 79, 83, 86, 83] },
    { t0: 20.9, t1: 24.4, notes: [74, 78, 81, 86, 81, 78] },
  ];
  for (const s of seq) {
    let k = 0;
    for (let t = s.t0; t < s.t1; t += 0.4) {
      const midi = s.notes[k++ % s.notes.length];
      bell(music, t, hz(midi), 0.04, 1.3, Math.sin(k) * 0.5);
    }
  }
}

// ------------------------------------------------------------------ sfx
const sweepNoise = (t0, dur, f0, f1, g, peakAt = 0.7, pan = 0, q = 3.5) => {
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  // state-variable band-pass
  let low = 0;
  let band = 0;
  for (let k = 0; k < n; k++) {
    const u = k / n;
    const f = f0 * Math.pow(f1 / f0, u);
    const F = 2 * Math.sin((Math.PI * f) / SR);
    const x = noise();
    low += F * band;
    const high = x - low - band / q;
    band += F * high;
    const env = u < peakAt ? smooth(u / peakAt) : 1 - smooth((u - peakAt) / (1 - peakAt));
    addMono(sfx, s0 + k, band * env * g, pan);
  }
};
const boom = (t0, f, dec, g) => {
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(dec * 4 * SR);
  const f1 = lp();
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const fr = f * (1 + 1.6 * Math.exp(-t * 12));
    const v = (Math.sin(TAU * fr * t) * Math.exp(-t / dec) + f1(noise(), alpha(260)) * Math.exp(-t / (dec * 0.35)) * 0.9) * (1 - Math.exp(-t * 600)) * g;
    addMono(sfx, s0 + k, v);
  }
};
const thump = (t0, f, g) => boom(t0, f, 0.12, g);
const ping = (t0, f, g, pan = 0) => bell(sfx, t0, f, g, 0.18, pan);

// launch rumble 0..3 and riser
{
  const a = lp();
  const b = lp();
  for (let i = 0; i < Math.floor(3.05 * SR); i++) {
    const t = i / SR;
    const amp = 0.18 + 0.32 * smooth(t / 3);
    const cut = 140 + 260 * smooth(t / 3);
    const crack = (b(noise(), alpha(3500)) - b(noise(), alpha(300))) * 0.05 * (rnd() < 0.002 ? 6 : 1);
    addMono(sfx, i, a(noise(), alpha(cut)) * amp * 2.2 + crack, 0);
  }
}
sweepNoise(1.4, 1.65, 250, 7500, 0.55, 0.9);
{
  // pitched riser
  const s0 = Math.floor(1.5 * SR);
  const n = Math.floor(1.5 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const u = k / n;
    ph += (180 * Math.pow(9, u)) / SR;
    addMono(sfx, s0 + k, Math.sin(TAU * ph) * smooth(u) * 0.06 * (1 - smooth(clamp01((u - 0.96) / 0.04))));
  }
}
// white-out hit at 3.0 with a shimmer tail
boom(2.98, 46, 1.2, 0.8);
sweepNoise(3.0, 1.6, 9000, 2500, 0.25, 0.05);
for (const [d, f] of [[0, 1175], [0.04, 1760], [0.09, 2349], [0.14, 3520]]) bell(sfx, 3.02 + d, f, 0.025, 1.4, d * 4 - 0.3);

// whooshes on the cuts
for (const [t, f0, f1] of [[5.95, 600, 5200], [8.2, 800, 5000], [10.3, 700, 6200], [13.6, 500, 4800], [16.8, 400, 3000], [20.6, 700, 6500], [22.5, 900, 7000]]) {
  sweepNoise(t - 0.32, 0.55, f0, f1, 0.28, 0.58, 0, 2.5);
}
// scan pings while the terrain data resolves (6.2 - 7.8)
for (let k = 0; k < 14; k++) ping(6.2 + k * 0.115, 1800 + k * 150, 0.02, Math.sin(k) * 0.6);
// ice glitter (10.6 - 13.4)
{
  const r2 = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let k = 0; k < 26; k++) ping(10.7 + k * 0.1 + r2() * 0.08, 3000 + r2() * 3200, 0.014, r2() * 1.6 - 0.8);
}
// tower assembly: base thump, mast rise, panel snaps, glint chime
thump(14.52, 88, 0.55);
sweepNoise(14.78, 0.5, 300, 1800, 0.14, 0.7);
thump(14.78, 120, 0.25);
thump(15.32, 150, 0.3);
thump(15.46, 180, 0.3);
bell(sfx, 15.95, hz(93), 0.05, 1.0);
bell(sfx, 15.98, hz(100), 0.04, 1.0);
bell(sfx, 16.02, hz(105), 0.03, 1.0);
// storm: eruption crack + boom, then a long low swell with crackle, particles hissing past
sweepNoise(17.2, 0.45, 300, 9000, 0.3, 0.8);
boom(17.36, 38, 2.0, 1.1);
sweepNoise(17.4, 3.0, 5000, 900, 0.1, 0.1, 0.3);
{
  const a = lp();
  for (let i = Math.floor(17.4 * SR); i < Math.floor(20.7 * SR); i++) {
    const t = i / SR - 17.4;
    const amp = smooth(clamp01(t / 1.4)) * (1 - smooth(clamp01((t - 2.6) / 0.6)));
    const crackle = rnd() < 0.0012 ? noise() * 0.5 : 0;
    addMono(sfx, i, a(noise(), alpha(220)) * amp * 0.5 + crackle * amp * 0.25);
  }
}
boom(19.45, 52, 0.7, 0.35); // peak throb as the x301 lands
// dome powers up (21.15 - 22.0), SAFE chime, end card chimes
{
  const s0 = Math.floor(21.1 * SR);
  const n = Math.floor(0.95 * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const u = k / n;
    ph += (180 * Math.pow(5.5, u)) / SR;
    addMono(sfx, s0 + k, Math.sin(TAU * ph) * smooth(u) * 0.09 * (1 - smooth(clamp01((u - 0.9) / 0.1))));
  }
}
sweepNoise(21.1, 0.9, 400, 4500, 0.1, 0.8);
bell(sfx, 21.93, hz(86), 0.12, 1.4);
bell(sfx, 21.93, hz(93), 0.09, 1.6);
bell(sfx, 21.95, hz(98), 0.06, 1.8);
thump(21.92, 70, 0.5);
[74, 78, 81, 86].forEach((m, k) => bell(sfx, 22.55 + k * 0.13, hz(m + 12), 0.07, 1.6, k * 0.3 - 0.4));
bell(sfx, 24.35, hz(86), 0.04, 1.0);
bell(sfx, 25.18, hz(93), 0.05, 1.4);

// ------------------------------------------------------------------ Schroeder reverb (shared)
function reverb(bus, wet, rt = 0.86) {
  const k = SR / 44100;
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * k));
  const aps = [225, 556, 441].map((d) => Math.round(d * k));
  for (const [ch, off] of [['L', 0], ['R', 23]]) {
    const inp = bus[ch];
    const out = new Float32Array(N);
    for (const d0 of combs) {
      const d = d0 + off;
      const buf = new Float32Array(d);
      let p = 0;
      let damp = 0;
      for (let i = 0; i < N; i++) {
        const y = buf[p];
        damp += 0.35 * (y - damp);
        buf[p] = inp[i] + damp * rt;
        p = (p + 1) % d;
        out[i] += y / combs.length;
      }
    }
    for (const d0 of aps) {
      const d = d0 + off;
      const buf = new Float32Array(d);
      let p = 0;
      for (let i = 0; i < N; i++) {
        const y = buf[p];
        const x = out[i];
        buf[p] = x + y * 0.5;
        out[i] = y - x * 0.5;
        p = (p + 1) % d;
      }
    }
    for (let i = 0; i < N; i++) inp[i] += out[i] * wet;
  }
}
reverb(music, 0.45, 0.88);
reverb(sfx, 0.2, 0.8);

function writeWav(file, bus, gain) {
  const data = Buffer.alloc(N * 2 * 4);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    const fade = Math.min(1, (DUR - i / SR) / 0.9); // end fade
    const l = bus.L[i] * gain * fade;
    const r = bus.R[i] * gain * fade;
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    data.writeFloatLE(l, i * 8);
    data.writeFloatLE(r, i * 8 + 4);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
  console.log(path.basename(file), 'peak', peak.toFixed(3));
}
writeWav(path.join(outDir, 'music.wav'), music, 1.0);
writeWav(path.join(outDir, 'sfx.wav'), sfx, 1.0);
