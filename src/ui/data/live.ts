import { matchShock } from '../../game/mission';
import type { Provenance, ScenarioDay } from '../../game/types';

export interface LiveCme {
  activityId: string;
  startTime: string;
  speedKms: number | null;
  halfAngle: number | null;
  enlil: { estShockArrivalEarth: string | null; kp90: number | null; kp180: number | null; mars: unknown } | null;
}
export interface LiveData {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  provenance: Provenance[];
  flares: { peakTime: string; classType: string }[];
  cmes: LiveCme[];
  shocks: { eventTime: string; location: string }[];
  sep: { eventTime: string }[];
  notifications: unknown[];
}
export type LiveResult = { status: 'ok'; data: LiveData } | { status: 'offline' } | { status: 'missing' };

/** Fetches public/data/latest.json. 404, offline and malformed responses all degrade gracefully. */
export async function loadLive(): Promise<LiveResult> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, { cache: 'no-cache' });
    if (!res.ok) return { status: 'missing' };
    const json = (await res.json()) as Partial<LiveData>;
    if (!json || typeof json.generatedAt !== 'string') return { status: 'missing' };
    const data: LiveData = {
      generatedAt: json.generatedAt,
      windowStart: json.windowStart ?? '',
      windowEnd: json.windowEnd ?? '',
      provenance: json.provenance ?? [],
      flares: json.flares ?? [],
      cmes: json.cmes ?? [],
      shocks: json.shocks ?? [],
      sep: json.sep ?? [],
      notifications: json.notifications ?? [],
    };
    return { status: 'ok', data };
  } catch (e) {
    return e instanceof SyntaxError ? { status: 'missing' } : { status: 'offline' };
  }
}

const H = 3_600_000;
const D = 24 * H;

/**
 * LIVE badge / blinking collar rule: isLive && fetchedAt within 36 h && some event within 7 days.
 * (Archive scenarios never use this; only latest.json can be LIVE.)
 */
export function liveRuleHolds(data: LiveData, now: number = Date.now()): boolean {
  if (data.provenance.length === 0) return false;
  const fresh = data.provenance.every((p) => p.isLive && now - Date.parse(p.fetchedAt) <= 36 * H);
  if (!fresh) return false;
  const times = [
    ...data.flares.map((f) => f.peakTime),
    ...data.cmes.map((c) => c.startTime),
    ...data.shocks.map((s) => s.eventTime),
    ...data.sep.map((s) => s.eventTime),
  ];
  return times.some((t) => {
    const ms = Date.parse(t);
    return ms <= now + D && now - ms <= 7 * D;
  });
}

/** Newest CME that has an ENLIL Earth-arrival estimate no older than 7 days. */
export function pickEarthCme(data: LiveData, now: number = Date.now()): LiveCme | null {
  const cands = data.cmes
    .filter((c) => c.enlil?.estShockArrivalEarth)
    .filter((c) => now - Date.parse(c.enlil!.estShockArrivalEarth!) <= 7 * D)
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  return cands[0] ?? null;
}

/** Wrap live shocks so the game's matchShock semantics (closest Earth shock within the window) apply. */
export function matchLiveShock(data: LiveData, estimateIso: string): string | null {
  const day = {
    shocks: data.shocks.filter((s) => s.location === 'Earth').map((s) => ({ eventTime: s.eventTime, location: s.location })),
  } as unknown as ScenarioDay;
  return matchShock([day], estimateIso);
}
