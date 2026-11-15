// Assembles art/video/astrakids-demo.mp4 from art/video/raw/*.webm
//   node scripts/video/assemble.mjs [--only S1,S3]   (only = restrict shots, handy for previews)
// Per-shot timing: art/video/edit.json  { "S2": { "in": 2.0, "out": 9.0, "speed": 2 }, ... , "endcard": 3, "xfade": 0.3 }
//   in/out = seconds inside the raw webm (default: in = meta.start, out = in + target*speed); speed = playback factor (time-lapse).
// Optional voiceover: art/video/voiceover.mp3 (mixed at full level from 0.3 s). HARD CAP 30.0 s, asserted.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const vdir = path.join(root, 'art', 'video');
const raw = path.join(vdir, 'raw');
const tmp = path.join(vdir, 'tmp');
fs.mkdirSync(tmp, { recursive: true });
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const args = process.argv.slice(2);
const oi = args.indexOf('--only');
const only = oi >= 0 ? args[oi + 1].split(',') : null;

const ff = (a) => {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-y', ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(r.stderr.slice(-2500)); throw new Error('ffmpeg failed'); }
  return r.stderr;
};
const duration = (f) => {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', f], { encoding: 'utf8' });
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  if (!m) throw new Error('no duration for ' + f);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
};

const meta = JSON.parse(fs.readFileSync(path.join(raw, 'meta.json'), 'utf8'));
const editPath = path.join(vdir, 'edit.json');
const edit = fs.existsSync(editPath) ? JSON.parse(fs.readFileSync(editPath, 'utf8')) : {};
const XF = edit.xfade ?? 0.3;
const END = edit.endcard ?? 3;

// ---- end card PNG via playwright (no browser download: installed Edge)
const cardPng = path.join(tmp, 'endcard.png');
{
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ channel: 'msedge', headless: false });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file:///' + path.join(here, 'endcard.html').replace(/\\/g, '/'));
  await p.waitForLoadState('load');
  await p.waitForTimeout(500);
  await p.screenshot({ path: cardPng });
  await b.close();
}

// ---- normalise every shot to 1920x1080 30fps h264, trimmed
const ids = Object.keys(meta).filter((id) => !only || only.includes(id)).sort();
const clips = [];
const defaults = { S1: 4, S2: 6, S3: 5, S4: 5, S5: 6 };
for (const id of ids) {
  const m = meta[id];
  const e = edit[id] || {};
  const speed = e.speed ?? 1;
  const inS = e.in ?? m.start ?? 0;
  const target = e.target ?? m.target ?? defaults[id] ?? 5;
  m.target = target;
  const len = (e.out != null ? e.out - inS : target * speed);
  const out = path.join(tmp, `${id}.mp4`);
  const norm = 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p';
  if (m.arrive && e.out == null && e.speed == null) {
    // walk-then-arrive shot: time-lapse the walk, play the arrival (card) in real time
    const tail = e.tail ?? 3.5, pre = 0.6;
    const walkLen = Math.max(0.5, m.arrive - pre - inS), walkOut = Math.max(0.5, (m.target ?? 5) - tail - pre);
    const sp = Math.max(1, walkLen / walkOut);
    const fc = `[0:v]trim=start=${inS}:duration=${walkLen},setpts=(PTS-STARTPTS)/${sp},${norm}[a];[0:v]trim=start=${m.arrive - pre}:duration=${tail + pre},setpts=PTS-STARTPTS,${norm}[b];[a][b]concat=n=2:v=1:a=0[o]`;
    ff(['-i', path.join(raw, m.file), '-filter_complex', fc, '-map', '[o]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
  } else {
    const vf = `trim=start=${inS}:duration=${len},setpts=(PTS-STARTPTS)/${speed},${norm}`;
    ff(['-i', path.join(raw, m.file), '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', out]);
  }
  const d = duration(out);
  console.log(`${id}: in=${inS.toFixed(1)} len=${len.toFixed(1)} speed=${speed} -> ${d.toFixed(2)}s`);
  clips.push({ id, file: out, dur: d });
}
// end card clip
if (!only) {
  const out = path.join(tmp, 'endcard.mp4');
  ff(['-loop', '1', '-framerate', '30', '-i', cardPng, '-t', String(END), '-vf', 'fade=t=in:st=0:d=0.3,format=yuv420p', '-c:v', 'libx264', '-crf', '18', out]);
  clips.push({ id: 'endcard', file: out, dur: duration(out) });
}

// ---- xfade chain
let total = clips[0].dur;
const inputs = clips.flatMap((c) => ['-i', c.file]);
let filter = '';
let last = '[0:v]';
for (let i = 1; i < clips.length; i++) {
  const off = total - XF;
  const lab = `[v${i}]`;
  filter += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${off.toFixed(3)}${lab};`;
  last = lab;
  total = total + clips[i].dur - XF;
}
filter = filter.replace(/;$/, '');
console.log(`video length ~${total.toFixed(2)} s`);

const voice = path.join(vdir, 'voiceover.mp3');
const hasVoice = fs.existsSync(voice);
let finalLen = total;
if (hasVoice) finalLen = Math.max(total, duration(voice) + 0.3 + 0.5);
if (finalLen > 30.0) throw new Error(`Output would be ${finalLen.toFixed(2)} s > 30.0 s cap. Trim shots in art/video/edit.json.`);

const outFile = path.join(vdir, 'astrakids-demo.mp4');
const a = [...inputs];
let amap;
const n = clips.length;
if (hasVoice) {
  a.push('-i', voice);
  filter += `;[${n}:a]adelay=300|300,apad,atrim=0:${finalLen.toFixed(3)},aformat=sample_rates=48000:channel_layouts=stereo[aout]`;
} else {
  a.push('-f', 'lavfi', '-t', finalLen.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
}
// pad video with last frame if voice outlasts it
if (finalLen > total) filter += `;${last}tpad=stop_mode=clone:stop_duration=${(finalLen - total + 0.1).toFixed(3)}[vout]`; else filter += `;${last}null[vout]`;
amap = hasVoice ? '[aout]' : `${n}:a`;
ff([...a, '-filter_complex', filter, '-map', '[vout]', '-map', amap, '-t', finalLen.toFixed(3), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outFile]);

const d = duration(outFile);
console.log(`\nOUTPUT ${outFile}\n  duration ${d.toFixed(2)} s, size ${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB, voiceover: ${hasVoice}`);
if (d > 30.0) { console.error('FAIL: output exceeds 30.0 s'); process.exit(2); }
console.log('OK: <= 30.0 s');

