/**
 * "Exploration first": the child walks the real Moon from the first seconds. Buildings, energy and the storm
 * are decided INSIDE the world; a day ends when the child is back at base and taps "End the day".
 * Pure TS. The real-data core (sunlight, CRaTER storms, dose, life support) is the same resolveDay as before.
 */
import { dailyMissions } from '../explore/explore';
import { batteryCap, greenhouseCost, litPct, resolveDay } from './engine';
import { MOON_RULES as R } from './rules';
import type { Rule } from './rules';
import type { DayReport, MoonDay, MoonPlan, MoonState, SlotStats } from './types';

// ---------------------------------------------------------------- start

export interface WorldStartOptions {
  /** Stats of the habitat slot (the habitat + lander are pre-placed there). */
  habitat: SlotStats;
  days: MoonDay[];
}

/** A new mission with the habitat and lander placed, no towers, battery 8 / cap 8, nothing chosen. */
export function startWorldMission(opts: WorldStartOptions): MoonState {
  if (opts.days.length === 0) throw new RangeError('A mission needs at least one day');
  return {
    setup: {
      habitat: opts.habitat,
      towers: [],
      greenhouse: null,
      // Placeholder: the cargo screen is gone. Neither item adds capacity (batteryBank is NOT here).
      cargo: ['extraTower', 'greenhouse'],
      batteryUnits: 0,
      towerFromDay: [],
    },
    days: opts.days,
    cursor: 0,
    battery: R.world.startBattery.value,
    life: R.life.start.value,
    dose: 0,
    science: 0,
    berm: 0,
    iceTrips: 0,
    walkCancelledToday: false,
    resupplies: 0,
    reports: [],
    outcome: null,
  };
}

// ---------------------------------------------------------------- live building

export type BuildKind = 'tower' | 'battery' | 'greenhouse';

/** Cost rule of a building (energy units). isAssumption is true. */
export function buildCost(kind: BuildKind): Rule<number> {
  switch (kind) {
    case 'tower':
      return R.world.towerCost;
    case 'battery':
      return R.world.batteryUnitCost;
    case 'greenhouse':
      return R.world.greenhouseBuildCost;
  }
}

/** Starter-kit limit of a building kind. */
export function buildLimit(kind: BuildKind): number {
  return kind === 'tower' ? R.world.maxTowers.value : kind === 'battery' ? R.world.maxBatteryUnits.value : R.world.maxGreenhouses.value;
}

/** How many of this kind are already built. */
export function builtCount(state: MoonState, kind: BuildKind): number {
  return kind === 'tower' ? state.setup.towers.length : kind === 'battery' ? (state.setup.batteryUnits ?? 0) : state.setup.greenhouse ? 1 : 0;
}

export type DayEnergyBucket = 'walk' | 'build' | 'shield' | 'greenhouse';

/** Energy of the day being played, as the UI keeps it. Immutable: every helper returns a new one. */
export interface DayLive {
  /** 0-based mission day this belongs to */
  dayIndex: number;
  /** battery + today's production (towers that already work) */
  available: number;
  /** what the base needs overnight (running cost incl. cold-habitat extra) */
  reserveForBase: number;
  /** total spent so far today */
  spent: number;
  spentBy: Record<DayEnergyBucket, number>;
}

export function dayStart(state: MoonState): DayLive {
  const dayIdx = state.cursor;
  const production = state.setup.towers.reduce((a, t, i) => a + ((state.setup.towerFromDay?.[i] ?? 0) > dayIdx ? 0 : Math.round((R.energy.towerPeakUnits.value * litPct(t, dayIdx)) / 100)), 0);
  const cold = litPct(state.setup.habitat, dayIdx) < R.actions.coldHabitatLitPct.value ? R.actions.coldHabitatExtra.value : 0;
  return {
    dayIndex: dayIdx,
    available: state.battery + production,
    reserveForBase: R.actions.runningCostInside.value + cold,
    spent: 0,
    spentBy: { walk: 0, build: 0, shield: 0, greenhouse: 0 },
  };
}

/** Energy still free today (not counting the base reserve). */
export const liveLeft = (live: DayLive): number => live.available - live.spent;

/** Energy the child can spend and still run the base overnight. */
export const liveSpendable = (live: DayLive): number => Math.max(0, liveLeft(live) - live.reserveForBase);

/**
 * Can the child pay `amount`? By default the base reserve is kept back; pass `{ useReserve: true }`
 * when the child explicitly chooses to skip running the base.
 */
