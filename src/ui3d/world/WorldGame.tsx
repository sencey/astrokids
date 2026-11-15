import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import {
  MOON_RULES as R,
  batteryCap,
  build,
  buildCost,
  buildLimit,
  builtCount,
  canAfford,
  dayStart,
  endDay,
  greenhouseOnCost,
  liveDayFromToday,
  liveLeft,
  liveSpendable,
  loadMoonDays,
  shieldBuildCost,
  spend,
  startWorldMission,
  summarize,
} from '../../game/moon';
import type { BuildKind as EngineBuild, DayLive, DayReport, MoonState, WorldMission } from '../../game/moon';
import { dailyMissions } from '../../game/explore/explore';
import { loadProgress } from '../../game/explore/explore';
import { derivePois } from '../../game/explore/pois';
import { idleAnim } from '../../three/Actors';
import type { DayAnim } from '../../three/Actors';
import type { CamApi } from '../../three/CameraRig';
import { CONFIG } from '../../three/config';
import type { CelebrateKind, ExploreEvent } from '../../three/exploreTypes';
import { assetUrl } from '../../three/data/terrain';
import { liveStatus } from '../../three/live/latest';
import type { LatestJson, LiveStatus } from '../../three/live/latest';
import { makeFrame } from '../../three/math';
import type { TimeState } from '../../three/Sky';
import { computeToday } from '../../three/live/today';
import type { TodayData } from '../../three/live/today';
import { buildWorldSlots, landerSlot as pickLander, makeStatsGetter, nearestPSRPoint, rimPoint } from '../../three/slots';
import type { PlacedBuilding, Slot, SlotStats } from '../../three/types';
import { BuildingIcon, BoltIcon, BookIcon, CheckIcon, CloseIcon, CompassIcon, FlagIcon, GearIcon, HomeIcon, LeftIcon, MinusIcon, PlayIcon, PlusIcon, RadIcon, RightIcon, ShieldIcon, StarIcon, SunIcon, TankIcon, BellIcon } from '../icons';
import { Gauges } from '../mission/Gauges';
import { AlbumPanel, DiscoveryCard } from '../mission/Explore';
import { BuildingCard } from '../mission/Building';
import { missionStats, rawDatasets, savedProgress } from '../mission/exploreData';
import type { BadgeId, Poi } from '../mission/exploreData';
import { EndScreen, LiveEnd, Notebook, SourcesPanel } from '../mission/Panels';
import type { LiveInfo } from '../mission/Panels';
import { factText, mt, POI_TR } from '../mission/text';
import type { MKey } from '../mission/text';
import { installLayoutCheck } from '../pati/layoutCheck';
import { patiMood } from '../pati/mood';
import { PatiAvatar, PatiPose } from '../pati/PatiAvatar';
import { tx } from '../text';
import type { GameProps } from '../Game';
import { alarmDue, arrivalOutcome, currentGoal, dayGoals, pickPrimary, toEngineAlarm } from './logic';
import type { AlarmPhase, WorldBuild } from './logic';
import TitleScreen from './TitleScreen';
import '../../styles/suit.css';
import '../ui3d.css';
import '../mission/mission.css';
import '../mission/explore.css';
import './world.css';

const MoonScene = lazy(() => import('../../three/MoonScene'));
const IntroGlobe = lazy(() => import('../../three/Intro'));

const QA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('qa');
const ENGINE_KIND: Record<WorldBuild, EngineBuild> = { solarTower: 'tower', batteryUnit: 'battery', greenhouse: 'greenhouse' };
const BUILD_LABEL: Record<WorldBuild, MKey> = { solarTower: 'btnBuildTower', batteryUnit: 'btnBuildBattery', greenhouse: 'btnBuildGreenhouse' };
const BUILD_LINE: Record<WorldBuild, MKey> = { solarTower: 'wBuilt', batteryUnit: 'wBuiltBattery', greenhouse: 'wBuiltGreenhouse' };
type Stage = 'play' | 'report' | 'end';

