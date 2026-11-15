import { MOON_RULES as R } from './rules';
import type { MoonDay } from './types';

/** The part of public/data/latest.json the live hook reads. */
export interface LatestJsonLike {
  generatedAt: string;
  sep: { eventTime: string; instruments?: unknown }[];
}

/** "Now" on the Moon: the UI gets the real sunlit % for the slot from the 3D layer. */
export interface SunNow {
  /** ISO time of "now". */
  at: string;
  /** Percent of today sunlit for a slot (the UI builds litPctByDay = [litPct] for a one-day mission). */
  litPct: number;
}

export interface LiveDay extends MoonDay {
  sunNow: SunNow;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Live "today": any SEP event in the last 24 h makes today a storm with unknown ratio
 * (engine base = rules unknownRatioBase = 8, an assumption). Otherwise calm.
 */
export function liveDayFromToday(latest: LatestJsonLike, sunNow: SunNow): LiveDay {
  const now = Date.parse(sunNow.at);
  const recent = latest.sep
    .filter((e) => {
      const t = Date.parse(e.eventTime);
      return Number.isFinite(t) && t <= now && now - t <= DAY_MS;
    })
    .sort((a, b) => Date.parse(b.eventTime) - Date.parse(a.eventTime));
  const hit = recent[0];
  return {
    date: sunNow.at.slice(0, 10),
    sparkleBand: hit ? 'storm' : 'calm',
    sparkleRatio: null,
    radInstrument: null,
    bandIsAssumption: true,
    alarmAt: hit ? hit.eventTime : null,
    alarmKind: hit ? 'measured' : null,
    alertOngoing: false,
    sunNow,
  };
}

/** Exposed so the grown-ups screen can show the live-mode assumption. */
export const LIVE_STORM_BASE = R.radiation.unknownRatioBase.value.storm;