export function canAfford(live: DayLive, amount: number, opts: { useReserve?: boolean } = {}): boolean {
  if (!Number.isFinite(amount) || amount < 0) return false;
  return amount <= (opts.useReserve ? Math.max(0, liveLeft(live)) : liveSpendable(live));
}

/** Records spent energy (does not check; call canAfford first). */
export function spend(live: DayLive, amount: number, bucket: DayEnergyBucket = 'walk'): DayLive {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid amount');
  return { ...live, spent: live.spent + amount, spentBy: { ...live.spentBy, [bucket]: live.spentBy[bucket] + amount } };
}

/** Energy of "+1 berm level" (only at base). */
export const shieldBuildCost = (): number => R.actions.shieldCost.value;

/** Energy to switch the greenhouse on today (0 if there is none). */
export function greenhouseOnCost(state: MoonState): number {
  return state.setup.greenhouse ? greenhouseCost(state.setup.greenhouse, state.cursor) : 0;
}

export type BuildFailReason = 'limit' | 'energy' | 'noSlot' | 'missionOver';
export type BuildResult =
  | { ok: true; state: MoonState; live: DayLive; cost: number }
  | { ok: false; reason: BuildFailReason; cost: number };

/**
 * Build something now. Towers start producing from the NEXT day (setup.towerFromDay); a battery unit raises
 * the cap at once; the greenhouse can be switched on today. `slotStats` is needed for tower and greenhouse.
 * `live` defaults to a fresh dayStart(state). The base reserve is kept back unless `useReserve`.
 */
export function build(state: MoonState, kind: BuildKind, slotStats?: SlotStats | null, live: DayLive = dayStart(state), opts: { useReserve?: boolean } = {}): BuildResult {
  const cost = buildCost(kind).value;
  if (state.outcome !== null) return { ok: false, reason: 'missionOver', cost };
  if (builtCount(state, kind) >= buildLimit(kind)) return { ok: false, reason: 'limit', cost };
  if (kind !== 'battery' && !slotStats) return { ok: false, reason: 'noSlot', cost };
  if (!canAfford(live, cost, opts)) return { ok: false, reason: 'energy', cost };
  const s = state.setup;
  const setup =
    kind === 'tower'
      ? { ...s, towers: [...s.towers, slotStats as SlotStats], towerFromDay: [...(s.towerFromDay ?? s.towers.map(() => 0)), state.cursor + 1] }
      : kind === 'battery'
        ? { ...s, batteryUnits: (s.batteryUnits ?? 0) + 1 }
        : { ...s, greenhouse: slotStats as SlotStats };
  return { ok: true, state: { ...state, setup }, live: spend(live, cost, 'build'), cost };
}

// ---------------------------------------------------------------- ending the day

/** How the day's particle alert went for the commander. */
export type AlarmOutcome = 'none' | 'safe' | 'late' | 'outside';

export interface DayActions {
  /** Berm levels built today at base (default 0). */
  shieldLevels?: number;
  /** The commander reached an ice spot or a permanently shadowed cell today. */
  iceCollected?: boolean;
  greenhouseOn?: boolean;
  /** The child explicitly chose not to run the base (life support -3 extra). Default false. */
  skipBase?: boolean;
  /** Energy spent walking (1 per started km outward). */
  exploreEnergy?: number;
  exploreScience?: number;
  exploreWalkedM?: number;
  exploreFound?: string[];
  /** Energy spent on buildings today (DayLive.spentBy.build). */
  buildEnergy?: number;
  /** safe = at base / back in time; late = back after the time limit (half exposure); outside = stayed out (full). none = no alert happened. */
  alarm?: AlarmOutcome;
}

/** Which exposure the day gives. Exported so the UI can preview the dose. */
export function exposureFor(day: MoonDay, alarm: AlarmOutcome, walkedM: number): NonNullable<MoonPlan['exposure']> {
  const wasOut = walkedM > 0;
  if (day.alertOngoing === true) return wasOut || alarm === 'late' || alarm === 'outside' ? 'full' : 'inside';
  if (alarm === 'outside') return 'full';
  if (alarm === 'late') return 'recalled';
  if (alarm === 'safe') return 'inside';
  // 'none': no alert came. A storm without an alert still reaches a commander who was outside.
  return wasOut && day.sparkleBand !== 'calm' ? 'full' : 'inside';
}

