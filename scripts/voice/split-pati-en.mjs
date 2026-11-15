// Split art/voice-source/pati-en-all.mp3 into 31 per-line MP3s (DP alignment on pause candidates).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPEGDecoder } from 'mpg123-decoder';
import { Mp3Encoder } from '@breezystack/lamejs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const src = path.resolve(root, opt('--src') || 'art/voice-source/pati-en-all.mp3');
const outDir = path.join(root, 'public/audio/voice/en');
const DRY = argv.includes('--dry');

const DEFAULT_LINES = [
  ['moon3d.welcome', "Commander, welcome to the Moon's south pole! Where shall we build our base?"],
  ['moon3d.patiMode', 'Which mission are we flying, Commander?'],
  ['moon3d.cargoPrompt', 'Commander, the lander can carry only two extra loads. Which ones do we take?'],
  ['moon3d.placeHabitat', 'Place the habitat first. Near ice, or sunny?'],
  ['moon3d.placeTower', 'Now the solar towers. Find sunny spots!'],
  ['moon3d.placeGreenhouse', 'Place your greenhouse too.'],
  ['moon3d.placeReady', 'All set! Shall we start the mission?'],
  ['moon3d.guide1', 'These are your gauges: battery, air, dose and stars.'],
  ['moon3d.guide2', "Here is today's Sun. Press Plan the day."],
  ['moon3d.guide3', 'Pick Keep base running so the air lasts.'],
  ['moon3d.guide4', 'Now pick Shield layer, it lowers your dose.'],
  ['moon3d.guide5', 'Ready! Press Start the day.'],
  ['moon3d.guide6', 'The day is done. Read the report: what did you spend and gain?'],
  ['moon3d.patiBriefSuper', 'Commander, a giant storm! A shield is a must!'],
  ['moon3d.patiBriefStorm', 'Commander, a solar storm! Stay inside or build a shield!'],
  ['moon3d.patiBriefAlert', 'Commander, an alert may come! Careful outside!'],
  ['moon3d.patiBriefDark', 'The Sun is below the horizon today, so the towers make no power. Watch the battery!'],
  ['moon3d.patiBriefEmpty', 'The battery is empty! Spend energy very carefully.'],
  ['moon3d.patiBriefLife', 'Life support is low! We need ice or the greenhouse.'],
  ['moon3d.patiBriefCalm', 'Commander, a calm day. Spend your energy wisely!'],
  ['moon3d.patiLive', 'Commander, this is the real Sun and real space weather of today!'],
  ['moon3d.pickIce', 'Tap a shadowed crater.'],
  ['moon3d.pickWalk', 'Tap a spot to walk to.'],
  ['moon3d.pickTooFar', 'Too far: tap a closer spot.'],
  ['moon3d.pickNotIce', 'No ice here: tap a dark shadowed spot.'],
  ['moon3d.pickSteep', 'Too steep: tap another spot.'],
  ['moon3d.patiAlarm', 'Alarm! Recall the crew right now!'],
  ['moon3d.patiRecalled', 'Well done, Commander! They made it back in time.'],
  ['moon3d.patiTooLate', 'We were too late...'],
  ['moon3d.patiPlanError', 'The plan did not run. Pick your actions again.'],
  ['moon3d.patiEnd', 'Mission over! Look at what really happened.'],
];
// --lines file.json: [[name, text, optionalSpokenText], ...] (spoken text used for length model)
const LINES = opt('--lines') ? JSON.parse(fs.readFileSync(path.resolve(root, opt('--lines')), 'utf8').replace(/^\uFEFF/, '')) : DEFAULT_LINES;
const N = LINES.length;

// ---- decode
const dec = new MPEGDecoder();
await dec.ready;
const r = dec.decode(new Uint8Array(fs.readFileSync(src)));
const sr = r.sampleRate;
const chans = r.channelData;
const nS = chans[0].length;
const mono = new Float32Array(nS);
for (const c of chans) for (let i = 0; i < nS; i++) mono[i] += c[i] / chans.length;
console.log(`decoded: ${sr} Hz, ${chans.length} ch, ${(nS / sr).toFixed(2)} s`);

// ---- envelope (10 ms hop, 20 ms window)
const hop = Math.round(sr * 0.01), win = Math.round(sr * 0.02);
const nF = Math.floor((nS - win) / hop);
const env = new Float32Array(nF);
for (let f = 0; f < nF; f++) {
  let s = 0;
  for (let i = f * hop; i < f * hop + win; i++) s += mono[i] * mono[i];
  env[f] = Math.sqrt(s / win);
}
const sorted = Array.from(env).sort((a, b) => a - b);
const speechLevel = sorted[Math.floor(sorted.length * 0.9)];
const thr = speechLevel * 0.05; // ~ -26 dB below loud speech
console.log(`speech level (p90 RMS) ${speechLevel.toFixed(4)}, threshold ${thr.toFixed(4)}`);

