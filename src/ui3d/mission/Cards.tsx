import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { fmtDist, trimPlan } from './plan';
import type { DestMode } from './plan';
import { MOON_RULES as R, NO_PLAN, planCosts, towerEnergy, litPct } from '../../game/moon';
import type { CargoItem, DayReport, MoonPlan, MoonState } from '../../game/moon';
import { BellIcon, BoltIcon, BuildingIcon, CalmIcon, CheckIcon, FlagIcon, HomeIcon, IceIcon, PinIcon, PlusIcon, RadIcon, ShieldIcon, StarIcon, StormIcon, SunIcon, TankIcon, WalkIcon, BookIcon } from '../icons';
import { EXPLORE_STEPS, fitExplore } from './exploreData';
import type { LiveStatus } from '../../three/live/latest';
import type { L } from '../text';
import { EVENT_TEXT, mt } from './text';

export const CARGO: CargoItem[] = ['extraTower', 'batteryBank', 'greenhouse'];

function CargoIcon({ id }: { id: CargoItem }) {
  if (id === 'extraTower')
    return (
      <span className="c3d-pair">
        <BuildingIcon id="solarTower" />
        <PlusIcon className="c3d-plus" />
      </span>
    );
  if (id === 'batteryBank') return <BoltIcon />;
  return <BuildingIcon id="greenhouse" />;
}

export function CargoPick({ lang, picked, onToggle, onNext }: { lang: L; picked: CargoItem[]; onToggle: (c: CargoItem) => void; onNext: () => void }) {
  return (
    <div className="c3d-overlay">
      <div className="c3d-panel">
        <div className="c3d-row big">
          {CARGO.map((c) => (
            <button key={c} className={`c3d-card ${picked.includes(c) ? 'on' : ''}`} onClick={() => onToggle(c)} aria-pressed={picked.includes(c)}>
              <CargoIcon id={c} />
              <span>{mt(c, lang)}</span>
              {picked.includes(c) && <CheckIcon className="c3d-tick" />}
            </button>
          ))}
        </div>
        <button className="btn primary" disabled={picked.length !== 2} onClick={onNext}>
          {picked.length === 2 ? mt('cargoNext', lang) : mt('cargoPick2', lang)} ({picked.length}/2)
        </button>
      </div>
    </div>
  );
}

/** Energy as sun-gold bolts on a small cobalt screen (gold on white would not read). */
const Bolts = ({ n, cls = '', label }: { n: number; cls?: string; label?: string }) => (
  <span className={`chip bolts ${cls}`} role="img" aria-label={`${label ?? ''} ${n}`.trim()}>
    {Array.from({ length: Math.min(n, 12) }, (_, i) => (
      <BoltIcon key={i} />
    ))}
    {n > 12 && <small>+{n - 12}</small>}
    {n === 0 && <small>0</small>}
  </span>
);

const dayTitle = (lang: L, n: number) => mt('dayN', lang).replace('{n}', String(n));

function PageHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <header className="ck-head">
      <h2>{title}</h2>
      {aside}
    </header>
  );
}

