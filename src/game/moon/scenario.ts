import scenarioJson from '../../data/scenarios/may-2024.json';
import { bandFromRatio } from '../rules';
import type { Scenario } from '../types';
import type { MoonDay } from './types';
import { MOON_RULES as R } from './rules';

/** Shape of data/raw/radlab/daily_CRaTER-D1D2.json (only what we read). */
export interface CraterDaily {
  instrumentId: string;
  label: string;
  provenance?: { sourceUrl: string };
  days: { date: string; ratio: number }[];
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The 15 mission days. Days present in the scenario JSON (05-08..05-15) are used as they are.
 * The remaining days (05-16..05-22) come from the CRaTER daily file (real ratio -> band), else
 * calm with bandIsAssumption = true. DONKI raw files stop at 05-16 and contain no SEP event after
 * 05-13, so there is no alarm on those days; instead, a day that follows a non-calm day without
 * an alarm is marked alertOngoing (the tail of the same particle event; this is an assumption).
 */
export function buildMoonDays(base: MoonDay[], crater: CraterDaily | null): MoonDay[] {
  const total = R.mission.days.value;
  const first = R.mission.startDate.value;
  const byDate = new Map(base.map((d) => [d.date, d]));
  const ratioByDate = new Map((crater?.days ?? []).map((d) => [d.date, d.ratio]));
  const out: MoonDay[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDays(first, i);
    const known = byDate.get(date);
    if (known) {
      out.push(known);
      continue;
    }
    const ratio = ratioByDate.get(date);
    const prev = out[i - 1];
    const band = ratio === undefined ? 'calm' : bandFromRatio(ratio);
    out.push({
      date,
      sparkleBand: band,
      sparkleRatio: ratio === undefined ? null : ratio,
      radInstrument: ratio === undefined ? null : (crater?.label ?? 'LRO CRaTER'),
      bandIsAssumption: ratio === undefined,
      alarmAt: null,
      alarmKind: null,
      alertOngoing: band !== 'calm' && prev !== undefined && prev.sparkleBand !== 'calm',
    });
  }
  return out;
}

const rawModules = import.meta.glob<CraterDaily>('/data/raw/radlab/daily_CRaTER-D1D2.json', {
  eager: true,
  import: 'default',
});

/** The mission days as the app should play them. */
export function loadMoonDays(): MoonDay[] {
  const crater = Object.values(rawModules)[0] ?? null;
  return buildMoonDays((scenarioJson as unknown as Scenario).days, crater);
}


