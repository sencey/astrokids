// Pure helpers for the sky track.
export const UNCERTAINTY_HOURS = 7; // ENLIL arrival is only good to about +-7 h

const H = 3_600_000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 0..1 glow size from a GOES class string such as "X5.8" or "M1.3". */
export function flareSize(cls: string | null | undefined): number {
  if (!cls) return 0;
  const letter = cls[0].toUpperCase();
  const mag = parseFloat(cls.slice(1)) || 1;
  if (letter === 'X') return Math.min(1, 0.78 + mag / 40);
  if (letter === 'M') return 0.32 + Math.min(mag, 9) * 0.02;
  if (letter === 'C') return 0.18;
  return 0.1;
}

const rank = (cls: string) => {
  const l = cls[0].toUpperCase();
  return ({ X: 4, M: 3, C: 2, B: 1, A: 0 } as Record<string, number>)[l] * 1000 + (parseFloat(cls.slice(1)) || 0);
};

export function biggestFlare<T extends { classType: string }>(flares: T[]): T | null {
  return flares.reduce<T | null>((best, f) => (best === null || rank(f.classType) > rank(best.classType) ? f : best), null);
}

export interface CloudState {
  progress: number; // 0 = at the Sun, 1 = at the base
  widthFrac: number; // shadow width as a fraction of the track
}

/** Where the cloud is at `nowMs`, travelling from CME start to the estimated arrival. */
export function cloudState(nowMs: number, cmeStartIso: string | null, estIso: string): CloudState {
  const est = Date.parse(estIso);
  const start = cmeStartIso ? Date.parse(cmeStartIso) : est - 48 * H;
  const travel = Math.max(est - start, 6 * H);
  return {
    progress: clamp((nowMs - start) / travel, 0.04, 1),
    widthFrac: clamp((2 * UNCERTAINTY_HOURS * H) / travel, 0.12, 0.5),
  };
}

export const noonUtc = (date: string): number => Date.parse(`${date}T12:00:00Z`);

/** "12 May 11:13 UTC" style label. */
export function fmtUtc(iso: string, lang: 'tr' | 'en' = 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${date} ${hh}:${mm} UTC`;
}
export const fmtClock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