// silence runs >= 150 ms
const MINSIL = 15;
const sil = [];
let st = -1;
for (let f = 0; f <= nF; f++) {
  const q = f < nF && env[f] < thr;
  if (q && st < 0) st = f;
  if (!q && st >= 0) { if (f - st >= MINSIL) sil.push({ s: st * 0.01, e: f * 0.01 }); st = -1; }
}
// leading / trailing silence
const lead = sil.length && sil[0].s < 0.02 ? sil.shift() : null;
const trail = sil.length && sil[sil.length - 1].e > nF * 0.01 - 0.03 ? sil.pop() : null;
const speechStart = lead ? lead.e : 0;
const speechEnd = trail ? trail.s : nF * 0.01;
console.log(`candidate pauses: ${sil.length}; speech ${speechStart.toFixed(2)}..${speechEnd.toFixed(2)}`);
if (sil.length < N - 1) { console.log('FAIL: too few pauses'); process.exit(1); }

// ---- DP: pick N-1 pauses; segment i spans (prev.e or speechStart) -> (cur.s or speechEnd)
const chars = LINES.map(l => (l[2] || l[1]).length);
const totChars = chars.reduce((a, b) => a + b, 0);
const M = sil.length;
const segStart = j => (j < 0 ? speechStart : sil[j].e);
const segEnd = j => (j >= M ? speechEnd : sil[j].s);
// k = sec/char estimate: iterate (initial: speech minus 30*avg pause)
let k = (speechEnd - speechStart) * 0.85 / totChars;
let best;
for (let iter = 0; iter < 6; iter++) {
  const INF = 1e18;
  // dp[i][j]: first i+1 segments done, i-th segment ends at pause j (j=M => end)
  const dp = Array.from({ length: N }, () => new Float64Array(M + 1).fill(INF));
  const bp = Array.from({ length: N }, () => new Int32Array(M + 1).fill(-2));
  const cost = (a, b, i) => {
    const d = segEnd(b) - segStart(a), e = k * chars[i] + 0.25;
    if (d <= 0.1) return INF;
    return ((d - e) / e) ** 2;
  };
  const bonus = j => (j >= M ? 0 : -0.15 * Math.min(sil[j].e - sil[j].s, 1.5));
  for (let j = 0; j < M; j++) { dp[0][j] = cost(-1, j, 0) + bonus(j); bp[0][j] = -1; }
  for (let i = 1; i < N; i++) {
    const last = i === N - 1;
    for (let j = last ? M : i; j <= (last ? M : M - 1); j++) {
      for (let p = i - 1; p < j && p < M; p++) {
        if (dp[i - 1][p] >= INF) continue;
        const v = dp[i - 1][p] + cost(p, j, i) + bonus(j);
        if (v < dp[i][j]) { dp[i][j] = v; bp[i][j] = p; }
      }
    }
  }
  const cuts = [];
  let j = M;
  for (let i = N - 1; i >= 0; i--) { cuts.unshift(j); j = bp[i][j]; }
  best = cuts;
  // re-fit k by least squares through origin on speech durations
  let num = 0, den = 0;
  for (let i = 0; i < N; i++) {
    const a = i === 0 ? -1 : cuts[i - 1];
    num += (segEnd(cuts[i]) - segStart(a)) * chars[i]; den += chars[i] * chars[i];
  }
  k = num / den;
}
if (argv.includes('--pauses')) console.log(sil.map((p, i) => `${i}:${p.s.toFixed(2)}-${p.e.toFixed(2)}(${(p.e - p.s).toFixed(2)})${best.includes(i) ? '*' : ''}`).join(' '));
const cuts = best; // cuts[i] = index of pause ending segment i (last = M)

