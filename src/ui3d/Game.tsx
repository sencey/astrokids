import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { engine } from '../audio/engine';
import { MOON_RULES as R, batteryCap, buildingLive, liveDayFromToday, loadMoonDays, missionSucceeded, NO_PLAN, planCosts, resolveDay, startMission, summarize, towerEnergy } from '../game/moon';
import { assetUrl } from '../three/data/terrain';
import { liveStatus } from '../three/live/latest';
import type { LatestJson, LiveStatus } from '../three/live/latest';
import { computeToday } from '../three/live/today';
import type { TodayData } from '../three/live/today';
import type { CargoItem, LiveBuildingId, DayReport, MoonPlan, MoonState } from '../game/moon';
import { idleAnim } from '../three/Actors';
import type { DayAnim } from '../three/Actors';
import type { CamApi } from '../three/CameraRig';
import { CONFIG } from '../three/config';
import { makeFrame, sampleSeries } from '../three/math';
import type { TimeState } from '../three/Sky';
import { buildSlots, landerSlot as pickLander, makeStatsGetter, nearestPSRPoint, rimPoint } from '../three/slots';
import type { Overlays } from '../three/Terrain';
import type { BuildingId, PlacedBuilding, Slot, SlotStats, TerrainData } from '../three/types';
import {
  BookIcon, BuildingIcon, BulbIcon, CheckIcon, ClockIcon, CloseIcon, CompassIcon, DownIcon, EyeIcon, FlagIcon, IceIcon, InfoIcon, LeftIcon, MinusIcon, MoonIcon, PauseIcon, PinIcon, PlayIcon, PlusIcon, RedoIcon, RightIcon, SlopeIcon, SunIcon, UpIcon,
} from './icons';
import { trimPlan } from './mission/plan';
import type { DestMode, DestPick } from './mission/plan';
import { Checklist } from './mission/Checklist';
import type { CkPage } from './mission/Checklist';
import { GUIDE_STEPS, GUIDE_TARGETS, GuideRing, readGuideDone, writeGuideDone } from './mission/Guide';
import { AlarmOverlay, Briefing, CargoPick, DayReportCard, ModeSelect, PlanPick } from './mission/Cards';
import type { ExplorePlan } from './mission/Cards';
import { AlbumPanel, DiscoveryCard, ExploreBar, MissionStrip, WelcomeCard } from './mission/Explore';
import { dailyMissions } from '../game/explore/explore';
import { derivePois } from '../game/explore/pois';
import type { ExploreEvent } from '../three/exploreTypes';
import { BuildingCard } from './mission/Building';
import type { BuildingStat } from './mission/Building';
import { fitExplore, missionStats, rawDatasets, readWelcomeDone, savedProgress, writeWelcomeDone } from './mission/exploreData';
import type { BadgeId, Poi } from './mission/exploreData';
import { Gauges } from './mission/Gauges';
import { EndScreen, LiveEnd, Notebook, SourcesPanel } from './mission/Panels';
import type { LiveInfo } from './mission/Panels';
import { mt, POI_TR } from './mission/text';
import type { MKey } from './mission/text';
import { tx } from './text';
import type { L } from './text';
import { PatiAvatar, PatiPose } from './pati/PatiAvatar';
import { patiMood } from './pati/mood';
import { installLayoutCheck } from './pati/layoutCheck';
import { useTime } from './useTime';
import WorldGame from './world/WorldGame';
import '../styles/suit.css';
import './ui3d.css';
import './mission/mission.css';
import './mission/explore.css';

interface OutingResult {
  spent: number;
  gain: number;
  walked: number;
  found: string[];
}
interface Outing {
  budget: number;
  left: number;
  gain: number;
  walked: number;
  found: string[];
  ending: boolean;
  timer: number;
  resolve: (r: OutingResult) => void;
}

const MoonScene = lazy(() => import('../three/MoonScene'));
const IntroGlobe = lazy(() => import('../three/Intro'));

/** Hooks for outside code (rules/mission layers). */
export interface MoonApi {
  slots: Slot[];
  getSlotStats(slot: Slot | number): SlotStats;
  currentDayIndex(): number;
  currentHour(): number;
}
export interface GameProps {
  data: TerrainData;
  lang: L;
  setLang: (l: L) => void;
  /** Fired when the child places a building. */
  onPlace?: (building: BuildingId, slot: Slot) => void;
  apiRef?: MutableRefObject<MoonApi | null>;
  skipIntro?: boolean;
  /** the in-game "reduce motion" setting */
  reduceMotion?: boolean;
}

type Stage = 'mode' | 'cargo' | 'place' | 'brief' | 'plan' | 'explore' | 'play' | 'report' | 'end';
const DAY_MS = 9000;
/** No outing on storm / super-storm days or while an alert is ongoing. */
const exploreLocked = (d: { sparkleBand: string; alertOngoing?: boolean }) => d.sparkleBand === 'storm' || d.sparkleBand === 'super' || !!d.alertOngoing;
const ALARM_SECONDS = 5;
/** Dev only: ?qa skips the intro and speech and shortens the time-lapse for automated runs. */
const QA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('qa');
/** Dev only: ?guide forces the guided first day even with ?qa or after it was finished. */
const FORCE_GUIDE = import.meta.env.DEV && new URLSearchParams(window.location.search).has('guide');

/** `?classic` keeps the old cargo / placement / 7-action plan flow; the default is the exploration-first world. */
export default function Game(props: GameProps) {
  const classic = new URLSearchParams(window.location.search).has('classic');
  return classic ? <ClassicGame {...props} /> : <WorldGame {...props} />;
}