/** Page 1: today's briefing. */
export function Briefing({ lang, state, onPlan }: { lang: L; state: MoonState; onPlan: () => void }) {
  const d = state.days[state.cursor];
  const idx = state.cursor;
  const Weather = d.sparkleBand === 'calm' ? CalmIcon : StormIcon;
  const prod = state.setup.towers.map((t) => towerEnergy(t, idx));
  const total = prod.reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHead
        title={dayTitle(lang, state.cursor + 1)}
        aside={
          <span className="ck-date">
            {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' })} · {state.cursor + 1}/{state.days.length}
          </span>
        }
      />
      <div className="ck-body">
        <div className={`ck-weather ${d.sparkleBand}`}>
          <Weather />
          <span>{mt(d.sparkleBand, lang)}</span>
          {d.alarmAt && <BellIcon className="ck-bell" />}
        </div>
        {d.alertOngoing && (
          <p className="ck-note">
            <RadIcon /> {mt('alertOngoing', lang)}
          </p>
        )}
        {d.alarmAt && <p className="ck-note">{mt('alarmExpected', lang)}</p>}
        <ul className="ck-towers">
          {state.setup.towers.map((t, i) => (
            <li key={i}>
              <BuildingIcon id="solarTower" />
              <span className="ck-suns" role="img" aria-label={`${Math.round(litPct(t, idx))}%`}>
                {Array.from({ length: 5 }, (_, k) => (
                  <SunIcon key={k} className={k < Math.ceil(litPct(t, idx) / 20) ? 'on' : ''} />
                ))}
              </span>
              <Bolts n={prod[i]} />
            </li>
          ))}
        </ul>
        <div className="ck-sum">
          <span>{mt('energyToday', lang)}</span>
          <Bolts n={total} />
        </div>
      </div>
      <footer className="ck-foot">
        <button className="btn primary" onClick={onPlan} data-guide="plan-btn">{mt('plan', lang)}</button>
      </footer>
    </>
  );
}

type ActionId = 'keepRunning' | 'iceTrip' | 'greenhouse' | 'shield' | 'walkRim' | 'walkIce';
interface ActionDef {
  id: ActionId;
  icon: ReactNode;
  apply: (p: MoonPlan) => MoonPlan;
  on: (p: MoonPlan) => boolean;
  only: (p: MoonPlan) => MoonPlan;
  pick?: DestMode;
}
const ACTIONS: ActionDef[] = [
  {
    id: 'keepRunning',
    icon: <HomeIcon />,
    apply: (p) => ({ ...p, keepRunning: !p.keepRunning }),
    on: (p) => p.keepRunning,
    only: () => ({ ...NO_PLAN, keepRunning: true }),
  },
  {
    id: 'iceTrip',
    icon: <IceIcon />,
    apply: (p) => (p.iceTrip ? { ...p, iceTrip: false, iceTargetDistanceM: undefined } : { ...p, iceTrip: true, iceTargetDistanceM: undefined }),
    on: (p) => p.iceTrip,
    only: (p) => ({ ...NO_PLAN, iceTrip: true, iceTargetDistanceM: p.iceTrip ? p.iceTargetDistanceM : undefined }),
    pick: 'ice',
  },
  {
    id: 'greenhouse',
    icon: <BuildingIcon id="greenhouse" />,
    apply: (p) => ({ ...p, greenhouse: !p.greenhouse }),
    on: (p) => p.greenhouse,
    only: () => ({ ...NO_PLAN, greenhouse: true }),
  },
  {
    id: 'shield',
    icon: <ShieldIcon />,
    apply: (p) => ({ ...p, shield: !p.shield }),
    on: (p) => p.shield,
    only: () => ({ ...NO_PLAN, shield: true }),
  },
  {
    id: 'walkRim',
    icon: (
      <span className="c3d-pair">
        <WalkIcon />
        <SunIcon />
      </span>
    ),
    apply: (p) => (p.scienceWalk === 'rim' ? { ...p, scienceWalk: null, walkTargetDistanceM: undefined } : { ...p, scienceWalk: 'rim', walkTargetDistanceM: undefined }),
    on: (p) => p.scienceWalk === 'rim',
    only: (p) => ({ ...NO_PLAN, scienceWalk: 'rim', walkTargetDistanceM: p.scienceWalk === 'rim' ? p.walkTargetDistanceM : undefined }),
    pick: 'walk',
  },
  {
    id: 'walkIce',
    icon: (
      <span className="c3d-pair">
        <WalkIcon />
        <IceIcon />
      </span>
    ),
    apply: (p) => (p.scienceWalk === 'ice' ? { ...p, scienceWalk: null, walkTargetDistanceM: undefined } : { ...p, scienceWalk: 'ice', walkTargetDistanceM: undefined }),
    on: (p) => p.scienceWalk === 'ice',
    only: (p) => ({ ...NO_PLAN, scienceWalk: 'ice', walkTargetDistanceM: p.scienceWalk === 'ice' ? p.walkTargetDistanceM : undefined }),
    pick: 'walk',
  },
];

