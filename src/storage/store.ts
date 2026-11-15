// Local-only persistence (IndexedDB via idb-keyval). Every call is wrapped: private mode must never crash the app.
import { get, set, del, keys } from 'idb-keyval';
import type { Lang } from '../i18n/lines';
import { detectLang } from '../i18n/lines';
import type { Mode } from '../game/types';

export interface Settings {
  lang: Lang;
  captions: 'auto' | 'on' | 'off';
  music: number; // 0..1
  sfx: number;
  voice: number;
  reduceMotion: boolean;
}

export const defaultSettings = (): Settings => ({
  lang: detectLang(),
  captions: 'auto',
  music: 0.6,
  sfx: 0.8,
  voice: 1,
  reduceMotion: false,
});

export interface RunRecord {
  at: string;
  scenario: string;
  mode: Mode;
  outcome: 'completed' | 'earlyReturn' | null;
  summary: { daysPlayed: number; totalSparkles: number; samples: number; resupplies: number; daysSheltered: number };
}

export interface SkyGuess {
  activityId: string;
  estimate: string; // ISO of the ENLIL estimate the guess was about
  guess: string; // ISO of the child's guess
  madeAt: string;
  mode: Mode;
}

const PREFIX = 'pati:';
const memory = new Map<string, unknown>(); // used when IndexedDB is unavailable

async function read<T>(key: string): Promise<T | undefined> {
  try {
    const v = await get<T>(PREFIX + key);
    if (v !== undefined) return v;
  } catch {
    /* private mode / blocked storage */
  }
  return memory.get(key) as T | undefined;
}

async function write(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  try {
    await set(PREFIX + key, value);
  } catch {
    /* ignore */
  }
}

export async function loadSettings(): Promise<Settings> {
  const saved = await read<Partial<Settings>>('settings');
  return { ...defaultSettings(), ...(saved ?? {}) };
}
export const saveSettings = (s: Settings) => write('settings', s);

export const getSeenTutorial = async (): Promise<boolean> => (await read<boolean>('seenTutorial')) === true;
export const setSeenTutorial = (v: boolean) => write('seenTutorial', v);

export const getRuns = async (): Promise<RunRecord[]> => (await read<RunRecord[]>('runs')) ?? [];
export async function addRun(run: RunRecord): Promise<void> {
  const runs = await getRuns();
  await write('runs', [run, ...runs].slice(0, 10));
}

export const getSkyGuesses = async (): Promise<SkyGuess[]> => (await read<SkyGuess[]>('skyGuesses')) ?? [];
export async function saveSkyGuess(g: SkyGuess): Promise<void> {
  const all = (await getSkyGuesses()).filter((x) => x.activityId !== g.activityId);
  await write('skyGuesses', [g, ...all].slice(0, 30));
}

export async function resetAll(): Promise<void> {
  memory.clear();
  try {
    for (const k of await keys()) if (String(k).startsWith(PREFIX)) await del(k);
  } catch {
    /* ignore */
  }
}