function ClassicGame({ data, lang, setLang, onPlace, apiRef, skipIntro, reduceMotion }: GameProps) {
  const frame = useMemo(() => makeFrame(data, CONFIG.verticalExaggeration), [data]);
  const slots = useMemo(() => buildSlots(data), [data]);
  const getStats = useMemo(() => makeStatsGetter(data, slots), [data, slots]);
  const lander = useMemo(() => pickLander(slots, (s) => (s.buildable ? getStats(s).illumPct : -1)), [slots, getStats]);
  const moonDays = useMemo(() => loadMoonDays(), []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ok = slots.filter((s) => s.buildable);
    const west = slots.filter((s) => s.ix <= 9);
    console.info(`[moon3d] maxSlopeDeg=${CONFIG.maxSlopeDeg}: buildable ${ok.length}/${slots.length} (${Math.round((100 * ok.length) / slots.length)}%), left 10 columns ${west.filter((s) => s.buildable).length}/${west.length}; lander slot ${lander.index} (slope ${lander.slopeDeg.toFixed(1)}, illum ${getStats(lander).illumPct.toFixed(0)}%)`);
  }, [slots, lander, getStats]);

  const timeRef = useRef<TimeState>({ day: 0, hour: 12 });
  const { disp, playing, setPlaying, set } = useTime(timeRef, data.dayCount);
  const camApi = useRef<CamApi | null>(null);
  const dayAnim = useRef<DayAnim>(idleAnim());

  // ---- view state
  const [realLight, setRealLight] = useState(false);
  const [timeOpen, setTimeOpen] = useState(() => window.innerWidth >= 1100);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [overlays, setOverlays] = useState<Overlays>({ sun: false, ice: false });
  const [bubble, setBubble] = useState<string | null>(null);
  /** true while the bubble shows a tip/hint line (Pati winks) */
  const [tip, setTip] = useState(false);

  // ---- placement
  const [placing, setPlacing] = useState<BuildingId | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [extra, setExtra] = useState<PlacedBuilding[]>([]);

  // ---- mission
  const [stage, setStage] = useState<Stage>(QA ? 'cargo' : 'mode');
  const [mode, setMode] = useState<'archive' | 'live'>('archive');
  const [latest, setLatest] = useState<LatestJson | null>(null);
  const [liveSt, setLiveSt] = useState<LiveStatus>({ state: 'offline', fetchedAt: null, reason: 'loading' });
  const [today, setToday] = useState<TodayData | null>(null);
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
        /* offline: LIVE stays off */
      }
    })();
    return () => {
      off = true;
    };
  }, []);
  const [cargo, setCargo] = useState<CargoItem[]>([]);
  const [mission, setMission] = useState<MoonState | null>(null);
  const [plan, setPlan] = useState<MoonPlan>(NO_PLAN);
  const [report, setReport] = useState<DayReport | null>(null);
  const [alarm, setAlarm] = useState(false);
  const [bermShown, setBermShown] = useState(0);
  const recallRef = useRef<((v: boolean) => void) | null>(null);
  const skipRef = useRef(false);
  const missionRef = useRef<MoonState | null>(null);

  // ---- checklist, map-picking, camera cluster
  /** page the child opened by tab (null = the page of the current stage) */
  const [viewPage, setViewPage] = useState<CkPage | null>(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [destMode, setDestMode] = useState<DestMode | null>(null);
  const [routes, setRoutes] = useState<{ ice?: [number, number, number]; walk?: [number, number, number] }>({});
  const [pickMsg, setPickMsg] = useState<string | null>(null);
  const [compassOpen, setCompassOpen] = useState(false);

  // ---- guided first day
  const [guideDone, setGuideDone] = useState(readGuideDone);
  const [guideStarted, setGuideStarted] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // ---- exploration outing (before the time-lapse), album, first-run welcome
  /** the real points of interest (derived once from the terrain around the lander; a few hundred ms, so after first paint) */
  const [pois, setPois] = useState<Poi[]>([]);
  const [exploreE, setExploreE] = useState(0);
  const [exploring, setExploring] = useState(false);
  const [exploreBudget, setExploreBudget] = useState(0);
  const [energyLeft, setEnergyLeft] = useState(0);
  const [exploreGain, setExploreGain] = useState(0);
  const [outingEnding, setOutingEnding] = useState(false);
  const [outingFound, setOutingFound] = useState<string[]>([]);
  const [outingWalked, setOutingWalked] = useState(0);
  const [card, setCard] = useState<Poi | null>(null);
  const [patiTalking, setPatiTalking] = useState(false);
  const [album, setAlbum] = useState<{ found: Set<string>; earned: Set<BadgeId> } | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !QA && !readWelcomeDone());
  const outingRef = useRef<Outing | null>(null);
  const talkTok = useRef(0);
  /** the building the child tapped (the scene reports it through onBuildingTap) */
  const [bInfo, setBInfo] = useState<{ id: string; slotIndex: number } | null>(null);
  const onBuildingTap = useCallback((b: { id: string; slotIndex: number }) => setBInfo(b), []);
  const closeBInfo = useCallback(() => setBInfo(null), []);
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

  const placed = useMemo<PlacedBuilding[]>(() => [{ id: 'lander', slotIndex: lander.index }, ...extra], [lander, extra]);
  const occupied = useMemo(() => new Set(placed.map((p) => p.slotIndex)), [placed]);
  const directPlace = useMemo(() => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false, []);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { slots, getSlotStats: getStats, currentDayIndex: () => Math.floor(timeRef.current.day), currentHour: () => timeRef.current.hour };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, slots, getStats]);

  const say = useCallback(
    (key: string, text: string) => {
      setBubble(text);
      setTip(false);
      if (!QA) void engine.say(key, text, lang);
    },
    [lang],
  );
  const sayM = useCallback((k: MKey) => say(`moon3d.${k}`, mt(k, lang)), [say, lang]);

  // ---- exploration outing
  const langRef = useRef(lang);
  langRef.current = lang;
  const poisRef = useRef<Poi[]>([]);
  poisRef.current = pois;

  /** Pati reads a fact aloud (voice key moon3d.poi.<id>, TTS fallback); patiTalking follows the speech. */
  const speakFact = useCallback((poi: Poi) => {
    const tok = ++talkTok.current;
    setPatiTalking(true);
    const done = () => {
      if (talkTok.current === tok) setPatiTalking(false);
    };
    if (QA) window.setTimeout(done, 1200);
    else void engine.say(`moon3d.poi.${poi.id}`, langRef.current === 'tr' ? poi.factTr : poi.factEn, langRef.current).then(done, done);
  }, []);
  const closeCard = useCallback(() => {
    setCard(null);
    talkTok.current++;
    engine.stopVoice();
    setPatiTalking(false);
  }, []);

  const finishOuting = useCallback(() => {
    const o = outingRef.current;
    if (!o) return;
    outingRef.current = null;
    window.clearTimeout(o.timer);
    setExploring(false);
    setOutingEnding(false);
    setCard(null);
    talkTok.current++;
    engine.stopVoice();
    setPatiTalking(false);
    o.resolve({ spent: Math.max(0, Math.min(o.budget, o.budget - o.left)), gain: o.gain, walked: o.walked, found: o.found });
  }, []);
  /** "Go home" or the budget ran out: the scene walks Pati back, then 'home' arrives (fallback timer if it never does). */
  const endOuting = useCallback(() => {
    const o = outingRef.current;
    if (!o || o.ending) return;
    o.ending = true;
    setOutingEnding(true);
    // the scene walks the commander back (free) and then reports 'home'; the timer is only a safety net
    camApi.current?.goHome();
    o.timer = window.setTimeout(finishOuting, 15000);
  }, [finishOuting]);
  const runOuting = (budget: number) =>
    new Promise<OutingResult>((resolve) => {
      outingRef.current = { budget, left: budget, gain: 0, walked: 0, found: [], ending: false, timer: 0, resolve };
      setOutingWalked(0);
      setExploreBudget(budget);
      setEnergyLeft(budget);
      setExploreGain(0);
      setOutingFound([]);
      setOutingEnding(false);
      setCard(null);
      setStage('explore');
      setExploring(true);
      sayM('patiExploreStart');
    });
  const onExploreEventRef = useRef<(e: ExploreEvent) => void>(() => undefined);
  onExploreEventRef.current = (e) => {
    const o = outingRef.current;
    if (!o) return;
    if (Number.isFinite(e.energyLeft)) {
      o.left = e.energyLeft;
      setEnergyLeft(e.energyLeft);
    }
    if (Number.isFinite(e.walkedM)) {
      o.walked = Math.max(o.walked, e.walkedM);
      setOutingWalked(o.walked);
    }
    if (e.type === 'discover' && e.poiId) {
      const poi = poisRef.current.find((p) => p.id === e.poiId);
      if (!o.found.includes(e.poiId)) {
        o.found.push(e.poiId);
        setOutingFound([...o.found]);
        if (poi) {
          o.gain += poi.science;
          setExploreGain(o.gain);
        }
      }
      if (poi) {
        setCard(poi);
        speakFact(poi);
      }
    } else if (e.type === 'budgetSpent') {
      if (!o.ending) {
        sayM('patiBudgetSpent');
        endOuting();
      }
    } else if (e.type === 'home') finishOuting();
  };
  const onExploreEvent = useCallback((e: ExploreEvent) => onExploreEventRef.current(e), []);

  // ---- what the base needs
  const need = useMemo(
    () => ({
      habitat: 1,
      solarTower: 2 + (cargo.includes('extraTower') ? 1 : 0),
      greenhouse: cargo.includes('greenhouse') ? 1 : 0,
      batteryUnit: cargo.includes('batteryBank') ? 1 : 0,
    }),
    [cargo],
  );
  const have = (id: BuildingId) => extra.filter((e) => e.id === id).length;
  const remaining = (id: 'habitat' | 'solarTower' | 'greenhouse' | 'batteryUnit') => need[id] - have(id);
  const allPlaced = remaining('habitat') <= 0 && remaining('solarTower') <= 0 && remaining('greenhouse') <= 0 && remaining('batteryUnit') <= 0;
  const habitatSlot = useMemo(() => {
    const h = extra.find((e) => e.id === 'habitat');
    return h ? slots[h.slotIndex] : null;
  }, [extra, slots]);
  const towerSlots = useMemo(() => extra.filter((e) => e.id === 'solarTower').map((e) => slots[e.slotIndex]), [extra, slots]);
  const icePoint = useMemo(() => (habitatSlot ? nearestPSRPoint(data, habitatSlot) : null), [data, habitatSlot]);
  const rim = useMemo(() => (habitatSlot ? rimPoint(data, habitatSlot) : { x: 0, z: 0 }), [data, habitatSlot]);
  const litOf = useCallback(
    (slotIndex: number) => (mode === 'live' && today ? today.litBySlot.get(slotIndex) ?? 0 : getStats(slotIndex).litPctByDay[Math.floor(timeRef.current.day)] ?? 0),
    [getStats, mode, today],
  );
  const liveSky = useMemo(() => (mode === 'live' && today ? { sun: [today.sun], earth: [today.earth] } : undefined), [mode, today]);

  /** Buildable, free slots ranked best-first (towers/greenhouse: mean sunlit %; habitat: sunlit vs distance to ice). */
  const rankSlots = useCallback(
    (kind: 'solarTower' | 'habitat' | 'greenhouse' | 'batteryUnit', taken: Set<number>) =>
      slots
        .filter((s) => s.buildable && !taken.has(s.index))
        .map((s) => {
          const st = getStats(s);
          const meanLit = st.litPctByDay.reduce((a, b) => a + b, 0) / Math.max(1, st.litPctByDay.length);
          const score = kind === 'habitat' ? meanLit - (Number.isFinite(st.distanceToNearestPSRm) ? st.distanceToNearestPSRm / 100 : 99) : meanLit;
          return { index: s.index, illumPct: st.illumPct, meanLitPct: meanLit, distanceToNearestPSRm: st.distanceToNearestPSRm, slopeDeg: s.slopeDeg, score };
        })
        .sort((a, b) => b.score - a.score),
    [slots, getStats],
  );

  const nextPlaceLine = (e: PlacedBuilding[], c: CargoItem[]) => {
    const n = { habitat: 1, solarTower: 2 + (c.includes('extraTower') ? 1 : 0), greenhouse: c.includes('greenhouse') ? 1 : 0, batteryUnit: c.includes('batteryBank') ? 1 : 0 };
    const cnt = (id: BuildingId) => e.filter((x) => x.id === id).length;
    if (cnt('habitat') < n.habitat) return 'placeHabitat' as const;
    if (cnt('solarTower') < n.solarTower) return 'placeTower' as const;
    if (cnt('greenhouse') < n.greenhouse) return 'placeGreenhouse' as const;
    if (cnt('batteryUnit') < n.batteryUnit) return 'placeBattery' as const;
    return 'placeReady' as const;
  };

  // ---- stage entry lines
  useEffect(() => {
    if (phase === 'done' && stage === 'cargo') sayM('cargoPrompt');
    if (phase === 'done' && stage === 'mode') {
      if (welcomeOpen) {
        // the welcome card carries the line itself: no second bubble
        setBubble(null);
        if (!QA) void engine.say('moon3d.welcomeCard', mt('welcomeCard', lang), lang);
      } else sayM('patiMode');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stage === 'cargo', stage === 'mode', welcomeOpen]);
  const startExploring = () => {
    engine.stopVoice();
    writeWelcomeDone();
    setWelcomeOpen(false);
  };

  const startIntro = () => {
    engine.unlock();
    setPhase('run');
    say('moon3d.welcome', tx('welcome', lang));
  };
  const skipIntroNow = () => {
    engine.stopVoice();
    setSkip(true);
  };
  const finishIntro = useCallback(() => setPhase('done'), []);

  // ---- cargo -> place
  const toggleCargo = (c: CargoItem) => setCargo((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 2 ? [cur[1], c] : [...cur, c]));
  const confirmCargo = () => {
    setStage('place');
    sayM('placeHabitat');
  };

  // ---- placement
  const pickBuilding = (id: BuildingId) => {
    engine.sfx('pop');
    if (placing === id) {
      setPlacing(null);
      setSelected(null);
      return;
    }
    setPlacing(id);
    setSelected(null);
  };
  const cancel = () => {
    setPlacing(null);
    setSelected(null);
  };
  const place = (id: BuildingId, slot: Slot) => {
    const next = [...extra, { id, slotIndex: slot.index }];
    setExtra(next);
    setSelected(null);
    engine.sfx('thud');
    onPlace?.(id, slot);
    const line = nextPlaceLine(next, cargo);
    // keep the building type selected while more of the same are needed
    const stillNeeded = (id in need ? need[id as keyof typeof need] : 0) - next.filter((x) => x.id === id).length;
    if (stillNeeded <= 0) setPlacing(null);
    sayM(line);
  };
  const onTap = (i: number) => {
    if (!placing || stage !== 'place') return;
    const s = slots[i];
    if (occupied.has(i)) {
      setBubble(tx('hintTaken', lang));
      setTip(true);
      return;
    }
    if (!s.buildable) {
      setBubble(tx('hintSteep', lang));
      setTip(true);
      return;
    }
    if (directPlace || selected === i) place(placing, s);
    else {
      setSelected(i);
      setBubble(tx('hintConfirm', lang));
      setTip(true);
    }
  };
  const resetPlacements = () => {
    setExtra([]);
    setPlacing(null);
    setSelected(null);
    sayM('placeHabitat');
  };

  // ---- mission start
  const startTheMission = (list: PlacedBuilding[] = extra) => {
    const hab = list.find((e) => e.id === 'habitat');
    if (!hab) return;
    const gh = list.find((e) => e.id === 'greenhouse');
    const setup = {
      habitat: getStats(hab.slotIndex),
      towers: list.filter((e) => e.id === 'solarTower').map((e) => getStats(e.slotIndex)),
      greenhouse: gh ? getStats(gh.slotIndex) : null,
      cargo: [cargo[0], cargo[1]] as [CargoItem, CargoItem],
    };
    const st = startMission(setup, moonDays);
    setPlaying(false);
    setPlacing(null);
    setMission(st);
    setBermShown(0);
    // the very first archive mission runs as a guided day
    const g = (QA ? FORCE_GUIDE : true) && (!readGuideDone() || FORCE_GUIDE);
    setGuideStarted(g);
    setGuideDone(!g);
    setGuideStep(0);
    enterBrief(st);
  };

  /** TODAY'S MOON: one real day at the same base. Reuses the child's placement, or the best default slots. */
  const startLive = async () => {
    if (modeBusy) return;
    setModeBusy(true);
    try {
      const needT = 2 + (cargo.includes('extraTower') ? 1 : 0);
      const complete = cargo.length === 2 && have('habitat') === 1 && have('solarTower') === needT && have('greenhouse') === (cargo.includes('greenhouse') ? 1 : 0) && have('batteryUnit') === (cargo.includes('batteryBank') ? 1 : 0);
      let ex = extra;
      let cg = cargo;
      if (!complete) {
        cg = ['extraTower', 'batteryBank'];
        const taken = new Set<number>([lander.index]);
        const hab = rankSlots('habitat', taken)[0];
        taken.add(hab.index);
        const towers = rankSlots('solarTower', taken).slice(0, 3);
        towers.forEach((t) => taken.add(t.index));
        const bat = rankSlots('batteryUnit', taken)[0];
        ex = [{ id: 'habitat', slotIndex: hab.index }, ...towers.map((t) => ({ id: 'solarTower' as const, slotIndex: t.index })), ...(bat ? [{ id: 'batteryUnit' as const, slotIndex: bat.index }] : [])];
        setCargo(cg);
        setExtra(ex);
      }
      const now = new Date();
      const t = await computeToday(data, ex.map((e) => slots[e.slotIndex]), now);
      const stat = (idx: number): SlotStats => ({ ...getStats(idx), litPctByDay: [t.litBySlot.get(idx) ?? 0] });
      const hab = ex.find((e) => e.id === 'habitat')!;
      const gh = ex.find((e) => e.id === 'greenhouse');
      const towerStats = ex.filter((e) => e.id === 'solarTower').map((e) => stat(e.slotIndex));
      const avgLit = towerStats.reduce((a, s) => a + s.litPctByDay[0], 0) / Math.max(1, towerStats.length);
      const liveDay = liveDayFromToday(latest ?? { generatedAt: now.toISOString(), sep: [] }, { at: now.toISOString(), litPct: avgLit });
      const st = startMission({ habitat: stat(hab.slotIndex), towers: towerStats, greenhouse: gh ? stat(gh.slotIndex) : null, cargo: [cg[0], cg[1]] as [CargoItem, CargoItem] }, [liveDay]);
      setToday(t);
      setMode('live');
      setGuideStarted(false);
      setPlaying(false);
      setPlacing(null);
      setReport(null);
      setMission(st);
      missionRef.current = st;
      setBermShown(0);
      enterBrief(st, now.getUTCHours(), true);
    } finally {
      setModeBusy(false);
    }
  };

  const enterBrief = (st: MoonState, hour = 12, live = false) => {
    set(st.cursor, hour);
    setPlan(NO_PLAN);
    setExploreE(0);
    setRoutes({});
    setDestMode(null);
    setPickMsg(null);
    setViewPage(null);
    setStage('brief');
    camApi.current?.overview();
    const d = st.days[st.cursor];
    const prod = st.setup.towers.map((t) => t.litPctByDay[st.cursor] ?? t.illumPct);
    const dark = prod.every((p) => p < 10);
    // priority: alarm / ongoing / storm -> dark or empty battery -> life low -> calm
    sayM(
      d.sparkleBand === 'super' ? 'patiBriefSuper'
      : d.sparkleBand === 'storm' ? 'patiBriefStorm'
      : d.alarmAt || d.alertOngoing ? 'patiBriefAlert'
      : dark ? 'patiBriefDark'
      : st.battery <= 0 ? 'patiBriefEmpty'
      : st.life <= R.life.resupplyLevel.value ? 'patiBriefLife'
      : live ? 'patiLive'
      : 'patiBriefCalm',
    );
  };

  // ---- the day time-lapse
  const playDay = (st: MoonState, p: MoonPlan) =>
    new Promise<boolean>((resolve) => {
      const day = st.days[st.cursor];
      const a = dayAnim.current;
      a.active = true;
      a.t = 0;
      a.ice = p.iceTrip;
      a.walk = p.scienceWalk;
      a.recalledAt = null;
      let alarmFrac: number | null = null;
      if (day.alarmAt && p.scienceWalk) {
        const dt = new Date(day.alarmAt);
        if (!Number.isNaN(dt.getTime())) alarmFrac = (dt.getUTCHours() + dt.getUTCMinutes() / 60) / 24;
      }
      const dayMs = QA ? 1200 : DAY_MS;
      skipRef.current = false;
      let elapsed = 0;
      let last = performance.now();
      let paused = false;
      let recalled = false;
      let alarmDone = false;
      let raf = 0;
      const finish = () => {
        cancelAnimationFrame(raf);
        a.active = false;
        timeRef.current = { day: st.cursor, hour: 12 };
        resolve(recalled);
      };
      const tick = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000) * 1000;
        last = now;
        if (!paused) elapsed += dt;
        if (skipRef.current && !paused) {
          // jump to the alarm first (if one is due), then to the end of the day
          if (alarmFrac !== null && !alarmDone) elapsed = Math.max(elapsed, alarmFrac * dayMs);
          else elapsed = dayMs;
        }
        const t = Math.min(1, elapsed / dayMs);
        a.t = t;
        timeRef.current = { day: st.cursor, hour: Math.min(23.99, t * 24) };
        if (alarmFrac !== null && !alarmDone && t >= alarmFrac) {
          alarmDone = true;
          paused = true;
          setAlarm(true);
          sayM('patiAlarm');
          const timer = window.setTimeout(() => settle(false), ALARM_SECONDS * 1000);
          const settle = (v: boolean) => {
            window.clearTimeout(timer);
            recallRef.current = null;
            setAlarm(false);
            if (v) {
              recalled = true;
              a.recalledAt = a.t;
              sayM('patiRecalled');
            } else sayM('patiTooLate');
            paused = false;
          };
          recallRef.current = settle;
        }
        if (t >= 1) finish();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

  const goDay = async () => {
    if (!mission) return;
    // Never play an unaffordable plan: trim it (walk, ice, greenhouse, shield, running) first.
    const { plan: safe } = trimPlan(mission, plan);
    setPlan(safe);
    setViewPage(null);
    setDestMode(null);
    setBermShown(mission.berm + (safe.shield ? 1 : 0));
    // the outing comes first: it spends only the energy the plan left over, and only on a calm day
    const costs = planCosts(mission, safe);
    const day0 = mission.days[mission.cursor];
    const outingOk = pois.length > 0 && !exploreLocked(day0);
    const budget = outingOk ? fitExplore(exploreE, Math.max(0, costs.available - costs.total)) : 0;
    let out: OutingResult = { spent: 0, gain: 0, walked: 0, found: [] };
    if (budget > 0) out = await runOuting(budget);
    setExploreE(0);
    setStage('play');
    camApi.current?.overview();
    // the engine settles the outing itself: spent energy, science, distance and the places found (English names for the report fact)
    const outPlan: MoonPlan =
      budget > 0
        ? { ...safe, exploreEnergy: out.spent, exploreScience: out.gain, exploreWalkedM: Math.round(out.walked), exploreFound: out.found.map((id) => pois.find((p) => p.id === id)?.nameEn ?? id) }
        : safe;
    try {
      const recalled = await playDay(mission, safe);
      const { nextState, report: r } = resolveDay(mission, { ...outPlan, recalledInTime: recalled });
      missionRef.current = nextState;
      setMission(nextState);
      setReport(r);
      setExploreGain(0);
      setBermShown(nextState.berm);
      setStage('report');
    } catch (e) {
      // never hang in the time-lapse: go back to planning
      dayAnim.current.active = false;
      setAlarm(false);
      setBermShown(mission.berm);
      setStage('plan');
      sayM('patiPlanError');
      throw e instanceof Error ? e : new Error(String(e));
    }
  };
  const afterReport = () => {
    if (!mission) return;
    setNotebookOpen(false);
    if (guideOn) finishGuide();
    if (mission.outcome !== null) {
      setStage('end');
      sayM('patiEnd');
    } else enterBrief(mission);
  };
  const again = () => {
    setMission(null);
    setReport(null);
    setExtra([]);
    setCargo([]);
    setBermShown(0);
    setPlan(NO_PLAN);
    setMode('archive');
    setToday(null);
    setGuideStarted(false);
    setRoutes({});
    setDestMode(null);
    setViewPage(null);
    setStage('cargo');
    set(0, 12);
    camApi.current?.overview();
  };

  // ---- map-picking of ice-trip / science-walk destinations (the 3D scene reports the pick)
  const setPlanUI = (p: MoonPlan) => {
    setPickMsg(null);
    setPlan(p);
  };
  const startPick = (m: DestMode) => {
    setDestMode(m);
    setPickMsg(null);
    setSheetFull(false);
    sayM(m === 'ice' ? 'pickIce' : 'pickWalk');
  };
  const cancelPick = useCallback(() => setDestMode(null), []);
  const onDestPicked = (pk: DestPick) => {
    const m = destMode;
    setDestMode(null);
    if (!mission || !m) return;
    const np: MoonPlan = m === 'ice' ? { ...plan, iceTrip: true, iceTargetDistanceM: pk.distanceM } : { ...plan, scienceWalk: pk.kind, walkTargetDistanceM: pk.distanceM };
    if (!planCosts(mission, np).affordable) {
      setPickMsg(mt('pickNoEnergy', lang));
      return;
    }
    engine.sfx('pop');
    setPickMsg(null);
    setPlan(np);
    const own = planCosts(mission, m === 'ice' ? { ...NO_PLAN, iceTrip: true, iceTargetDistanceM: pk.distanceM } : { ...NO_PLAN, scienceWalk: pk.kind, walkTargetDistanceM: pk.distanceM });
    const km = pk.distanceM < 1000 ? `${Math.round(pk.distanceM)} m` : `${(pk.distanceM / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    say('moon3d.pickResult', mt('pickResult', lang).replace('{d}', km).replace('{n}', String(m === 'ice' ? own.ice : own.walk)));
    setRoutes((r) => (m === 'ice' ? { ...r, ice: pk.point } : { ...r, walk: pk.point }));
  };
  useEffect(() => {
    if (!destMode) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setDestMode(null);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [destMode]);
  const routePreview: { from: 'habitat'; to: [number, number, number] } | null =
    stage === 'plan' || stage === 'play'
      ? plan.iceTrip && plan.iceTargetDistanceM !== undefined && routes.ice
        ? { from: 'habitat', to: routes.ice }
        : plan.scienceWalk && plan.walkTargetDistanceM !== undefined && routes.walk
          ? { from: 'habitat', to: routes.walk }
          : null
      : null;
  useEffect(() => setViewPage(null), [stage]);
  useEffect(() => setBInfo(null), [stage]);

  // ---- guided first day (derived step: no flicker when the stage and the plan change together)
  const guideOn = guideStarted && !guideDone && phase === 'done' && !!mission && (stage === 'report' || (stage !== 'end' && stage !== 'cargo' && stage !== 'place' && stage !== 'mode' && mission.cursor === 0));
  const guideFloor = stage === 'plan' ? 2 : stage === 'play' || stage === 'explore' ? 4 : stage === 'report' ? 5 : 0;
  let guideNow = Math.max(guideStep, guideFloor);
  if (stage === 'plan') {
    if (guideNow === 2 && plan.keepRunning) guideNow = 3;
    if (guideNow === 3 && plan.shield) guideNow = 4;
  }
  guideNow = Math.min(guideNow, GUIDE_STEPS - 1);
  const guideVisible = guideOn && stage !== 'play' && stage !== 'explore' && destMode === null;
  const finishGuide = () => {
    setGuideDone(true);
    writeGuideDone(true);
    // the guide line must not linger; the next-step line in the bubble takes over
    setBubble(null);
    setTip(false);
  };
  const guideKey = guideVisible ? (`guide${guideNow + 1}` as MKey) : null;
  useEffect(() => {
    if (guideKey) sayM(guideKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideKey]);
  const guideNext = () => {
    if (guideNow >= GUIDE_STEPS - 1) finishGuide();
    else if (guideNow === 1) toPlan();
    else setGuideStep(guideNow + 1);
  };
  const toPlan = () => {
    setViewPage(null);
    if (stage === 'brief') setStage('plan');
  };
  const onTab = (p: CkPage) => {
    if (stage === 'brief' || stage === 'plan') {
      if (p === 1) setViewPage(stage === 'brief' ? null : 1);
      else if (p === 2) toPlan();
    }
  };

  const cam = (fn: (a: CamApi) => void) => () => camApi.current && fn(camApi.current);
  const surfaceView = () => {
    const t = timeRef.current;
    const e = sampleSeries(data.earth, t.day, t.hour);
    const s = sampleSeries(data.sun, t.day, t.hour);
    const az = e.el > 0 ? e.az : s.az;
    camApi.current?.ground(lander.x, lander.z, (CONFIG.habitatSlotFraction * lander.cells * frame.cell) / 8, az);
  };
  const dateLabel = (i: number) => {
    const iso = data.meta.days[i] ?? data.sun[i]?.date;
    try {
      return new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    } catch {
      return String(iso);
    }
  };

  const renderTag = useCallback(
    (s: Slot) => {
      const st = getStats(s);
      const today = st.litPctByDay[disp.day] ?? 0;
      const late = st.litPctByDay.slice(-4);
      const coldLate = late.length > 0 && late.reduce((a, b) => a + b, 0) / late.length < 20;
      return (
        <div className={`m3d-tag ${s.buildable && !occupied.has(s.index) ? 'ok' : 'bad'}`}>
          {placing && <BuildingIcon id={placing} className="m3d-tag-b" />}
          <div className="m3d-tag-row">
            <SunIcon className="m3d-gold" />
            <b>{Math.round(st.illumPct)}%</b>
          </div>
          <div className="m3d-tag-bar">
            <i style={{ width: `${Math.round(st.illumPct)}%` }} />
          </div>
          <small>
            {tx('today', lang)} {Math.round(today)}%
          </small>
          {placing === 'habitat' && Number.isFinite(st.distanceToNearestPSRm) && (
            <div className="m3d-tag-row m3d-ice">
              <IceIcon /> <small>{mt('iceAway', lang)} {(st.distanceToNearestPSRm / 1000).toFixed(1)} km</small>
            </div>
          )}
          {placing === 'habitat' && coldLate && (
            <div className="m3d-tag-row m3d-ice" title={mt('coldLate', lang)}>
              <IceIcon /> <small>{mt('coldLate', lang)}</small>
            </div>
          )}
          {st.isPSR && (
            <div className="m3d-tag-row m3d-ice" title={tx('shadowForever', lang)}>
              <IceIcon /> <small>{tx('shadowForever', lang)}</small>
            </div>
          )}
          {!s.buildable && (
            <div className="m3d-tag-row m3d-red">
              <SlopeIcon /> <small>{tx('steep', lang)} {Math.round(s.slopeDeg)}°</small>
            </div>
          )}
        </div>
      );
    },
    [getStats, disp.day, placing, occupied, lang],
  );

  // ---- DEV-only QA hook: drives the same handlers/state as the UI. Mutators are async: await them (they wait for React to commit).
  missionRef.current = mission ?? missionRef.current;
  const qaRef = useRef<Record<string, unknown>>({});
  qaRef.current = {
    state: () => ({
      phase: stage === 'play' ? (alarm ? 'alarm' : 'timelapse') : stage,
      dayIndex: mission ? mission.cursor : -1,
      date: mission ? (mission.days[Math.min(mission.cursor, mission.days.length - 1)]?.date ?? null) : null,
      battery: mission?.battery ?? null,
      batteryCap: mission ? batteryCap(mission.setup) : null,
      life: mission?.life ?? null,
      dose: mission?.dose ?? null,
      science: mission?.science ?? null,
      berm: mission?.berm ?? 0,
      placed: extra.map((e) => ({ id: e.id, slotIndex: e.slotIndex })),
      cargo,
      pendingAlarm: alarm,
    }),
    slots: (kind: 'solarTower' | 'habitat' | 'greenhouse' | 'batteryUnit' = 'solarTower') => rankSlots(kind, occupied),
    live: () => startLive(),
    liveInfo: () => ({ status: liveSt, mode, today: today ? { date: today.date, litBySlot: [...today.litBySlot], maxSunEl: today.maxSunEl } : null }),
    pickCargo: (items: CargoItem[]) => {
      const uniq = [...new Set(items)].slice(0, 2);
      if (uniq.length !== 2 || stage !== 'cargo') return { ok: false, reason: 'need exactly 2 distinct items in the cargo stage' };
      setCargo(uniq);
      confirmCargo();
      return { ok: true };
    },
    place: (id: BuildingId, slotIndex: number) => {
      const s = slots[slotIndex];
      if (stage !== 'place' || !s) return { ok: false, reason: 'not in the place stage / bad slot' };
      if (id !== 'habitat' && id !== 'solarTower' && id !== 'greenhouse' && id !== 'batteryUnit') return { ok: false, reason: 'only habitat, solarTower, greenhouse, batteryUnit' };
      if (remaining(id) <= 0) return { ok: false, reason: 'none of that building left to place' };
      if (occupied.has(slotIndex)) return { ok: false, reason: 'taken' };
      if (!s.buildable) return { ok: false, reason: 'too steep' };
      place(id, s);
      return { ok: true };
    },
    startMission: () => {
      if (stage !== 'place') return { ok: false, reason: 'not in the place stage' };
      if (!allPlaced) {
        // old QA scripts place only habitat + towers (+ greenhouse): the missing battery unit is auto-placed on the best free slot
        const onlyBattery = remaining('habitat') <= 0 && remaining('solarTower') <= 0 && remaining('greenhouse') <= 0 && remaining('batteryUnit') > 0;
        const bat = onlyBattery ? rankSlots('batteryUnit', occupied)[0] : undefined;
        if (!bat) return { ok: false, reason: 'not everything is placed' };
        const list = [...extra, { id: 'batteryUnit' as const, slotIndex: bat.index }];
        setExtra(list);
        startTheMission(list);
        return { ok: true, autoPlaced: 'batteryUnit', slotIndex: bat.index };
      }
      startTheMission();
      return { ok: true };
    },
    plan: (p: { running?: boolean; ice?: boolean; greenhouse?: boolean; shield?: boolean; walk?: 'none' | 'rim' | 'ice' }) => {
      if (!mission) return null;
      const asked: MoonPlan = { ...NO_PLAN, keepRunning: !!p.running, iceTrip: !!p.ice, greenhouse: !!p.greenhouse, shield: !!p.shield, scienceWalk: p.walk === 'rim' || p.walk === 'ice' ? p.walk : null };
      const { plan: np, dropped } = trimPlan(mission, asked);
      setPlan(np);
      if (stage === 'brief') setStage('plan');
      return { ...planCosts(mission, np), trimmed: dropped, plan: np };
    },
    confirmDay: () => (stage === 'plan' ? goDay() : Promise.resolve()),
    recall: () => {
      recallRef.current?.(true);
    },
    skipTimelapse: () => {
      skipRef.current = true;
    },
    nextDay: () => {
      if (stage === 'report') afterReport();
    },
    lastReport: () => report,
    /** guided first day: guided() reads the state, guided('skip') finishes it, guided('reset') makes it show again on the next mission */
    guided: (cmd?: 'skip' | 'reset') => {
      if (cmd === 'skip') finishGuide();
      if (cmd === 'reset') {
        writeGuideDone(false);
        setGuideDone(false);
      }
      return { active: guideOn, visible: guideVisible, step: guideOn ? guideNow : -1, target: guideVisible ? GUIDE_TARGETS[guideNow] : null, done: guideDone, started: guideStarted };
    },
    /** outing: explore(2|4|6) assigns energy for the next "Start the day"; exploreEvent(e) feeds a scene event; exploreHome() presses Go home */
    explore: (n?: number) => {
      if (typeof n === 'number') setExploreE(n === 2 || n === 4 || n === 6 ? n : 0);
      return { energy: exploreE, available: pois.length > 0, locked: curDay ? exploreLocked(curDay) : null, exploring, energyLeft, found: outingFound };
    },
    exploreEvent: (e: ExploreEvent) => onExploreEvent(e),
    exploreHome: () => endOuting(),
    destination: (m: DestMode | null) => {
      setDestMode(m);
      return m;
    },
    pickDestination: (pk: DestPick) => onDestPicked(pk),
    summary: () => (missionRef.current ? summarize(missionRef.current) : null),
    history: () => (missionRef.current ? missionRef.current.reports : []),
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const sleep = () => new Promise<void>((r) => window.setTimeout(r, 80));
    const call = (k: string) => (...a: unknown[]) => (qaRef.current[k] as (...x: unknown[]) => unknown)(...a);
    const wrap = (k: string) => async (...a: unknown[]) => {
      const r = await call(k)(...a);
      await sleep();
      return r;
    };
    (window as unknown as { __moon: unknown }).__moon = {
      state: call('state'),
      slots: call('slots'),
      lastReport: call('lastReport'),
      guided: call('guided'),
      destination: call('destination'),
      explore: call('explore'),
      exploreEvent: call('exploreEvent'),
      exploreHome: call('exploreHome'),
      pickDestination: call('pickDestination'),
      summary: call('summary'),
      history: call('history'),
      skipTimelapse: call('skipTimelapse'),
      recall: call('recall'),
      pickCargo: wrap('pickCargo'),
      place: wrap('place'),
      startMission: wrap('startMission'),
      plan: wrap('plan'),
      confirmDay: wrap('confirmDay'),
      nextDay: wrap('nextDay'),
      live: wrap('live'),
      liveInfo: call('liveInfo'),
    };
    return () => {
      delete (window as unknown as { __moon?: unknown }).__moon;
    };
  }, []);

  useEffect(() => (import.meta.env.DEV ? installLayoutCheck() : undefined), []);

  const inMission = mission !== null && stage !== 'cargo' && stage !== 'place';
  const ckStagePage: CkPage = stage === 'brief' ? 1 : stage === 'report' ? 3 : 2;
  const ckShown: CkPage = viewPage ?? ckStagePage;
  const dockTypes = (['habitat', 'solarTower', 'greenhouse', 'batteryUnit'] as const).filter((id) => need[id] > 0);
  const curDay = mission ? mission.days[Math.min(mission.cursor, mission.days.length - 1)] : moonDays[0];
  const notebookDay = report && stage === 'report' && mission ? mission.days[report.dayIndex - 1] ?? curDay : curDay;
  const liveInfo: LiveInfo | undefined = mode === 'live' ? { latest, status: liveSt, today } : undefined;
  // ---- Pati: expression for the corner avatar
  const briefDay = mission && (stage === 'brief' || stage === 'plan' || stage === 'play') ? mission.days[Math.min(mission.cursor, mission.days.length - 1)] : null;
  const darkNow = !!mission && mission.setup.towers.every((t) => (t.litPctByDay[Math.min(mission.cursor, t.litPctByDay.length - 1)] ?? t.illumPct) < 10);
  const mood = patiMood({
    alarm,
    superBriefing: stage === 'brief' && briefDay?.sparkleBand === 'super',
    storm: briefDay?.sparkleBand === 'storm' || briefDay?.sparkleBand === 'super',
    alertOngoing: !!briefDay?.alertOngoing,
    shieldDay: (stage === 'plan' || stage === 'play') && plan.shield,
    resupply: stage === 'report' && !!report?.events.includes('resupply'),
    earlyReturn: mission?.outcome === 'earlyReturn',
    lifeLow: !!mission && mission.life <= R.life.resupplyLevel.value,
    batteryEmptyDark: !!mission && mission.battery <= 0 && darkNow,
    tip: tip || card !== null,
    live: mode === 'live',
  });

  // ---- "always know what to do": one next-step line under what Pati just said, derived from the state
  const nextKey: MKey | null = (() => {
    if (phase !== 'done' || !mission || guideVisible || destMode !== null || alarm) return null;
    if (stage === 'brief') return 'nextPlan';
    if (stage === 'plan') {
      if (mission.battery <= 2 && !plan.keepRunning) return 'nextLowBattery';
      const any = plan.keepRunning || plan.iceTrip || plan.greenhouse || plan.shield || plan.scienceWalk !== null || exploreE > 0;
      return any ? 'nextGo' : 'nextPickAction';
    }
    if (stage === 'explore') {
      if (card || outingEnding) return null;
      if (energyLeft <= 1) return 'nextHome';
      return outingFound.length > 0 ? 'nextMoreFlag' : 'nextFlag';
    }
    if (stage === 'report') return 'nextReport';
    return null;
  })();
  const nextText = nextKey ? mt(nextKey, lang) : null;
  const exploreInfo: ExplorePlan | undefined =
    pois.length > 0 && mission && stage === 'plan'
      ? { energy: exploreE, setEnergy: setExploreE, locked: exploreLocked(curDay) ? mt('exploreLocked', lang) : null }
      : undefined;
  const missionLines = mission ? dailyMissions(mission.cursor) : null;
  const stats = missionStats(pois, outingFound, outingWalked);
  const bStat = ((): BuildingStat[] => {
    if (!bInfo) return [];
    const id = bInfo.id as LiveBuildingId;
    const towerIndex = extra.filter((e) => e.id === 'solarTower').findIndex((e) => e.slotIndex === bInfo.slotIndex);
    const live = buildingLive(mission, id, Math.max(0, towerIndex));
    const out: BuildingStat[] = [];
    if (live.litPct !== undefined) out.push({ label: 'statLit', value: `${live.litPct}%` });
    if (live.energy !== undefined) out.push({ label: 'statEnergy', value: String(live.energy) });
    if (live.needsGrowLights) out.push({ label: 'statGrow', value: mt('lightsOn', lang) });
    if (live.berm !== undefined) out.push({ label: 'statBerm', value: String(live.berm) });
    if (live.battery) out.push({ label: 'statBattery', value: `${Math.round(live.battery.now)}/${live.battery.cap}` });
    return out;
  })();
  const openAlbum = () => {
    const s = savedProgress(pois, frame.extent, { x: lander.x, z: lander.z });
    setAlbum({ found: new Set(s.discovered), earned: new Set(s.badges) });
  };

  return (
    <div className="m3d" data-reduce={reduceMotion ? 'true' : 'false'}>
      <Suspense fallback={<div className="m3d-boot">{tx('loading', lang)}</div>}>
        <MoonScene
          data={data}
          frame={frame}
          timeRef={timeRef}
          overlays={overlays}
          slots={slots}
          placed={placed}
          landerSlot={lander}
          showSlots={!!placing && stage === 'place'}
          hover={hover}
          selected={selected}
          onHover={setHover}
          onTap={onTap}
          camApi={camApi}
          renderTag={renderTag}
          fill={!realLight}
          sky={liveSky}
          baseLabel={tx('base', lang) + ' / ' + tx('base', lang === 'tr' ? 'en' : 'tr')}
          poleLabel={tx('pole', lang) + ' / ' + tx('pole', lang === 'tr' ? 'en' : 'tr')}
          mission={{ habitat: habitatSlot, towers: towerSlots, berm: bermShown, anim: dayAnim, litOf, ice: icePoint, rim }}
          destinationMode={destMode}
          onDestinationPicked={onDestPicked}
          onDestinationCancel={cancelPick}
          onDestinationRejected={(r) => {
            const k: MKey = r === 'tooFar' ? 'pickTooFar' : r === 'notIce' ? 'pickNotIce' : 'pickSteep';
            setPickMsg(mt(k, lang));
            sayM(k);
          }}
          routePreview={routePreview}
          exploreMode={exploring}
          exploreBudget={exploreBudget}
          onExploreEvent={onExploreEvent}
          patiTalking={patiTalking}
          onBuildingTap={onBuildingTap}
          batteryFill={buildingLive(mission, 'batteryUnit').fill ?? 0.5}
          lang={lang}
        />
      </Suspense>

      {phase === 'done' && (
        <div className="m3d-hud" data-stage={stage}>
          <div className="m3d-top">
            <div className="m3d-left">
              <PatiAvatar mood={mood} lang={lang} talking={patiTalking} onClick={() => bubble && say('moon3d.repeat', bubble)} />
              {(bubble || nextText) && (
                <div className="m3d-bubble" role="status">
                  {bubble && <p>{bubble}</p>}
                  {nextText && (
                    <p className="m3d-next">
                      <FlagIcon />
                      <span>{nextText}</span>
                    </p>
                  )}
                  {guideVisible && (
                    <div className="gd-ctl">
                      {guideNow !== 1 && guideNow !== 4 && (
                        <button className="btn secondary sm" onClick={guideNext}>{guideNow >= GUIDE_STEPS - 1 ? mt('guideDone', lang) : mt('guideNext', lang)}</button>
                      )}
                      <button className="btn secondary sm" onClick={finishGuide}>{mt('guideSkip', lang)}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {mission && stage !== 'end' && (
              <div className="m3d-gauges">
                <Gauges lang={lang} battery={mission.battery} cap={batteryCap(mission.setup)} life={mission.life} dose={mission.dose} science={mission.science + exploreGain} extra={stage === 'brief' ? mission.setup.towers.reduce((a, t) => a + towerEnergy(t, mission.cursor), 0) : 0} />
              </div>
            )}
            {stage === 'explore' && !card && missionLines && <MissionStrip lang={lang} missions={missionLines} stats={stats} />}
            <div className="m3d-lang" role="group" aria-label={tx('language', lang)}>
              <button className={lang === 'tr' ? 'on' : ''} onClick={() => setLang('tr')} aria-pressed={lang === 'tr'}>TR</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')} aria-pressed={lang === 'en'}>EN</button>
            </div>
          </div>
          {data.placeholder && <div className="m3d-warn">{tx('placeholder', lang)}</div>}

          <div className="m3d-tools">
            <button className={`rb ${overlays.sun ? 'on' : ''}`} onClick={() => setOverlays((o) => ({ ...o, sun: !o.sun }))} aria-pressed={overlays.sun} aria-label={tx('sunMap', lang)} title={tx('sunMap', lang)}>
              <SunIcon />
            </button>
            <button className={`rb ${overlays.ice ? 'on' : ''}`} onClick={() => setOverlays((o) => ({ ...o, ice: !o.ice }))} aria-pressed={overlays.ice} aria-label={tx('iceMap', lang)} title={tx('iceMap', lang)}>
              <IceIcon />
            </button>
            <button className={`rb ${realLight ? 'on' : ''}`} onClick={() => setRealLight(!realLight)} aria-pressed={realLight} aria-label={tx('realLight', lang)} title={tx('realLight', lang)}>
              <BulbIcon />
            </button>
            {inMission && (
              <button className="rb" onClick={() => setNotebookOpen(true)} aria-label={mt('notebook', lang)} title={mt('notebook', lang)}>
                <BookIcon />
              </button>
            )}
            <button className="rb" onClick={() => setSourcesOpen(true)} aria-label={tx('info', lang)} title={tx('info', lang)}>
              <InfoIcon />
            </button>
            <button className={`rb ${compassOpen ? 'on' : ''}`} onClick={() => setCompassOpen(!compassOpen)} aria-expanded={compassOpen} aria-label={tx('camera', lang)} title={tx('camera', lang)}>
              <CompassIcon />
            </button>
            {compassOpen && (
              <div className="cc-pop" role="group" aria-label={tx('camera', lang)}>
                <button className="rb" onClick={cam((a) => a.rotate(0.35))} aria-label={tx('rotL', lang)}><LeftIcon /></button>
                <button className="rb" onClick={cam((a) => a.rotate(-0.35))} aria-label={tx('rotR', lang)}><RightIcon /></button>
                <button className="rb" onClick={cam((a) => a.tilt(-0.18))} aria-label={tx('tiltUp', lang)}><UpIcon /></button>
                <button className="rb" onClick={cam((a) => a.tilt(0.18))} aria-label={tx('tiltDown', lang)}><DownIcon /></button>
                <button className="rb" onClick={cam((a) => a.zoom(0.7))} aria-label={tx('zoomIn', lang)}><PlusIcon /></button>
                <button className="rb" onClick={cam((a) => a.zoom(1.4))} aria-label={tx('zoomOut', lang)}><MinusIcon /></button>
                <button className="rb" onClick={() => { camApi.current?.overview(); setCompassOpen(false); }} aria-label={tx('overview', lang)} title={tx('overview', lang)}><MoonIcon /></button>
                <button className="rb" onClick={() => { surfaceView(); setCompassOpen(false); }} aria-label={tx('ground', lang)} title={tx('ground', lang)}><EyeIcon /></button>
              </div>
            )}
          </div>
          {realLight && <div className="m3d-chiplabel">{tx('realLight', lang)}</div>}

          {mission && (stage === 'brief' || stage === 'plan' || stage === 'play' || stage === 'report') && (
            <Checklist
              lang={lang}
              shown={ckShown}
              enabled={stage === 'report' ? [3] : stage === 'play' ? [] : [1, 2]}
              away={stage === 'play' || destMode !== null}
              expanded={sheetFull}
              onExpand={setSheetFull}
              onTab={onTab}
              onAlbum={pois.length > 0 ? openAlbum : undefined}
            >
              {ckShown === 1 && <Briefing lang={lang} state={mission} onPlan={toPlan} />}
              {ckShown === 2 && <PlanPick lang={lang} state={mission} plan={plan} setPlan={setPlanUI} onGo={() => void goDay().catch(() => undefined)} onPick={startPick} pickMsg={pickMsg} explore={exploreInfo} />}
              {ckShown === 3 && report && <DayReportCard lang={lang} report={report} total={mission.days.length} final={mission.outcome !== null} onNext={afterReport} onNotebook={() => setNotebookOpen(true)} />}
            </Checklist>
          )}
          {destMode && (
            <div className="m3d-dest" role="status">
              <PinIcon />
              <span>{pickMsg ?? mt('pickPrompt', lang)}</span>
              <button className="btn secondary" onClick={cancelPick}>{mt('pickCancel', lang)}</button>
            </div>
          )}
          {guideVisible && <GuideRing target={GUIDE_TARGETS[guideNow]} />}
          {(stage === 'cargo' || stage === 'place') && (
            <div className="m3d-bar">
              <div className="m3d-time">
                <button className="rb" onClick={() => setPlaying(!playing)} aria-label={playing ? tx('pause', lang) : tx('play', lang)}>
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button className={`rb ${timeOpen ? 'on' : ''}`} onClick={() => setTimeOpen(!timeOpen)} aria-pressed={timeOpen} aria-label={tx('timeToggle', lang)}>
                  <ClockIcon />
                </button>
                <span className="m3d-clock">{dateLabel(disp.day)} {String(disp.hour).padStart(2, '0')}:00</span>
                {timeOpen && (
                  <>
                    <input type="range" aria-label={tx('day', lang)} min={0} max={data.dayCount - 1} step={1} value={disp.day} onChange={(e) => set(Number(e.target.value), timeRef.current.hour)} />
                    <input type="range" aria-label={tx('hour', lang)} min={0} max={23} step={1} value={disp.hour} onChange={(e) => set(Math.floor(timeRef.current.day), Number(e.target.value))} />
                  </>
                )}
              </div>
              {stage === 'place' && (
                <div className="m3d-dock">
                  {dockTypes.map((id) => (
                    <button key={id} className={`m3d-build ${placing === id ? 'on' : ''}`} disabled={remaining(id) <= 0} onClick={() => pickBuilding(id)} aria-label={tx(id, lang)} title={tx(id, lang)} aria-pressed={placing === id}>
                      <BuildingIcon id={id} />
                      <i className="m3d-count">{Math.max(0, remaining(id))}</i>
                    </button>
                  ))}
                  {placing && !directPlace && selected != null && (
                    <button className="rb go" onClick={() => place(placing, slots[selected])} aria-label={tx('confirm', lang)}>
                      <CheckIcon />
                    </button>
                  )}
                  {placing && (
                    <button className="rb stop" onClick={cancel} aria-label={tx('cancel', lang)}>
                      <CloseIcon />
                    </button>
                  )}
                  {extra.length > 0 && (
                    <button className="rb" onClick={resetPlacements} aria-label={tx('resetBuild', lang)}>
                      <RedoIcon />
                    </button>
                  )}
                  {allPlaced && (
                    <button className="btn primary compact" onClick={() => startTheMission()}>
                      {mt('startMission', lang)}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {stage === 'explore' && (
            <>
              {card ? <DiscoveryCard lang={lang} poi={card} onClose={closeCard} /> : <ExploreBar lang={lang} budget={exploreBudget} left={energyLeft} ending={outingEnding} onHome={endOuting} />}
            </>
          )}
          {stage === 'mode' && welcomeOpen && <WelcomeCard lang={lang} onStart={startExploring} />}
          {stage === 'mode' && !welcomeOpen && (
            <ModeSelect
              lang={lang}
              live={liveSt}
              busy={modeBusy}
              onArchive={() => {
                setMode('archive');
                setStage('cargo');
              }}
              onLive={() => void startLive()}
            />
          )}
          {stage === 'cargo' && <CargoPick lang={lang} picked={cargo} onToggle={toggleCargo} onNext={confirmCargo} />}
          {alarm && <AlarmOverlay lang={lang} seconds={ALARM_SECONDS} onRecall={() => recallRef.current?.(true)} />}
          {stage === 'end' && mission && mode === 'archive' && <EndScreen lang={lang} state={mission} onAgain={again} onSources={() => setSourcesOpen(true)} onLive={() => void startLive()} />}
          {stage === 'end' && mission && liveInfo && <LiveEnd lang={lang} state={mission} live={liveInfo} onArchive={again} onSources={() => setSourcesOpen(true)} onNotebook={() => setNotebookOpen(true)} />}
          {stage === 'mode' && !welcomeOpen && <PatiPose id="pose-wave" lang={lang} center />}
          {stage === 'cargo' && <PatiPose id="pose-main" lang={lang} center />}
          {stage === 'place' && <PatiPose id="pose-main" lang={lang} />}
          {alarm && <PatiPose id="pose-run" lang={lang} side="left" over />}
          {stage === 'end' && mission && mode === 'live' && <PatiPose id="pose-live" lang={lang} side="left" over />}
          {stage === 'end' && mission && mode === 'archive' && mission.outcome === 'earlyReturn' && (
            <>
              <PatiPose id="expr-sad" lang={lang} side="left" over small />
              <PatiPose id="pose-sit" lang={lang} side="right" over />
            </>
          )}
          {stage === 'end' && mission && mode === 'archive' && mission.outcome !== 'earlyReturn' && <PatiPose id={missionSucceeded(mission) ? 'pose-jump' : 'pose-sit'} lang={lang} side="left" over />}
          {notebookOpen && <Notebook lang={lang} day={notebookDay} report={stage === 'report' || stage === 'end' ? report : null} live={liveInfo} onClose={() => setNotebookOpen(false)} />}
          {bInfo && stage !== 'explore' && stage !== 'play' && !card && !album && !notebookOpen && !sourcesOpen && <BuildingCard lang={lang} id={bInfo.id} stat={bStat} onClose={closeBInfo} />}
          {album && <AlbumPanel lang={lang} pois={pois} found={album.found} earned={album.earned} onClose={() => setAlbum(null)} />}
          {sourcesOpen && <SourcesPanel lang={lang} meta={data.meta} datasets={rawDatasets(pois)} onClose={() => setSourcesOpen(false)} />}
        </div>
      )}

      {phase !== 'done' && (
        <div className="m3d-intro" onPointerDown={phase === 'run' ? skipIntroNow : undefined}>
          <div ref={wrapRef} className="m3d-intro-canvas">
            <Suspense fallback={null}>
              <IntroGlobe started={phase === 'run'} skip={skip} wrapRef={wrapRef} onDone={finishIntro} />
            </Suspense>
          </div>
          <PatiPose id="pose-wave" lang={lang} side="right" />
          <div className="m3d-intro-pati">
            <PatiAvatar mood="happy" lang={lang} big />
            {phase === 'run' && <div className="m3d-bubble">{tx('welcome', lang)}</div>}
          </div>
          {phase === 'gate' && (
            <div className="m3d-gate">
              <button className="btn primary m3d-start" onClick={startIntro}>
                <PlayIcon /> {tx('start', lang)}
              </button>
              <div className="m3d-lang" role="group" aria-label="language">
                <button className={lang === 'tr' ? 'on' : ''} onClick={() => setLang('tr')}>TR</button>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
              </div>
            </div>
          )}
          {phase === 'run' && <div className="m3d-skip">{tx('skip', lang)}</div>}
        </div>
      )}
    </div>
  );
}