/** The gives chip: tank (air), dose shield, science star. */
function Gives({ kind }: { kind: 'air' | 'dose' | 'star' }) {
  return <span className="chip gives">{kind === 'air' ? <TankIcon className="gv-air" /> : kind === 'dose' ? <ShieldIcon className="gv-dose" /> : <StarIcon className="gv-star" />}</span>;
}
const GIVES: Record<ActionId, 'air' | 'dose' | 'star'> = { keepRunning: 'air', iceTrip: 'air', greenhouse: 'air', shield: 'dose', walkRim: 'star', walkIce: 'star' };

/** Why an action is locked, in a few words. null = available. */
function lockReason(state: MoonState, a: ActionDef, plan: MoonPlan, lang: L): string | null {
  const next = a.apply(plan);
  const c = planCosts(state, next);
  if (c.affordable) return null;
  const errs = c.errors.join(' | ');
  if (a.id === 'shield' && errs.includes('Berm')) return mt('shieldMax', lang);
  if ((a.id === 'walkRim' || a.id === 'walkIce') && errs.includes('cancelled')) return mt('noWalkToday', lang);
  if (a.id === 'iceTrip' && errs.includes('No ice')) return mt('noIce', lang);
  if (a.id === 'greenhouse' && errs.includes('No greenhouse')) return mt('noGreenhouse', lang);
  return mt('noEnergy', lang);
}

/** Page 2: choose the day's actions. */
/** The outing row of the plan page; undefined = exploration is not available (no data), hidden. */
export interface ExplorePlan {
  /** energy assigned to the outing: 0 (none), 2, 4 or 6 */
  energy: number;
  setEnergy: (n: number) => void;
  /** why the outing is locked today (storm, alert), or null */
  locked: string | null;
}

function ExploreRow({ lang, ex, left }: { lang: L; ex: ExplorePlan; left: number }) {
  const locked = ex.locked !== null;
  return (
    <li className="act-wrap">
      <div className={`act xp-act ${ex.energy > 0 ? 'on' : ''} ${locked ? 'locked' : ''}`} role="group" aria-label={mt('exploreRow', lang)} data-guide="act-explore">
        <span className="act-ic">
          <FlagIcon />
          {ex.energy > 0 && <CheckIcon className="act-check" />}
        </span>
        <span className="act-txt">
          <span className="act-name">{mt('exploreRow', lang)}</span>
          <span className="xp-chips" role="group" aria-label={mt('exploreAmount', lang)}>
            {EXPLORE_STEPS.map((n) => {
              const on = ex.energy === n;
              return (
                <button key={n} className={`xp-chip ${on ? 'on' : ''}`} disabled={locked || (!on && n > left + ex.energy)} aria-pressed={on} onClick={() => ex.setEnergy(on ? 0 : n)}>
                  <BoltIcon />
                  <b>{n}</b>
                </button>
              );
            })}
          </span>
        </span>
      </div>
      {locked && <p className="act-reason">{ex.locked}</p>}
    </li>
  );
}