/** The MoonPlan an endDay call resolves (exported for tests and previews). */
export function planFromActions(state: MoonState, a: DayActions): MoonPlan {
  const day = state.days[state.cursor];
  if (!day) throw new RangeError('No day to play');
  const levels = Math.max(0, Math.floor(a.shieldLevels ?? 0));
  const walked = a.exploreWalkedM ?? 0;
  const plan: MoonPlan = {
    keepRunning: !a.skipBase,
    iceTrip: a.iceCollected === true,
    iceByVisit: a.iceCollected === true,
    greenhouse: a.greenhouseOn === true && state.setup.greenhouse !== null,
    shield: levels > 0,
    shieldLevels: levels,
    scienceWalk: null,
    recalledInTime: false,
    exposure: exposureFor(day, a.alarm ?? 'none', walked),
    exploreEnergy: Math.max(0, Math.floor(a.exploreEnergy ?? 0)),
    exploreScience: Math.max(0, Math.floor(a.exploreScience ?? 0)),
    exploreWalkedM: Math.max(0, walked),
    exploreFound: a.exploreFound ?? [],
    buildEnergy: Math.max(0, Math.floor(a.buildEnergy ?? 0)),
  };
  return plan;
}

/**
 * End the day: build the plan from what the child did and resolve it with the normal engine.
 * Returns the new state (same object under `state` and `nextState`) and the usual DayReport.
 * If the base could not be paid for, the base is skipped instead (and the report says so); if even that
 * cannot be afforded, a RangeError is thrown (the UI keeps the reserve so this should not happen).
 */
export function endDay(state: MoonState, actions: DayActions = {}): { state: MoonState; nextState: MoonState; report: DayReport } {
  let plan = planFromActions(state, actions);
  const trial = (p: MoonPlan) => {
    try {
      return resolveDay(state, p);
    } catch {
      return null;
    }
  };
  let r = trial(plan);
  if (!r && plan.keepRunning) {
    plan = { ...plan, keepRunning: false };
    r = trial(plan);
  }
  if (!r) return finalize(resolveDay(state, plan)); // throws the real reason
  return finalize(r);
}

function finalize(r: { nextState: MoonState; report: DayReport }) {
  return { state: r.nextState, nextState: r.nextState, report: r.report };
}

// ---------------------------------------------------------------- missions

export type WorldMissionId = 'walkToFlag' | 'buildTower' | 'findIce' | 'endDay' | 'shieldUp' | 'buildBattery' | 'saveEnergy' | `explore:${string}`;

export interface WorldMission {
  id: WorldMissionId;
  titleTr: string;
  titleEn: string;
  whyTr: string;
  whyEn: string;
  target?: { kind: 'poi' | 'psr' | 'berm' | 'battery' | 'tower' | 'base'; value?: number };
}

const M: Record<'walkToFlag' | 'buildTower' | 'findIce' | 'endDay' | 'shieldUp' | 'buildBattery' | 'saveEnergy', WorldMission> = {
  walkToFlag: {
    id: 'walkToFlag',
    titleTr: 'Bayrağa yürü',
    titleEn: 'Walk to the flag',
    whyTr: 'Yürümek enerji harcar; kaşifler yeni yerleri böyle bulur.',
    whyEn: 'Walking uses energy, and that is how explorers find new places.',
    target: { kind: 'poi' },
  },
  buildTower: {
    id: 'buildTower',
    titleTr: 'Güneş kulesi kur',
    titleEn: 'Build a solar tower',
    whyTr: 'Kule güneşten enerji yapar; yarın çalışmaya başlar.',
    whyEn: 'A tower makes energy from sunlight, starting tomorrow.',
    target: { kind: 'tower' },
  },
  findIce: {
    id: 'findIce',
    titleTr: 'Buz bul',
    titleEn: 'Find ice',
    whyTr: 'Gölgeli kraterlerde buz var; buz su ve hava olur.',
    whyEn: 'Shadowed craters hide ice, and ice becomes water and air.',
    target: { kind: 'psr' },
  },
  endDay: {
    id: 'endDay',
    titleTr: 'Üsse dön, günü bitir',
    titleEn: 'Go home, end the day',
    whyTr: 'Gece üssün çalışması için enerji lazım.',
    whyEn: 'The base needs energy to keep running through the night.',
    target: { kind: 'base' },
  },
  shieldUp: {
    id: 'shieldUp',
    titleTr: 'Fırtınadan önce kalkan kur',
    titleEn: 'Build a shield first',
    whyTr: 'Gerçek verilere göre fırtına geliyor. Kalkan bizi korur.',
    whyEn: 'Real data shows a storm is coming. A shield keeps us safe.',
    target: { kind: 'berm' },
  },
  buildBattery: {
    id: 'buildBattery',
    titleTr: 'Pil ünitesi kur',
    titleEn: 'Build a battery unit',
    whyTr: 'Karanlık günler geliyor; pil güneşi saklar.',
    whyEn: 'Dark days are coming, and a battery saves sunshine for them.',
    target: { kind: 'battery' },
  },
  saveEnergy: {
    id: 'saveEnergy',
    titleTr: 'Enerjiyi biriktir',
    titleEn: 'Save your energy',
    whyTr: 'Karanlık günler geliyor; pilin dolu kalsın.',
    whyEn: 'Dark days are coming, so keep the battery full.',
  },
};

