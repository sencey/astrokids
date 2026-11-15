// Audio: three independent channels (music, sfx, voice). Music ducks under voice.
// Voice: real mp3 at public/audio/voice/{lang}/{key}.mp3 if present, else Web Speech API.
// SFX and music are generated with WebAudio (placeholders, nothing scary).
import { Howl } from 'howler';
import type { Lang } from '../i18n/lines';

export type SfxName = 'bubble' | 'chime' | 'thud' | 'bark' | 'pop' | 'sparkle' | 'whoosh' | 'ding' | 'crate';
export interface Volumes {
  music: number;
  sfx: number;
  voice: number;
}

const base = (): string => (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/');
const mp3Cache = new Map<string, Promise<boolean>>();

/** Dev servers answer 200 + index.html for missing files, so the content type must be audio. */
function mp3Exists(url: string): Promise<boolean> {
  let p = mp3Cache.get(url);
  if (!p) {
    p = fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && (r.headers.get('content-type') ?? '').toLowerCase().includes('audio'))
      .catch(() => false);
    mp3Cache.set(url, p);
  }
  return p;
}

class Engine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private vol: Volumes = { music: 0.6, sfx: 0.8, voice: 1 };
  private ducked = false;
  private token = 0;
  private howl: Howl | null = null;
  private finishCurrent: ((ok: boolean) => void) | null = null;
  private musicStarted = false;

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (the first tap on sleeping Pati). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        this.applyVolumes();
      }
      void this.ctx.resume();
      this.startMusic();
      // Warm up speech synthesis inside the gesture so later calls are allowed.
      if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    } catch {
      /* audio is optional */
    }
  }

  setVolumes(v: Volumes): void {
    this.vol = v;
    this.applyVolumes();
    if (this.howl) this.howl.volume(v.voice);
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.vol.music * (this.ducked ? 0.25 : 1) * 0.5, t, 0.2);
    this.sfxGain.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  private duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  // ---- Music: a soft, slow pad ----
  private startMusic(): void {
    if (this.musicStarted || !this.ctx || !this.musicGain) return;
    this.musicStarted = true;
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.connect(this.musicGain);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    [130.8, 196.0, 261.6, 329.6].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = i * 4 - 6;
      g.gain.value = 0.12 / (i + 1);
      o.connect(g).connect(filter);
      o.start();
    });
  }

  // ---- SFX ----
  private tone(freq: number, at: number, dur: number, type: OscillatorType, gain: number, endFreq?: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const t0 = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  sfx(name: SfxName): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'bubble':
        for (let i = 0; i < 4; i++) this.tone(320 + i * 70, i * 0.09, 0.14, 'sine', 0.3, 760 + i * 90);
        break;
      case 'chime':
        [659, 880, 1319].forEach((f, i) => this.tone(f, i * 0.11, 0.5, 'triangle', 0.22));
        break;
      case 'thud':
        this.tone(150, 0, 0.28, 'sine', 0.7, 48);
        this.tone(95, 0.02, 0.2, 'triangle', 0.3, 50);
        break;
      case 'bark':
        this.tone(430, 0, 0.13, 'triangle', 0.32, 250);
        this.tone(410, 0.18, 0.13, 'triangle', 0.3, 240);
        break;
      case 'pop':
        this.tone(500, 0, 0.09, 'sine', 0.3, 950);
        break;
      case 'sparkle':
        for (let i = 0; i < 5; i++) this.tone(1800 + ((i * 397) % 1200), i * 0.07, 0.1, 'triangle', 0.1);
        break;
      case 'whoosh':
        this.tone(200, 0, 0.35, 'sine', 0.18, 700);
        break;
      case 'ding':
        this.tone(880, 0, 0.3, 'sine', 0.25);
        break;
      case 'crate':
        this.tone(130, 0, 0.25, 'sine', 0.6, 55);
        [784, 988].forEach((f, i) => this.tone(f, 0.25 + i * 0.1, 0.35, 'triangle', 0.18));
        break;
    }
  }

  // ---- Voice ----
  stopVoice(): void {
    this.token++;
    try {
      this.howl?.stop();
      this.howl?.unload();
    } catch {
      /* ignore */
    }
    this.howl = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.duck(false);
    const f = this.finishCurrent;
    this.finishCurrent = null;
    f?.(false);
  }

  /** Resolves true when the line finished naturally, false if it was interrupted. */
  async say(key: string, text: string, lang: Lang): Promise<boolean> {
    this.stopVoice();
    const my = this.token;
    const url = `${base()}audio/voice/${lang}/${key}.mp3`;
    this.duck(true);
    const useMp3 = await mp3Exists(url);
    if (my !== this.token) return false;
    const ok = await new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        window.clearTimeout(safety);
        if (this.finishCurrent === finish) this.finishCurrent = null;
        resolve(v);
      };
      this.finishCurrent = finish;
      const estimate = text.length * 80 + 1800;
      const safety = window.setTimeout(() => finish(true), useMp3 ? 30000 : estimate + 2500);
      const speak = () => this.speakTts(text, lang, () => finish(true), estimate);
      if (useMp3) {
        this.howl = new Howl({
          src: [url],
          html5: true,
          volume: this.vol.voice,
          onend: () => finish(true),
          onloaderror: speak,
          onplayerror: speak,
        });
        this.howl.play();
      } else {
        speak();
      }
    });
    if (my === this.token) this.duck(false);
    return ok && my === this.token;
  }

  private speakTts(text: string, lang: Lang, done: () => void, estimateMs: number): void {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      window.setTimeout(done, estimateMs);
      return;
    }
    try {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
      u.rate = 0.9;
      u.volume = this.vol.voice;
      const v = synth.getVoices().find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(lang));
      if (v) u.voice = v;
      u.onend = done;
      u.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') done();
      };
      synth.speak(u);
    } catch {
      window.setTimeout(done, estimateMs);
    }
  }
}

export const engine = new Engine();