// ---- segments & validation
const segs = LINES.map(([name, text], i) => {
  const a = i === 0 ? -1 : cuts[i - 1], b = cuts[i];
  return { i: i + 1, name, chars: (LINES[i][2] || text).length, s: segStart(a), e: segEnd(b), prevMid: a < 0 ? 0 : (sil[a].s + sil[a].e) / 2, nextMid: b >= M ? nF * 0.01 + win / sr : (sil[b].s + sil[b].e) / 2, gapAfter: b >= M ? 0 : sil[b].e - sil[b].s };
});
const spc = segs.map(s => (s.e - s.s) / s.chars);
const med = [...spc].sort((a, b) => a - b)[N >> 1];
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const D = segs.map(s => s.e - s.s), C = segs.map(s => s.chars);
const mD = mean(D), mC = mean(C);
const rr = D.reduce((a, d, i) => a + (d - mD) * (C[i] - mC), 0) /
  Math.sqrt(D.reduce((a, d) => a + (d - mD) ** 2, 0) * C.reduce((a, c) => a + (c - mC) ** 2, 0));
console.log('\n#  name                      start    end      dur   chars  s/char  ratio  gapAfter');
let flags = 0;
segs.forEach((s, i) => {
  const ratio = spc[i] / med;
  const flag = ratio > 1.6 || ratio < 0.6 ? ' <-- FLAG' : '';
  if (flag) flags++;
  console.log(`${String(s.i).padStart(2)} ${s.name.padEnd(26)}${s.s.toFixed(2).padStart(7)} ${s.e.toFixed(2).padStart(7)} ${(s.e - s.s).toFixed(2).padStart(6)} ${String(s.chars).padStart(6)} ${spc[i].toFixed(4)} ${ratio.toFixed(2).padStart(6)}  ${s.gapAfter.toFixed(2)}${flag}`);
});
console.log(`\nPearson r = ${rr.toFixed(4)}, median s/char = ${med.toFixed(4)}, flags = ${flags}`);
const relaxed = opt('--gate') === 'relaxed'; // opt-in: r >= 0.80, gaps >= 0.35 s, ratio within 0.7-1.4
const gateOk = relaxed
  ? rr >= 0.80 && !flags && segs.slice(0, -1).every(s => s.gapAfter >= 0.35) && spc.every(v => v / med >= 0.7 && v / med <= 1.4)
  : rr >= 0.85 && !flags;
if (!gateOk) { console.log('VALIDATION FAILED - not writing files.'); process.exit(2); }
if (DRY) { console.log('dry run: validation passed, nothing written'); process.exit(0); }

// ---- write
fs.mkdirSync(outDir, { recursive: true });
const FADE = Math.round(sr * 0.015);
const outInfo = [];
let totalSec = 0;
for (const s of segs) {
  const a = Math.max(Math.round((s.s - 0.12) * sr), Math.round(s.prevMid * sr), 0);
  const b = Math.min(Math.round((s.e + 0.2) * sr), Math.round(s.nextMid * sr), nS);
  const len = b - a;
  const pcm = chans.map(c => {
    const out = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      let g = 1;
      if (i < FADE) g = i / FADE;
      if (len - 1 - i < FADE) g = Math.min(g, (len - 1 - i) / FADE);
      out[i] = Math.max(-32768, Math.min(32767, Math.round(c[a + i] * g * 32767)));
    }
    return out;
  });
  const enc = new Mp3Encoder(chans.length, sr, 128);
  const parts = [];
  for (let i = 0; i < len; i += 1152 * 8) {
    const l = pcm[0].subarray(i, i + 1152 * 8);
    const m = chans.length > 1 ? enc.encodeBuffer(l, pcm[1].subarray(i, i + 1152 * 8)) : enc.encodeBuffer(l);
    if (m.length) parts.push(Buffer.from(m));
  }
  parts.push(Buffer.from(enc.flush()));
  const buf = Buffer.concat(parts);
  fs.writeFileSync(path.join(outDir, s.name + '.mp3'), buf);
  const dur = len / sr;
  totalSec += dur;
  outInfo.push({ name: s.name, bytes: buf.length, dur: +dur.toFixed(2) });
}
const credPath = path.join(outDir, 'credits.json');
const cred = fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf8')) : {
  source: 'ElevenLabs text-to-speech (SI-generated audio), voice "Killian - Clear, Warm, Upbeat & Friendly"',
  generatedBy: 'team',
  note: 'SI-generated audio per NASA Space Apps 2026 rules',
  files: [],
};
for (const l of LINES) if (!cred.files.includes(l[0] + '.mp3')) cred.files.push(l[0] + '.mp3');
fs.writeFileSync(credPath, JSON.stringify(cred, null, 2) + '\n');console.log('\nwritten files:');
for (const o of outInfo) console.log(`${o.name.padEnd(28)} ${String(o.bytes).padStart(7)} B  ${o.dur.toFixed(2)} s`);
console.log(`total ${totalSec.toFixed(2)} s, ${outInfo.reduce((a, o) => a + o.bytes, 0)} B`);



