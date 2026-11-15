// Composite + grade + audio -> art/video/astrakids-film.mp4   (run after film-render.mjs and film-audio.mjs)
//   node scripts/video/film-encode.mjs [--frames art/video/film/frames] [--no-audio] [--out path]
// Video: NASA Artemis I clip (art/video/film/s1.mp4, cut/graded below) under the RGBA page frames, light bloom, vignette, grain.
// Audio: voice-over at 0.3 s, synthesized music (sidechain-ducked under the voice) + SFX, loudnorm to about -16 LUFS, AAC 192k 48 kHz.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };
const filmDir = path.join(root, 'art', 'video', 'film');
const framesDir = path.resolve(root, String(opt('frames', 'art/video/film/frames')));
const outFile = path.resolve(root, String(opt('out', 'art/video/astrakids-film.mp4')));
const FPS = 30;
const DURATION = 26.5;
const NFRAMES = Math.round(DURATION * FPS);

const run = (a, label) => {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-y', ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(r.stderr.slice(-3000)); throw new Error(`ffmpeg failed: ${label}`); }
  return r.stderr;
};

// 1. NASA footage: Artemis I liftoff, 1.5x, lanczos 3840 upscale + slow left-anchored push-in, light grade
const s1 = path.join(filmDir, 's1.mp4');
const src = path.join(root, 'art', 'video', 'nasa', 'artemis1-launch-medium.mp4');
if (!fs.existsSync(s1) || opt('redo-s1')) {
  console.log('cutting NASA clip ->', s1);
  run(['-ss', '51.6', '-t', '4.6', '-i', src, '-vf',
    "setpts=PTS/1.5,fps=30,scale=3840:2160:flags=lanczos,zoompan=z='1.25+0.2*on/90':x='0':y='(ih-ih/zoom)*0.72':d=1:s=1920x1080:fps=30,eq=contrast=1.1:saturation=1.1:gamma=0.96,unsharp=5:5:0.5:5:5:0.0,format=yuv420p",
    '-frames:v', '90', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', s1], 's1');
}

// 2. video
const missing = [];
for (const i of [0, Math.floor(NFRAMES / 2), NFRAMES - 1]) if (!fs.existsSync(path.join(framesDir, String(i).padStart(5, '0') + '.png'))) missing.push(i);
if (missing.length) throw new Error(`frames missing in ${framesDir} (e.g. ${missing.join(', ')}); render them first`);
const silent = path.join(filmDir, 'video-silent.mp4');
const vf = [
  '[2:v]format=rgba[blk]',
  '[0:v]fps=30,format=rgba[bg0]',
  '[blk][bg0]overlay=0:0:format=auto:eof_action=pass[bg]',
  '[1:v]format=rgba[fg]',
  '[bg][fg]overlay=0:0:format=auto:eof_action=pass,format=gbrp[ov]',
  '[ov]split[a][b]',
  '[b]scale=480:270:flags=bilinear,curves=all=\'0/0 0.55/0 0.85/0.5 1/1\',gblur=sigma=7:steps=2,scale=1920:1080:flags=bicubic[bl]',
  '[a][bl]blend=all_mode=screen:all_opacity=0.5,eq=contrast=1.03:saturation=1.06,vignette=angle=PI/6:mode=forward,noise=alls=3:allf=t,format=yuv420p[v]',
].join(';');
console.log('encoding video (bloom, vignette, grain) ...');
run(['-i', s1, '-framerate', String(FPS), '-start_number', '0', '-i', path.join(framesDir, '%05d.png'), '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080:r=30:d=26.5', '-filter_complex', vf, '-map', '[v]', '-frames:v', String(NFRAMES), '-r', String(FPS), '-c:v', 'libx264', '-profile:v', 'high', '-crf', '22', '-preset', 'medium', '-pix_fmt', 'yuv420p', silent], 'video');

// 3. audio
let finalAudio = null;
if (!opt('no-audio')) {
  const voice = path.join(root, 'art', 'video', 'voiceover.mp3');
  const music = path.join(filmDir, 'music.wav');
  const sfx = path.join(filmDir, 'sfx.wav');
  for (const f of [voice, music, sfx]) if (!fs.existsSync(f)) throw new Error('missing audio input ' + f + ' (run film-audio.mjs)');
  const mix = path.join(filmDir, 'mix.wav');
  const fc = [
    `[0:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay=300|300,apad=whole_dur=${DURATION},atrim=0:${DURATION},volume=1.0,asplit=2[v1][v2]`,
    `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.2[m]`,
    `[m][v2]sidechaincompress=threshold=0.015:ratio=9:attack=25:release=500:makeup=1[duck]`,
    `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.42[s]`,
    `[v1][duck][s]amix=inputs=3:normalize=0:duration=longest,atrim=0:${DURATION}[mx]`,
  ].join(';');
  run(['-i', voice, '-i', music, '-i', sfx, '-filter_complex', fc, '-map', '[mx]', '-c:a', 'pcm_f32le', '-ar', '48000', mix], 'audio mix');
  // two-pass loudnorm: measure, then apply linearly
  const m = run(['-i', mix, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], 'loudnorm measure');
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  console.log('measured:', j.input_i, 'LUFS, TP', j.input_tp);
  finalAudio = path.join(filmDir, 'audio-final.m4a');
  run(['-i', mix, '-af', `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.89:level=false`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', finalAudio], 'audio encode');
}

// 4. mux
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const mux = ['-i', silent];
if (finalAudio) mux.push('-i', finalAudio);
mux.push('-c:v', 'copy');
if (finalAudio) mux.push('-c:a', 'copy', '-shortest');
mux.push('-movflags', '+faststart', outFile);
run(mux, 'mux');

// 5. verify
const info = spawnSync(ffmpeg, ['-hide_banner', '-i', outFile], { encoding: 'utf8' }).stderr;
const dm = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(info);
const dur = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : NaN;
console.log(`output ${outFile}  duration ${dur.toFixed(2)} s  size ${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB`);
if (!(dur <= 30.0)) { console.error('FAIL: duration exceeds the 30.0 s hard cap'); process.exit(2); }
const ln = spawnSync(ffmpeg, ['-hide_banner', '-i', outFile, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const sum = ln.slice(ln.lastIndexOf('Summary:'));
console.log(sum.replace(/\s+\n/g, '\n').slice(0, 600));