/** First day: ordered mission ids. */
export const firstDayMissions = ['walkToFlag', 'buildTower', 'findIce', 'endDay'] as const;

/** Text of a first-day / rule-based mission by id. */
export function worldMission(id: keyof typeof M): WorldMission {
  return M[id];
}

const EXPLORE_TEXT: Record<string, [string, string, string, string]> = {
  visitIce: ['Gölgeli krateri gez', 'Visit a shadow crater', 'Gölgeli yerler buz saklar.', 'Shadowed places hide ice.'],
  findSun: ['Güneşli tepeyi bul', 'Find a sunny peak', 'Güneşli yerler kule için iyidir.', 'Sunny places are good for towers.'],
  lookEarth: ['Dünya’yı ufukta gör', 'See Earth on the horizon', 'Dünya hep aynı yerde asılı durur.', 'Earth hangs in nearly the same spot in the sky.'],
  geology: ['İlginç bir yer bul', 'Find an interesting place', 'Taşlar Ay’ın geçmişini anlatır.', 'Rocks tell the story of the Moon’s past.'],
  walk1km: ['1 kilometre yürü', 'Walk 1 kilometre', 'Uzağa gitmek daha çok enerji ister.', 'Going farther costs more energy.'],
  walk2km: ['2 kilometre yürü', 'Walk 2 kilometres', 'Uzağa gitmek daha çok enerji ister.', 'Going farther costs more energy.'],
  discover2: ['Bugün 2 yer keşfet', 'Discover 2 places today', 'Her keşif bilim puanı getirir.', 'Every discovery earns science points.'],
};

const exploreMission = (dayIndex: number): WorldMission => {
  const id = dailyMissions(dayIndex)[0].id;
  const t = EXPLORE_TEXT[id] ?? EXPLORE_TEXT.discover2!;
  return { id: `explore:${id}`, titleTr: t[0], titleEn: t[1], whyTr: t[2], whyEn: t[3] };
};

const isStormy = (d: MoonDay | undefined): boolean => !!d && (d.sparkleBand !== 'calm' || d.alertOngoing === true);

/** Average sunlit % of what makes energy on day d (the working towers, else the habitat spot). */
function lightOn(state: MoonState, d: number): number {
  const live = state.setup.towers.filter((_, i) => (state.setup.towerFromDay?.[i] ?? 0) <= d);
  if (live.length === 0) return litPct(state.setup.habitat, d);
  return live.reduce((a, t) => a + litPct(t, d), 0) / live.length;
}

/**
 * The goals for day `dayIndex` (0-based; usually state.cursor). Day 0: the four first-day missions in order.
 * Later: 1-2 goals from REAL data (storm / ongoing alert coming, dark days coming, low life support),
 * else one exploring mission.
 */
export function missionForDay(state: MoonState, dayIndex: number): WorldMission[] {
  if (dayIndex <= 0) return firstDayMissions.map((id) => M[id]);
  const out: WorldMission[] = [];
  const today = state.days[dayIndex];
  const tomorrow = state.days[dayIndex + 1];
  if ((isStormy(tomorrow) || (today?.alarmAt != null && isStormy(today))) && state.berm < R.actions.bermMax.value) {
    out.push({ ...M.shieldUp, target: { kind: 'berm', value: state.berm + 1 } });
  }
  const dark = Array.from({ length: R.world.darkLookAheadDays.value }, (_, i) => dayIndex + 1 + i)
    .filter((d) => d < state.days.length)
    .some((d) => lightOn(state, d) < R.world.darkLitPct.value);
  const cap = batteryCap(state.setup);
  if (dark && state.battery < cap) {
    const lowBattery = state.battery <= cap / 2;
    if (lowBattery && (state.setup.batteryUnits ?? 0) < R.world.maxBatteryUnits.value) out.push(M.buildBattery);
    else out.push(M.saveEnergy);
  }
  if (state.life <= R.world.lowLifeLevel.value) out.push(M.findIce);
  return out.length > 0 ? out.slice(0, 2) : [exploreMission(dayIndex)];
}