export default function WorldGame({ data, lang, setLang, onPlace, apiRef, skipIntro, reduceMotion }: GameProps) {
  const frame = useMemo(() => makeFrame(data, CONFIG.verticalExaggeration), [data]);
  const slots = useMemo(() => buildWorldSlots(data), [data]);
  const getStats = useMemo(() => makeStatsGetter(data, slots), [data, slots]);
  // ~3,000 fine slots: stats are lazy and memoized, so only a short list of candidates is ever evaluated
  const lander = useMemo(() => {
    const flat = slots.filter((s) => s.buildable).sort((a, b) => a.slopeDeg * 40 + Math.hypot(a.x, a.z) * 0.02 - (b.slopeDeg * 40 + Math.hypot(b.x, b.z) * 0.02)).slice(0, 60);
    return pickLander(flat.length ? flat : slots, (s) => (s.buildable ? getStats(s).illumPct : -1));
  }, [slots, getStats]);
  const moonDays = useMemo(() => loadMoonDays(), []);
  const slotEdge = slots[0].cells * frame.cell;

  const timeRef = useRef<TimeState>({ day: 0, hour: 12 });
  const camApi = useRef<CamApi | null>(null);
  const dayAnim = useRef<DayAnim>(idleAnim());

  // ---- the habitat: the best slot next to the lander
  const rankSlots = useCallback(
    (kind: 'habitat' | 'solarTower', taken: Set<number>, radiusM = 1700) =>
      slots
        .filter((s) => s.buildable && !taken.has(s.index) && Math.hypot(s.x - lander.x, s.z - lander.z) <= radiusM)
        .map((s) => {
          const st = getStats(s);
          const meanLit = st.litPctByDay.reduce((a, b) => a + b, 0) / Math.max(1, st.litPctByDay.length);
          const score = kind === 'habitat' ? meanLit - (Number.isFinite(st.distanceToNearestPSRm) ? st.distanceToNearestPSRm / 100 : 99) : meanLit;
          return { index: s.index, illumPct: st.illumPct, meanLitPct: meanLit, distanceToNearestPSRm: st.distanceToNearestPSRm, slopeDeg: s.slopeDeg, score };
        })
        .sort((a, b) => b.score - a.score),
    [slots, getStats, lander],
  );
  const habitat = useMemo<Slot>(() => {
    const ranked = rankSlots('habitat', new Set([lander.index]), slotEdge * 2.4);
    return slots[ranked[0]?.index ?? lander.index];
  }, [rankSlots, lander, slots, slotEdge]);

  // ---- live ("Today's Moon") data
  const [latest, setLatest] = useState<LatestJson | null>(null);
  const [liveSt, setLiveSt] = useState<LiveStatus>({ state: 'offline', fetchedAt: null, reason: 'loading' });
  const [today, setToday] = useState<TodayData | null>(null);
  const todayRef = useRef<TodayData | null>(null);
  const [modeBusy, setModeBusy] = useState(false);
  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const r = await fetch(assetUrl('data/latest.json'));
        if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) return;
        const j = (await r.json()) as LatestJson;
        if (!off) {
          setLatest(j);
          setLiveSt(liveStatus(j, Date.now()));
        }
      } catch {
        /* offline */
      }
    })();
    return () => {
      off = true;
    };
  }, []);
  const statsOf = useCallback(
    (idx: number): SlotStats => {
      const t = todayRef.current;
      return t ? { ...getStats(idx), litPctByDay: [t.litBySlot.get(idx) ?? 0] } : getStats(idx);
    },
    [getStats],
  );

  // ---- mission state (mirrored in refs so scene events never see stale values)
  const [mission, setMissionState] = useState<MoonState>(() => startWorldMission({ habitat: getStats(habitat.index), days: moonDays }));
  const missionRef = useRef(mission);
  const setMission = useCallback((m: MoonState) => {
    missionRef.current = m;
    setMissionState(m);
  }, []);
  const [live, setLiveState] = useState<DayLive>(() => dayStart(mission));
  const liveRef = useRef(live);
  const setLive = useCallback((l: DayLive) => {
    liveRef.current = l;
    setLiveState(l);
  }, []);
  const [extra, setExtra] = useState<PlacedBuilding[]>([]);
  const [stage, setStageState] = useState<Stage>('play');
  const stageRef = useRef<Stage>('play');
  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  };
  const [report, setReport] = useState<DayReport | null>(null);
  const [liveMode, setLiveMode] = useState(false);

  // ---- the day
  const [goals, setGoals] = useState<WorldMission[]>(() => dayGoals(mission, 0));
  const [done, setDoneState] = useState<ReadonlySet<string>>(new Set());
  const doneRef = useRef<ReadonlySet<string>>(done);
  const [bonus, setBonus] = useState(0);
  const [flash, setFlash] = useState(0);
  const iceRef = useRef(false);
  const [greenOn, setGreenOn] = useState(false);
  const [shieldLevels, setShieldLevels] = useState(0);
  const [buildMode, setBuildMode] = useState<WorldBuild | null>(null);
  const [alarm, setAlarmState] = useState<AlarmPhase>('none');
  const alarmRef = useRef<AlarmPhase>('none');
  const setAlarm = (a: AlarmPhase) => {
    alarmRef.current = a;
    setAlarmState(a);
  };
  const alarmAtRef = useRef(0);
  const playSecRef = useRef(0);
  const walkBudgetRef = useRef(0);
  const [nearBase, setNearBaseState] = useState(true);
  const nearRef = useRef(true);
  const walkedRef = useRef(0);
  const foundRef = useRef<string[]>([]);
  const [exploreScience, setExploreScience] = useState(0);
  const sciRef = useRef(0);
  const lowWarned = useRef(false);

  // ---- ui
  const [pois, setPois] = useState<Poi[]>([]);
  const poisRef = useRef<Poi[]>([]);
  poisRef.current = pois;
  const [line, setLine] = useState<string | null>(null);
  const lineTimer = useRef(0);
  const [card, setCard] = useState<Poi | null>(null);
  const [patiTalking, setPatiTalking] = useState(false);
  const talkTok = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [album, setAlbum] = useState<{ found: Set<string>; earned: Set<BadgeId> } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [bInfo, setBInfo] = useState<{ id: string; slotIndex: number } | null>(null);
  const onBuildingTap = useCallback((b: { id: string; slotIndex: number }) => setBInfo(b), []);
  const closeBInfo = useCallback(() => setBInfo(null), []);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const t = window.setTimeout(() => {
      const list = derivePois(data, { x: lander.x, z: lander.z });
      for (const p of list) POI_TR.set(p.nameEn, p.nameTr);
      setPois(list);
    }, 400);
    return () => window.clearTimeout(t);
  }, [data, lander]);

  // ---- intro
  const noIntro = QA || skipIntro || new URLSearchParams(window.location.search).has('nointro');
  const [phase, setPhase] = useState<'gate' | 'run' | 'done'>(noIntro ? 'done' : 'gate');
  const [skip, setSkip] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const placed = useMemo<PlacedBuilding[]>(() => [{ id: 'lander', slotIndex: lander.index }, { id: 'habitat', slotIndex: habitat.index }, ...extra], [lander, habitat, extra]);
  const towerSlots = useMemo(() => extra.filter((e) => e.id === 'solarTower').map((e) => slots[e.slotIndex]), [extra, slots]);
  const icePoint = useMemo(() => nearestPSRPoint(data, habitat), [data, habitat]);
  const rim = useMemo(() => rimPoint(data, habitat), [data, habitat]);
  const litOf = useCallback((i: number) => (todayRef.current ? todayRef.current.litBySlot.get(i) ?? 0 : getStats(i).litPctByDay[Math.min(Math.floor(timeRef.current.day), getStats(i).litPctByDay.length - 1)] ?? 0), [getStats]);
  const liveSky = useMemo(() => (liveMode && today ? { sun: [today.sun], earth: [today.earth] } : undefined), [liveMode, today]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { slots, getSlotStats: getStats, currentDayIndex: () => Math.floor(timeRef.current.day), currentHour: () => timeRef.current.hour };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, slots, getStats]);

  // ---- speech / lines
  const lastSpoken = useRef<{ key: string; text: string } | null>(null);
  const say = useCallback((key: string, text: string, ms = 6000) => {
    lastSpoken.current = { key, text };
    setLine(text);
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), ms);
    if (!QA) void engine.say(key, text, langRef.current);
  }, []);
  const sayM = useCallback((k: MKey, ms?: number) => say(`moon3d.${k}`, mt(k, langRef.current), ms), [say]);
  useEffect(() => () => window.clearTimeout(lineTimer.current), []);

  const celebrate = useCallback((k: CelebrateKind) => camApi.current?.celebrate(k), []);
  const sfx = (n: Parameters<typeof engine.sfx>[0]) => {
    if (!QA) engine.sfx(n);
  };

  // ---- goals
  const setDone = (s: ReadonlySet<string>) => {
    doneRef.current = s;
    setDoneState(s);
  };
  const complete = useCallback(
    (id: string) => {
      if (doneRef.current.has(id)) return;
      setDone(new Set(doneRef.current).add(id));
      setBonus((b) => b + 1);
      setFlash((f) => f + 1);
      sfx('chime');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const checkExplore = useCallback(() => {
    const st = missionRef.current;
    const m = dailyMissions(st.cursor)[0];
    if (m && !doneRef.current.has(`explore:${m.id}`)) {
      if (m.done(missionStats(poisRef.current, foundRef.current, walkedRef.current))) complete(`explore:${m.id}`);
    }
  }, [complete]);

  const goal = currentGoal(goals, done);
  const day = mission.days[Math.min(mission.cursor, mission.days.length - 1)];
  const hasAlarm = !!day.alarmAt && !day.alertOngoing;

  /** a new day: fresh energy, fresh goals, fresh counters. The commander stays where he is. */
  const beginDay = useCallback(
    (st: MoonState) => {
      const l = dayStart(st);
      setLive(l);
      walkBudgetRef.current = liveSpendable(l);
      playSecRef.current = 0;
      lowWarned.current = false;
      setGoals(dayGoals(st, st.cursor));
      setDone(new Set());
      iceRef.current = false;
      setGreenOn(false);
      setShieldLevels(0);
      setBuildMode(null);
      setAlarm('none');
      walkedRef.current = 0;
      foundRef.current = [];
      sciRef.current = 0;
      setExploreScience(0);
      setCard(null);
      setReport(null);
      setStage('play');
      timeRef.current = { day: Math.min(st.cursor, data.dayCount - 1), hour: 12 };
      const d = st.days[Math.min(st.cursor, st.days.length - 1)];
      if (d.alertOngoing) sayM('wAlertMorning');
      else if (d.sparkleBand !== 'calm') sayM('wStormMorning');
      else if (st.cursor > 0) sayM('wMorning');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.dayCount],
  );
  useEffect(() => {
    timeRef.current = { day: 0, hour: 12 };
  }, []);

  // ---- alarm
  const resolveArrival = useCallback(() => {
    if (alarmRef.current !== 'active') return;
    const r = arrivalOutcome(performance.now() - alarmAtRef.current);
    setAlarm(r);
    sayM(r === 'safe' ? 'wSafe' : 'wLate');
    sfx('ding');
  }, [sayM]);
  const fireAlarm = useCallback(() => {
    if (nearRef.current) {
      setAlarm('safe');
      sayM('wSafeInside');
    } else {
      alarmAtRef.current = performance.now();
      setAlarm('active');
      sayM('wStorm', 9000);
      sfx('bark');
    }
  }, [sayM]);
  const blocked = menuOpen || !!album || sourcesOpen || notebookOpen || phase !== 'done';
  useEffect(() => {
    if (stage !== 'play' || blocked) return;
    const id = window.setInterval(() => {
      playSecRef.current += 0.5;
      if (alarmDue({ hasAlarm, fired: alarmRef.current !== 'none', walkSpent: liveRef.current.spentBy.walk, walkBudget: walkBudgetRef.current, playSeconds: playSecRef.current })) fireAlarm();
    }, 500);
    return () => window.clearInterval(id);
  }, [stage, blocked, hasAlarm, fireAlarm]);

  // ---- scene events
  const onNearBase = useCallback(
    (near: boolean) => {
      nearRef.current = near;
      setNearBaseState(near);
      if (near) resolveArrival();
    },
    [resolveArrival],
  );
  const evRef = useRef<(e: ExploreEvent) => void>(() => undefined);
  evRef.current = (e) => {
    if (Number.isFinite(e.walkedM) && e.walkedM > walkedRef.current) {
      walkedRef.current = e.walkedM;
    }
    if (e.type === 'spend') {
      const l = spend(liveRef.current, e.energy ?? 1, 'walk');
      setLive(l);
      const left = liveSpendable(l);
      if (left <= 1 && left > 0 && !lowWarned.current) {
        lowWarned.current = true;
        sayM('wLowEnergy');
      }
      checkExplore();
    } else if (e.type === 'noEnergy') {
      sayM('wNoEnergy');
    } else if (e.type === 'ice') {
      if (!iceRef.current) {
        iceRef.current = true;
        celebrate('ice');
        sayM('wIce');
        complete('findIce');
      }
    } else if (e.type === 'discover' && e.poiId) {
      const poi = poisRef.current.find((p) => p.id === e.poiId);
      if (!foundRef.current.includes(e.poiId)) {
        foundRef.current = [...foundRef.current, e.poiId];
        if (poi) {
          sciRef.current += poi.science;
          setExploreScience(sciRef.current);
        }
      }
      celebrate('discover');
      complete('walkToFlag');
      checkExplore();
      if (poi) {
        setCard(poi);
        const tok = ++talkTok.current;
        setPatiTalking(true);
        const stop = () => talkTok.current === tok && setPatiTalking(false);
        if (QA) window.setTimeout(stop, 1200);
        else void engine.say(`moon3d.poi.${poi.id}`, langRef.current === 'tr' ? poi.factTr : poi.factEn, langRef.current).then(stop, stop);
      }
    } else if (e.type === 'home') {
      resolveArrival();
    }
  };
  const onExploreEvent = useCallback((e: ExploreEvent) => evRef.current(e), []);
  const closeCard = useCallback(() => {
    setCard(null);
    talkTok.current++;
    engine.stopVoice();
    setPatiTalking(false);
  }, []);

  // ---- building in the world
  const canBuild = (k: WorldBuild): boolean => {
    const ek = ENGINE_KIND[k];
    return builtCount(mission, ek) < buildLimit(ek) && canAfford(live, buildCost(ek).value);
  };
  const startBuild = (k: WorldBuild) => {
    if (!canBuild(k)) {
      sayM('needEnergy');
      return;
    }
    sfx('pop');
    setBuildMode(k);
    sayM('wBuildPrompt', 8000);
  };
  const onBuiltRef = useRef<(b: { kind: WorldBuild; slotIndex: number }) => void>(() => undefined);
  onBuiltRef.current = ({ kind, slotIndex }) => {
    setBuildMode(null);
    const st = missionRef.current;
    const r = build(st, ENGINE_KIND[kind], statsOf(slotIndex), liveRef.current);
    if (!r.ok) {
      sayM('needEnergy');
      return;
    }
    setMission(r.state);
    setLive(r.live);
    setExtra((e) => [...e, { id: kind, slotIndex }]);
    onPlace?.(kind, slots[slotIndex]);
    sfx('thud');
    celebrate('build');
    sayM(BUILD_LINE[kind]);
    if (kind === 'solarTower') complete('buildTower');
    if (kind === 'batteryUnit') complete('buildBattery');
  };
  const onBuilt = useCallback((b: { kind: WorldBuild; slotIndex: number }) => onBuiltRef.current(b), []);
  const onCelebrate = useCallback(() => sfx('chime'), []);

  const berm = mission.berm + shieldLevels;
  const shieldCost = shieldBuildCost();
  const shieldOk = nearBase && berm < R.actions.bermMax.value && canAfford(live, shieldCost);
  const shieldNow = () => {
    if (!shieldOk) {
      sayM('needEnergy');
      return;
    }
    setLive(spend(live, shieldCost, 'shield'));
    setShieldLevels((n) => n + 1);
    sfx('thud');
    celebrate('build');
    sayM('wShieldBuilt');
    complete('shieldUp');
  };
  const greenCost = greenhouseOnCost(mission);
  const greenOk = nearBase && !!mission.setup.greenhouse && !greenOn && canAfford(live, greenCost);
  const greenNow = () => {
    if (!greenOk) return;
    setLive(spend(live, greenCost, 'greenhouse'));
    setGreenOn(true);
    sayM('wGreenOn');
  };

  // ---- ending the day
  const finishDay = () => {
    const st = missionRef.current;
    let r: { nextState: MoonState; report: DayReport };
    try {
      r = endDay(st, {
        shieldLevels,
        iceCollected: iceRef.current,
        greenhouseOn: greenOn,
        exploreEnergy: liveRef.current.spentBy.walk,
        exploreScience: sciRef.current,
        exploreWalkedM: Math.round(walkedRef.current),
        exploreFound: foundRef.current.map((id) => poisRef.current.find((p) => p.id === id)?.nameEn ?? id),
        buildEnergy: liveRef.current.spentBy.build,
        alarm: toEngineAlarm(alarmRef.current),
      });
    } catch {
      sayM('needEnergy');
      return;
    }
    complete('endDay');
    setMission(r.nextState);
    setReport(r.report);
    setBuildMode(null);
    setAlarm('none');
    setStage('report');
    celebrate('day');
    sfx('chime');
  };
  const afterReport = () => {
    const st = missionRef.current;
    if (st.outcome !== null) {
      setStage('end');
      return;
    }
    beginDay(st);
  };
  const goHome = () => {
    camApi.current?.goHome();
  };

  /** Back to the very start (a fresh archive mission). */
  const again = useCallback(() => {
    todayRef.current = null;
    setToday(null);
    setLiveMode(false);
    setExtra([]);
    setBonus(0);
    const st = startWorldMission({ habitat: getStats(habitat.index), days: moonDays });
    setMission(st);
    beginDay(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getStats, habitat, moonDays]);

  /** TODAY'S MOON: one real day at the same base, with today's real Sun. */
  const startLive = async () => {
    if (modeBusy) return;
    setModeBusy(true);
    try {
      // horizon test only for the pads the scene can show (within ~1.7 km of the base), never for all slots
      const cand = slots.filter((s) => s.buildable && s.index !== lander.index && s.index !== habitat.index && Math.hypot(s.x - lander.x, s.z - lander.z) <= 1700);
      const now = new Date();
      const t = await computeToday(data, [habitat, lander, ...cand], now);
      todayRef.current = t;
      setToday(t);
      setLiveMode(true);
      setExtra([]);
      const lit = t.litBySlot.get(habitat.index) ?? 0;
      const liveDay = liveDayFromToday(latest ?? { generatedAt: now.toISOString(), sep: [] }, { at: now.toISOString(), litPct: lit });
      const st = startWorldMission({ habitat: { ...getStats(habitat.index), litPctByDay: [lit] }, days: [liveDay] });
      setMission(st);
      beginDay(st);
      setMenuOpen(false);
    } finally {
      setModeBusy(false);
    }
  };

  // ---- derived UI
  const cap = batteryCap(mission.setup);
  const spendable = liveSpendable(live);
  const lowEnergy = spendable <= 1;
  const goalId = goal.id;
  const prim = stage === 'play' ? pickPrimary({
    goal: goalId,
    nearBase,
    alarm,
    buildMode,
    alertOngoing: !!day.alertOngoing,
    away: !nearBase,
    lowEnergy,
    canAffordBuild: goalId === 'buildBattery' ? canBuild('batteryUnit') : canBuild('solarTower'),
    canAffordShield: canAfford(live, shieldCost) && berm < R.actions.bermMax.value,
  }) : { kind: 'none' as const };

  const primLabel: Record<string, MKey> = { cancelBuild: 'btnCancel', shield: 'btnShield', home: 'btnHome', homeDanger: 'btnHomeDanger', runHome: 'btnRunHome', endDay: 'btnEndDay' };
  const onPrimary = () => {
    if (prim.disabled) return;
    switch (prim.kind) {
      case 'build':
        if (prim.build) startBuild(prim.build);
        break;
      case 'cancelBuild':
        setBuildMode(null);
        break;
      case 'shield':
        shieldNow();
        break;
      case 'home':
      case 'homeDanger':
      case 'runHome':
        goHome();
        break;
      case 'endDay':
        finishDay();
        break;
    }
  };

  const showMore = stage === 'play' && nearBase && !buildMode && alarm !== 'active' && (mission.cursor > 0 || done.has('buildTower'));
  const moreKinds = (['solarTower', 'batteryUnit', 'greenhouse'] as const).filter((k) => !(prim.kind === 'build' && prim.build === k) && builtCount(mission, ENGINE_KIND[k]) < buildLimit(ENGINE_KIND[k]));
  const showEndSecondary = stage === 'play' && nearBase && !buildMode && alarm !== 'active' && prim.kind !== 'endDay' && !!goals.length && mission.cursor >= 0 && done.size > 0;
  const showGreen = stage === 'play' && nearBase && !buildMode && !!mission.setup.greenhouse && !greenOn;

  const mood = patiMood({
    alarm: alarm === 'active',
    storm: day.sparkleBand === 'storm' || day.sparkleBand === 'super',
    alertOngoing: !!day.alertOngoing,
    shieldDay: shieldLevels > 0,
    lifeLow: mission.life <= R.life.resupplyLevel.value,
    tip: !!line || card !== null,
    live: liveMode,
  });
  const gl = lang === 'tr' ? { t: goal.titleTr, w: goal.whyTr } : { t: goal.titleEn, w: goal.whyEn };
  // spoken goal: once per new goal, queued behind alarm lines, discovery facts and other lines
  const spokenGoal = useRef('');
  useEffect(() => {
    if (phase !== 'done' || stage !== 'play' || blocked) return;
    if (spokenGoal.current === goalId || alarm === 'active' || card || line || patiTalking) return;
    spokenGoal.current = goalId;
    const key = `moon3d.goal.${goalId.replace(/:/g, '-')}`;
    const text = `${gl.t}. ${gl.w}`;
    lastSpoken.current = { key, text };
    if (!QA) void engine.say(key, text, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stage, blocked, goalId, alarm, card, line, patiTalking]);
  const hint = alarm === 'active' ? null : prim.reason ? mt(prim.reason, lang) : null;
  const liveInfo: LiveInfo | undefined = liveMode ? { latest, status: liveSt, today } : undefined;
  const bStat = useMemo(() => [] as never[], []);

  useEffect(() => (import.meta.env.DEV ? installLayoutCheck() : undefined), []);
  useEffect(() => setBInfo(null), [stage]);

  const openAlbum = () => {
    const s = savedProgress(pois, frame.extent, { x: lander.x, z: lander.z });
    setAlbum({ found: new Set(s.discovered), earned: new Set(s.badges) });
    setMenuOpen(false);
  };

  // ---- DEV QA hook
  const qa = useRef<Record<string, unknown>>({});
  qa.current = {
    state: () => ({
      phase: stage,
      dayIndex: mission.cursor,
      battery: mission.battery,
      batteryCap: cap,
      life: mission.life,
      dose: mission.dose,
      science: mission.science,
      berm: mission.berm,
      placed: extra.map((e) => ({ id: e.id, slotIndex: e.slotIndex })),
    }),
    world: () => ({
      mission: { id: goal.id, goals: goals.map((g) => g.id), done: [...done] },
      live: { ...live, spendable },
      phase: stage,
      nearBase,
      alarm,
    }),
    slots: (kind: 'solarTower' | 'habitat' = 'solarTower') => rankSlots(kind, new Set(placed.map((p) => p.slotIndex))),
    build: (kind: WorldBuild, slotIndex: number) => {
      if (stage !== 'play') return { ok: false, reason: 'not playing' };
      const before = missionRef.current;
      onBuiltRef.current({ kind, slotIndex });
      return { ok: true, before: before.setup.towers.length };
    },
    endDay: () => (stage === 'play' ? finishDay() : undefined),
    nextDay: () => (stage === 'report' ? afterReport() : undefined),
    exploreEvent: (e: ExploreEvent) => onExploreEvent(e),
    nearBase: (b: boolean) => onNearBase(b),
    fireAlarm: () => fireAlarm(),
    lastReport: () => report,
    summary: () => summarize(missionRef.current),
    history: () => missionRef.current.reports,
    live: () => startLive(),
    liveInfo: () => ({ status: liveSt, mode: liveMode ? 'live' : 'archive', today: today ? { date: today.date, maxSunEl: today.maxSunEl } : null }),
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const sleep = () => new Promise<void>((r) => window.setTimeout(r, 80));
    const call = (k: string) => (...a: unknown[]) => (qa.current[k] as (...x: unknown[]) => unknown)(...a);
    const wrap = (k: string) => async (...a: unknown[]) => {
      const r = await call(k)(...a);
      await sleep();
      return r;
    };
    (window as unknown as { __moon: unknown }).__moon = {
      state: call('state'),
      world: call('world'),
      slots: call('slots'),
      lastReport: call('lastReport'),
      summary: call('summary'),
      history: call('history'),
      exploreEvent: call('exploreEvent'),
      nearBase: call('nearBase'),
      fireAlarm: call('fireAlarm'),
      liveInfo: call('liveInfo'),
      build: wrap('build'),
      endDay: wrap('endDay'),
      nextDay: wrap('nextDay'),
      live: wrap('live'),
    };
    return () => {
      delete (window as unknown as { __moon?: unknown }).__moon;
    };
  }, []);

  const walkEnergy = Math.max(0, Math.floor(spendable));
  const sciShown = mission.science + exploreScience + bonus;
  const stormHeader = alarm === 'active';
  const reportFact = report ? report.facts.find((f) => f.id === 'radiation') ?? report.facts[0] : undefined;
  const ratio = reportFact?.id === 'radiation' && typeof reportFact.values.ratio === 'number' ? reportFact.values.ratio : null;
  const factLine = !reportFact ? null : ratio === null ? factText(reportFact, lang) : (ratio >= 3 ? mt('wFactStorm', lang) : mt('wFactCalm', lang)).replace('{r}', ratio >= 3 ? String(Math.round(ratio)) : ratio.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

  // ---- edge chips: only what the current goal asks for; the scene keeps them clear of the HUD rects
  const [cmdPos, setCmdPos] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (stage !== 'play' || phase !== 'done') return;
    const id = window.setInterval(() => {
      const p = camApi.current?.getExploreState()?.pos;
      if (p) setCmdPos((c) => (c && Math.hypot(c[0] - p[0], c[1] - p[1]) < 30 ? c : [p[0], p[1]]));
    }, 1500);
    return () => window.clearInterval(id);
  }, [stage, phase]);
  const chipPoiIds = useMemo<string[]>(() => {
    if (!cmdPos || stage !== 'play') return [];
    const seen = new Set<string>([...loadProgress().discovered, ...foundRef.current]);
    const open = pois.filter((p) => p.kind !== 'base' && !seen.has(p.id));
    const near = (list: Poi[], n: number) => list.map((p) => ({ id: p.id, d: Math.hypot(p.x - cmdPos[0], p.z - cmdPos[1]) })).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.id);
    if (goalId === 'findIce') return near(open.filter((p) => p.kind === 'ice'), 1);
    if (goalId === 'walkToFlag' || goalId.startsWith('explore:')) return near(open, 2);
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmdPos, pois, goalId, stage, card]);
  const [rects, setRects] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [earth, setEarth] = useState<{ x: number; y: number; size: number } | null>(null);
  useEffect(() => {
    if (phase !== 'done') return;
    const measure = () => {
      const q = '.w-hud .m3d-pati, .w-hud .m3d-bubble, .w-hud .w-goal, .w-hud .m3d-gauges, .w-hud .m3d-tools, .w-hud .m3d-lang, .w-hud .w-act';
      const r = [...document.querySelectorAll(q)].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 2 && b.height > 2).map((b) => ({ x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }));
      setRects((c) => (JSON.stringify(c) === JSON.stringify(r) ? c : r));
      const g = document.querySelector('.w-hud .w-goal')?.getBoundingClientRect();
      const eb = g ? { x: Math.round(g.left + 24), y: Math.round(g.bottom + 8 + 24), size: 48 } : null;
      setEarth((c) => (JSON.stringify(c) === JSON.stringify(eb) ? c : eb));
    };
    const t = window.setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [phase, stage, goalId, line, lang, buildMode, alarm, card, nearBase, compassOpen, flash]);

  return (
    <div className="m3d" data-reduce={reduceMotion ? 'true' : 'false'}>
      <Suspense fallback={<div className="m3d-boot">{tx('loading', lang)}</div>}>
        <MoonScene
          data={data}
          frame={frame}
          timeRef={timeRef}
          overlays={{ sun: false, ice: false }}
          slots={slots}
          placed={placed}
          landerSlot={lander}
          showSlots={false}
          hover={null}
          selected={null}
          onHover={() => undefined}
          onTap={() => undefined}
          camApi={camApi}
          renderTag={() => null}
          fill
          sky={liveSky}
          baseLabel={tx('base', lang) + ' / ' + tx('base', lang === 'tr' ? 'en' : 'tr')}
          poleLabel={tx('pole', lang) + ' / ' + tx('pole', lang === 'tr' ? 'en' : 'tr')}
          mission={{ habitat, towers: towerSlots, berm, anim: dayAnim, litOf, ice: icePoint, rim }}
          chipPoiIds={chipPoiIds}
          chipAvoidRects={rects}
          earthBadge={earth}
          exploreMode
          exploreBudget={6}
          walkEnergy={walkEnergy}
          dayKey={mission.cursor}
          buildMode={buildMode}
          onBuilt={onBuilt}
          onNearBase={onNearBase}
          alarmActive={alarm === 'active'}
          onCelebrate={onCelebrate}
          onExploreEvent={onExploreEvent}
          patiTalking={patiTalking}
          onBuildingTap={onBuildingTap}
          lang={lang}
        />
      </Suspense>

      {phase === 'done' && (
        <div className="m3d-hud w-hud" data-stage={stage}>
          <div className="m3d-top">
            <div className="m3d-left">
              <PatiAvatar mood={mood} lang={lang} talking={patiTalking} onClick={() => {
                  const l = lastSpoken.current;
                  if (l && !QA) void engine.say(l.key, l.text, lang);
                }} />
              <div className="m3d-bubble" role="status">
                {line ? (
                  <p>{line}</p>
                ) : (
                  <>
                    <p className="w-goal-title">{gl.t}</p>
                    <p className="w-goal-why">{gl.w}</p>
                  </>
                )}
              </div>
            </div>
            {stage !== 'end' && (
              <div className="m3d-gauges">
                <Gauges lang={lang} battery={Math.max(0, Math.min(cap, Math.round(liveLeft(live))))} cap={cap} life={mission.life} dose={mission.dose} science={sciShown} />
              </div>
            )}
            <div className="m3d-lang" role="group" aria-label={tx('language', lang)}>
              <button className={lang === 'tr' ? 'on' : ''} onClick={() => setLang('tr')} aria-pressed={lang === 'tr'}>TR</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
            </div>
            {stage === 'play' && (
              <section key={flash} className={`w-goal${flash > 0 ? ' fresh' : ''}`} aria-label={mt('goalProgress', lang)}>
                <FlagIcon />
                <span className="w-dots" aria-hidden="true">
                  {goals.map((g) => (
                    <i key={g.id} className={done.has(g.id) ? 'on' : g.id === goalId ? 'cur' : ''} />
                  ))}
                </span>
              </section>
            )}
          </div>

          <div className="m3d-tools w-tools">
            <button className="rb" onClick={() => setMenuOpen(true)} aria-label={mt('menu', lang)} title={mt('menu', lang)}>
              <GearIcon />
            </button>
            <button className={`rb ${compassOpen ? 'on' : ''}`} onClick={() => setCompassOpen(!compassOpen)} aria-expanded={compassOpen} aria-label={tx('camera', lang)} title={tx('camera', lang)}>
              <CompassIcon />
            </button>
            {compassOpen && (
              <div className="cc-pop w-cam" role="group" aria-label={tx('camera', lang)}>
                <button className="rb" onClick={() => camApi.current?.rotate(0.35)} aria-label={mt('rotateL', lang)}><LeftIcon /></button>
                <button className="rb" onClick={() => camApi.current?.rotate(-0.35)} aria-label={mt('rotateR', lang)}><RightIcon /></button>
                <button className="rb" onClick={() => camApi.current?.zoom(0.7)} aria-label={tx('zoomIn', lang)}><PlusIcon /></button>
                <button className="rb" onClick={() => camApi.current?.zoom(1.4)} aria-label={tx('zoomOut', lang)}><MinusIcon /></button>
              </div>
            )}
          </div>

          {stage === 'play' && !card && (
            <div className="w-act">
              {stormHeader && (
                <div className="w-alarm" role="alert">
                  <BellIcon />
                  <b>{mt('stormBanner', lang)}</b>
                  <span className="w-timer"><i key={alarmAtRef.current} /></span>
                </div>
              )}
              {(showMore || showEndSecondary || showGreen) && (
                <div className="w-sec">
                  {showMore && moreKinds.map((k) => (
                    <button key={k} className="btn secondary compact w-more" disabled={!canBuild(k)} onClick={() => startBuild(k)} aria-label={mt(BUILD_LABEL[k], lang)} title={mt(BUILD_LABEL[k], lang)}>
                      <BuildingIcon id={k} />
                      <b>{buildCost(ENGINE_KIND[k]).value}</b>
                    </button>
                  ))}
                  {showGreen && (
                    <button className="btn secondary compact w-more" disabled={!greenOk} onClick={greenNow} aria-label={mt('btnGreenOn', lang)} title={mt('btnGreenOn', lang)}>
                      <SunIcon />
                      <b>{greenCost}</b>
                    </button>
                  )}
                  {showEndSecondary && (
                    <button className="btn secondary compact" onClick={finishDay}>
                      <HomeIcon /> {mt('btnEndDay', lang)}
                    </button>
                  )}
                </div>
              )}
              {hint && <span className="w-hint">{hint}</span>}
              {prim.kind !== 'none' && (
                <button className={`btn primary w-primary${alarm === 'active' ? ' alarm' : ''}`} disabled={prim.disabled} onClick={onPrimary} data-act={prim.kind}>
                  {prim.kind === 'build' && prim.build ? (
                    <>
                      <BuildingIcon id={prim.build} /> {mt(BUILD_LABEL[prim.build], lang)}
                    </>
                  ) : (
                    <>
                      {prim.kind === 'shield' ? <ShieldIcon /> : prim.kind === 'cancelBuild' ? <CloseIcon /> : prim.kind === 'endDay' ? <CheckIcon /> : <HomeIcon />} {mt(primLabel[prim.kind], lang)}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {card && <DiscoveryCard lang={lang} poi={card} onClose={closeCard} />}

          {stage === 'report' && report && (
            <div className="c3d-overlay">
              <section className="c3d-panel w-report" role="dialog" aria-label={mt('reportTitle', lang)}>
                <h2>{mt('reportTitle', lang)}</h2>
                <ul className="w-rows">
                  <li>
                    <BoltIcon className="w-ric" />
                    <span className="w-rl">{mt('repEnergy', lang)}</span>
                    <span className="chip gives"><SunIcon /> <b>+{report.energy.produced}</b></span>
                    <span className="chip bolts spent"><BoltIcon /> <small>−{report.energy.spent.total}</small></span>
                  </li>
                  <li>
                    <TankIcon className="w-ric" />
                    <span className="w-rl">{mt('repAir', lang)}</span>
                    <b className="w-big">{Math.round(report.life.before)} → {Math.round(report.life.after)}</b>
                  </li>
                  <li>
                    <RadIcon className="w-ric" />
                    <span className="w-rl">{mt('repDose', lang)}</span>
                    <span className="chip gives"><b>+{report.dose.amount}</b></span>
                    <small>{mt(report.dose.where === 'inside' ? 'repInside' : report.dose.where === 'outsideRecalled' ? 'repBack' : 'repOutside', lang)}</small>
                  </li>
                </ul>
                {report.science.gained > 0 && (
                  <span className="chip gives" role="img" aria-label={`+${report.science.gained} ${mt('gaugeStars', lang)}`}>
                    {Array.from({ length: Math.min(report.science.gained, 8) }, (_, i) => <StarIcon key={i} className="gv-star" />)}
                  </span>
                )}
                {factLine && <p className="w-fact">{factLine}</p>}
                <div className="w-rep-btns">
                  <button className="btn secondary compact" onClick={() => setNotebookOpen(true)}><BookIcon /> {mt('notebook', lang)}</button>
                  <button className="btn primary" onClick={afterReport} autoFocus>
                    <PlayIcon /> {mission.outcome !== null ? mt('seeEnd', lang) : mt('nextDay', lang)}
                  </button>
                </div>
              </section>
            </div>
          )}

          {stage === 'end' && !liveMode && <EndScreen lang={lang} state={mission} onAgain={again} onSources={() => setSourcesOpen(true)} onLive={() => void startLive()} />}
          {stage === 'end' && liveInfo && <LiveEnd lang={lang} state={mission} live={liveInfo} onArchive={again} onSources={() => setSourcesOpen(true)} onNotebook={() => setNotebookOpen(true)} />}

          {menuOpen && (
            <div className="c3d-modal" onClick={() => setMenuOpen(false)}>
              <div className="c3d-sheet w-menu" role="dialog" aria-label={mt('menuTitle', lang)} onClick={(e) => e.stopPropagation()}>
                <h2>{mt('menuTitle', lang)}</h2>
                <button className="btn secondary" onClick={openAlbum} disabled={pois.length === 0}>{mt('album', lang)}</button>
                {liveMode ? (
                  <button className="btn secondary" onClick={() => { setMenuOpen(false); again(); }}>{mt('toArchive', lang)}</button>
                ) : (
                  <button className="btn secondary" onClick={() => void startLive()} disabled={modeBusy}>
                    <SunIcon /> {modeBusy ? mt('liveComputing', lang) : mt('modeLive', lang)}
                  </button>
                )}
                <button className="btn secondary" onClick={() => { setMenuOpen(false); setSourcesOpen(true); }}>{tx('info', lang)}</button>
                <button className="btn primary compact" onClick={() => setMenuOpen(false)} autoFocus><CloseIcon /> {mt('close', lang)}</button>
              </div>
            </div>
          )}
          {notebookOpen && <Notebook lang={lang} day={report && stage !== 'play' ? mission.days[Math.max(0, report.dayIndex - 1)] ?? day : day} report={stage === 'report' || stage === 'end' ? report : null} live={liveInfo} onClose={() => setNotebookOpen(false)} />}
          {bInfo && stage === 'play' && !card && !album && !menuOpen && !sourcesOpen && <BuildingCard lang={lang} id={bInfo.id} stat={bStat} onClose={closeBInfo} />}
          {album && <AlbumPanel lang={lang} pois={pois} found={album.found} earned={album.earned} onClose={() => setAlbum(null)} />}
          {sourcesOpen && <SourcesPanel lang={lang} meta={data.meta} datasets={rawDatasets(pois)} onClose={() => setSourcesOpen(false)} />}
          {stage === 'report' && <PatiPose id="pose-jump" lang={lang} side="left" over />}
        </div>
      )}

      {phase !== 'done' && (
        <div className="m3d-intro" onPointerDown={phase === 'run' ? () => { engine.stopVoice(); setSkip(true); } : undefined}>
          <div ref={wrapRef} className="m3d-intro-canvas">
            <Suspense fallback={null}>
              <IntroGlobe started={phase === 'run'} skip={skip} wrapRef={wrapRef} onDone={() => setPhase('done')} />
            </Suspense>
          </div>
          {phase === 'run' && <PatiPose id="pose-wave" lang={lang} side="right" />}
          {phase === 'run' && (
            <div className="m3d-intro-pati">
              <PatiAvatar mood="happy" lang={lang} big />
              <div className="m3d-bubble">{mt('wWelcome', lang)}</div>
            </div>
          )}
          {phase === 'gate' && (
            <TitleScreen
              lang={lang}
              setLang={setLang}
              reduceMotion={reduceMotion}
              onSources={() => setSourcesOpen(true)}
              onStart={() => {
                engine.unlock();
                setPhase('run');
                if (!QA) void engine.say('moon3d.wWelcome', mt('wWelcome', lang), lang);
              }}
            />
          )}
          {phase === 'gate' && sourcesOpen && <SourcesPanel lang={lang} meta={data.meta} datasets={rawDatasets(pois)} onClose={() => setSourcesOpen(false)} />}
          {phase === 'run' && <div className="m3d-skip">{tx('skip', lang)}</div>}
        </div>
      )}
    </div>
  );
}