export function PlanPick({ lang, state, plan, setPlan, onGo, onPick, pickMsg, explore }: { lang: L; state: MoonState; plan: MoonPlan; setPlan: (p: MoonPlan) => void; onGo: () => void; onPick: (m: DestMode) => void; pickMsg: string | null; explore?: ExplorePlan }) {
  const cur = planCosts(state, plan);
  const [trimmed, setTrimmed] = useState(false);
  const [exTrimmed, setExTrimmed] = useState(false);
  useEffect(() => {
    if (!planCosts(state, plan).affordable) {
      setPlan(trimPlan(state, plan).plan);
      setTrimmed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, plan]);
  const exE = explore?.energy ?? 0;
  const setExE = explore?.setEnergy;
  const poolLeft = Math.max(0, cur.available - cur.total);
  // a later choice may take the energy the outing was promised: shrink the outing to the biggest step that still fits
  useEffect(() => {
    if (exE > poolLeft && setExE) {
      setExE(fitExplore(exE, poolLeft));
      setExTrimmed(true);
    }
  }, [exE, poolLeft, setExE]);
  const left = Math.max(0, poolLeft - exE);
  const visible = ACTIONS.filter((a) => (a.id === 'greenhouse' ? state.setup.greenhouse !== null : true));
  return (
    <>
      <PageHead title={mt('planTitle', lang)} />
      <div className="ck-body">
        <div className="ck-sum" aria-live="polite">
          <span>{mt('energyLeft', lang)}</span>
          <span className="ck-pool">
            <Bolts n={left} />
            {cur.total + exE > 0 && <Bolts n={cur.total + exE} cls="spent" />}
          </span>
        </div>
        <ul className="ck-acts">
          {visible.map((a) => {
            const isOn = a.on(plan);
            const reason = isOn ? null : lockReason(state, a, plan, lang);
            const cost = planCosts(state, a.only(plan)).total;
            const target = a.id === 'iceTrip' ? plan.iceTargetDistanceM : a.id === 'walkRim' || a.id === 'walkIce' ? plan.walkTargetDistanceM : undefined;
            return (
              <li key={a.id} className="act-wrap">
                <button className={`act ${isOn ? 'on' : ''}`} disabled={reason !== null} onClick={() => setPlan(a.apply(plan))} aria-pressed={isOn} data-guide={`act-${a.id}`}>
                  <span className="act-ic">
                    {a.icon}
                    {isOn && <CheckIcon className="act-check" />}
                  </span>
                  <span className="act-txt">
                    <span className="act-name">{mt(a.id, lang)}</span>
                    <span className="act-gives">
                      <Gives kind={GIVES[a.id]} />
                    </span>
                  </span>
                  <Bolts n={cost} label={mt('cost', lang)} />
                </button>
                {reason && <p className="act-reason">{reason}</p>}
                {a.pick && (
                  <div className="act-pick">
                    <button className="btn secondary sm" disabled={reason !== null} onClick={() => onPick(a.pick as DestMode)}>
                      <PinIcon /> {mt('planHintPick', lang)}
                    </button>
                    {isOn && target !== undefined && (
                      <span className="act-dist">
                        {fmtDist(target, lang)}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {explore && <ExploreRow lang={lang} ex={explore} left={left} />}
        </ul>
        {(pickMsg ?? (trimmed ? mt('trimmed', lang) : exTrimmed ? mt('exploreTrimmed', lang) : null)) && (
          <p className="ck-note" aria-live="polite">{pickMsg ?? (trimmed ? mt('trimmed', lang) : mt('exploreTrimmed', lang))}</p>
        )}
      </div>
      <footer className="ck-foot">
        <button className="btn primary" disabled={!cur.affordable} onClick={onGo} data-guide="go-btn">{mt('go', lang)}</button>
      </footer>
    </>
  );
}

export function AlarmOverlay({ lang, seconds, onRecall }: { lang: L; seconds: number; onRecall: () => void }) {
  return (
    <div className="c3d-alarm" role="alert">
      <BellIcon className="c3d-alarm-bell" />
      <b>{mt('alarm', lang)}</b>
      <button className="btn c3d-recall" onClick={onRecall}>{mt('recall', lang)}</button>
      <div className="c3d-timer"><i style={{ animationDuration: `${seconds}s` }} /></div>
    </div>
  );
}

function MiniTank({ f }: { f: number }) {
  const v = Math.max(0, Math.min(1, f));
  return (
    <svg viewBox="0 0 32 44" className="rp-tank" role="img" aria-hidden="true">
      <clipPath id={`rp-tank-${Math.round(f * 1000)}`}>
        <rect x="5" y="8" width="22" height="33" rx="8" />
      </clipPath>
      <g clipPath={`url(#rp-tank-${Math.round(f * 1000)})`}>
        <rect x="5" y={8 + 33 * (1 - v)} width="22" height={33 * v} className="rp-tank-fill" />
      </g>
      <rect x="5" y="8" width="22" height="33" rx="8" className="rp-tank-line" />
      <path d="M12 3h8" className="rp-tank-line" />
    </svg>
  );
}

/** Page 3: what the day cost and gave. */
export function DayReportCard({ lang, report, total, final, onNext, onNotebook }: { lang: L; report: DayReport; total: number; final: boolean; onNext: () => void; onNotebook: () => void }) {
  const lifeMax = R.life.max.value;
  const where = report.dose.where;
  return (
    <>
      <PageHead title={mt('reportTitle', lang)} aside={<span className="ck-date">{report.dayIndex}/{total}</span>} />
      <div className="ck-body" data-guide="report">
        <ul className="rp">
          <li>
            <Bolts n={report.energy.produced} />
            <span className="rp-arrow" aria-hidden="true">→</span>
            <Bolts n={report.energy.spent.total} cls="spent" />
          </li>
          <li>
            <MiniTank f={report.life.before / lifeMax} />
            <span className="rp-arrow" aria-hidden="true">→</span>
            <MiniTank f={report.life.after / lifeMax} />
          </li>
          <li>
            <span className="chip gives">
              <RadIcon className="gv-dose" />
              {where === 'inside' ? <HomeIcon /> : <WalkIcon />}
              {Array.from({ length: report.dose.bermLevel }, (_, i) => <ShieldIcon key={i} />)}
              <b>+{report.dose.amount}</b>
            </span>
            <small>{mt(where === 'inside' ? 'inside' : where === 'outsideRecalled' ? 'outsideRecalled' : 'outsideFull', lang)}</small>
          </li>
          {report.science.gained > 0 && (
            <li>
              <span className="chip gives">
                {Array.from({ length: report.science.gained }, (_, i) => <StarIcon key={i} className="gv-star" />)}
              </span>
            </li>
          )}
        </ul>
        {report.events.length > 0 && (
          <div className="c3d-chips">
            {report.events.map((e) => (
              <span key={e} className={`c3d-chip ev-${e}`}>{EVENT_TEXT[e][lang]}</span>
            ))}
          </div>
        )}
      </div>
      <footer className="ck-foot two">
        <button className="btn secondary" onClick={onNotebook}><BookIcon /> {mt('notebook', lang)}</button>
        <button className="btn primary" onClick={onNext} data-guide="next-day">{final ? mt('seeEnd', lang) : mt('nextDay', lang)}</button>
      </footer>
    </>
  );
}

export function ModeSelect({ lang, live, busy, onArchive, onLive }: { lang: L; live: LiveStatus; busy: boolean; onArchive: () => void; onLive: () => void }) {
  const when = live.fetchedAt ? new Date(live.fetchedAt).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="c3d-overlay">
      <div className="c3d-panel">
        <div className="c3d-row big">
          <button className="c3d-card rec" onClick={onArchive}>
            <StormIcon />
            <span className="mname">{mt('modeArchive', lang)}</span>
            <small className="c3d-badge2 arch">{mt('badgeArchive', lang)}</small>
          </button>
          <button className="c3d-card" onClick={onLive} disabled={busy}>
            <SunIcon />
            <span className="mname">{mt('modeLive', lang)}</span>
            {live.state === 'live' ? (
              <small className="c3d-badge2 live">{mt('badgeLive', lang)}</small>
            ) : (
              <small className="c3d-badge2 stale">{live.state === 'offline' ? mt('offline', lang) : `${mt('lastUpdate', lang)} ${when ?? ''}`}</small>
            )}
          </button>
        </div>
        {busy && <small className="c3d-note">{mt('liveComputing', lang)}</small>}
      </div>
    </div>
  );
}
