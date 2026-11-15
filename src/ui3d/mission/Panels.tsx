import { listMoonRules, MOON_RULES as R, missionSucceeded, summarize, earnedMoonBadges } from '../../game/moon';
import type { DayReport, MoonDay, MoonState } from '../../game/moon';
import type { TerrainMeta } from '../../three/types';
import { RadIcon, RedoIcon, ShieldIcon, StarIcon, SunIcon } from '../icons';
import type { L } from '../text';
import { tx } from '../text';
import { newestEarthCME, newestNotification } from '../../three/live/latest';
import type { LatestJson, LiveStatus } from '../../three/live/latest';
import type { TodayData } from '../../three/live/today';
import { BADGE_TEXT, factText, fmt1, mt, PLACE_TEXT } from './text';

export interface LiveInfo {
  latest: LatestJson | null;
  status: LiveStatus;
  today: TodayData | null;
}
const when = (iso: string, lang: L) => new Date(iso).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function LiveFacts({ lang, live }: { lang: L; live: LiveInfo }) {
  const l = live.latest;
  if (!l) return <li>{mt('liveNoData', lang)}</li>;
  const cme = newestEarthCME(l);
  const note = newestNotification(l);
  const fetched = live.status.fetchedAt ? when(live.status.fetchedAt, lang) : '?';
  return (
    <>
      <li>
        <b>{mt('liveCme', lang)}:</b>{' '}
        {cme ? `${cme.activityId} → ${when(cme.arrival, lang)} UTC${cme.speedKms ? `, ~${Math.round(cme.speedKms)} km/s` : ''}` : mt('liveNoCme', lang)}
        <small>NASA DONKI CME/ENLIL, {mt('liveFetched', lang)} {fetched}</small>
      </li>
      {note && (
        <li>
          <b>{mt('liveNotif', lang)}</b> ({note.messageType} {when(note.issueTime, lang)} UTC): {note.first}
          <small>NASA DONKI notifications, {mt('liveFetched', lang)} {fetched}</small>
        </li>
      )}
    </>
  );
}

export function Notebook({ lang, day, report, live, onClose }: { lang: L; day: MoonDay; report: DayReport | null; live?: LiveInfo; onClose: () => void }) {
  const crater = !live && day.date >= '2024-05-16';
  return (
    <div className="c3d-modal" onClick={onClose}>
      <div className="c3d-sheet" onClick={(e) => e.stopPropagation()}>
        {live ? (
          <div className={live.status.state === 'live' ? 'live-label' : 'c3d-archive'}>
            {live.status.state === 'live' ? mt('badgeLive', lang) : `${mt('lastUpdate', lang)} ${live.status.fetchedAt ? when(live.status.fetchedAt, lang) : '?'}`}
          </div>
        ) : (
          <div className="c3d-archive">{mt('archive', lang)}</div>
        )}
        <h3>{mt('notebook', lang)}: {day.date}</h3>
        <ul className="c3d-facts">
          <li>
            <b>{mt(day.sparkleBand, lang)}</b>
            {day.sparkleRatio !== null && (
              <> : {fmt1(day.sparkleRatio)} {mt('ratioWord', lang)}{crater ? ' (CRaTER, RadLab)' : day.radInstrument ? ` (${day.radInstrument})` : ''}</>
            )}
            {day.bandIsAssumption && <em> [{mt('assumption', lang)}]</em>}
          </li>
          {live && <LiveFacts lang={lang} live={live} />}
          {(report?.facts ?? []).map((f, i) => (
            <li key={i}>
              {factText(f, lang)}
              <small> {f.isAssumption ? `[${mt('assumption', lang)}] ` : ''}{f.source}</small>
            </li>
          ))}
        </ul>
        {crater && <small className="c3d-note">{mt('craterNote', lang)}</small>}
        <button className="c3d-primary" onClick={onClose}>{mt('close', lang)}</button>
      </div>
    </div>
  );
}

export function sunSetDate(sun: { date: string; hours: { elDeg: number }[] }[]): string | null {
  for (let k = 0; k < sun.length - 1; k++) {
    const maxEl = (i: number) => Math.max(...sun[i].hours.map((h) => h.elDeg));
    let allDown = true;
    for (let j = k + 1; j < sun.length; j++) if (maxEl(j) > 0) allDown = false;
    if (allDown && maxEl(k) > 0) return sun[k].date;
  }
  return null;
}

/** First mission date on which ALL placed towers are lit less than 10% of the day (null if never). */
export function towersDarkDate(state: MoonState): string | null {
  const towers = state.setup.towers;
  for (let i = 0; i < state.days.length; i++) {
    if (towers.length > 0 && towers.every((t) => (t.litPctByDay[i] ?? t.illumPct) < 10)) return state.days[i].date;
  }
  return null;
}

export function EndScreen({ lang, state, onAgain, onSources, onLive }: { lang: L; state: MoonState; onAgain: () => void; onSources: () => void; onLive: () => void }) {
  const sunDate = towersDarkDate(state);
  const s = summarize(state);
  const badges = earnedMoonBadges(state);
  const ok = missionSucceeded(state);
  const maxRatio = Math.max(...s.elsewhere.map((e) => e.ratio), 1);
  const story = sunDate
    ? mt('sunStoryTowers', lang).replace('{date}', new Date(`${sunDate}T00:00:00Z`).toLocaleDateString(lang, { day: 'numeric', month: 'long', timeZone: 'UTC' }))
    : mt('sunStoryNone', lang);
  return (
    <div className="c3d-modal solid">
      <div className="c3d-sheet wide">
        <h2>{mt('endTitle', lang)}</h2>
        <p className={`c3d-result ${ok ? 'ok' : ''}`}>{state.outcome === 'earlyReturn' ? mt('endEarly', lang) : mt('endDone', lang)}</p>
        <div className="c3d-endrow">
          <span><StarIcon className="gold" /> {s.totals.science}</span>
          <span><RadIcon className="rad" /> {s.totals.finalDose}</span>
          <span><ShieldIcon className="gold" /> {s.totals.finalBerm}</span>
          {badges.map((b) => (
            <span key={b} className="c3d-badge">{BADGE_TEXT[b][lang]}</span>
          ))}
        </div>
        <p><RadIcon className="rad" /> {mt('doseNow', lang)}: <b>{s.totals.finalDose}</b> / {R.radiation.doseLimit.value} &nbsp; | &nbsp; {mt('noShield', lang)}: <b>{s.whatIfNoBermDose}</b></p>
        <h4>{mt('stormElsewhere', lang)}</h4>
        <div className="c3d-bars">
          {s.elsewhere.map((e) => (
            <div key={e.instrument}>
              <span>{(PLACE_TEXT[e.place] ?? { tr: e.place, en: e.place })[lang]}</span>
              <i style={{ width: `${Math.max(2, (Math.log10(Math.max(1, e.ratio)) / Math.log10(maxRatio + 1)) * 100)}%` }} />
              <b>×{Math.round(e.ratio * 10) / 10}</b>
            </div>
          ))}
        </div>
        <p className="c3d-sun">{story}</p>
        <p className="c3d-lesson">{mt('lesson', lang)}</p>
        <div className="c3d-row">
          <button className="c3d-primary" onClick={onAgain}><RedoIcon /> {mt('tryAgain', lang)}</button>
          <button className="c3d-secondary" onClick={onLive}>{mt('toLive', lang)}</button>
          <button className="c3d-secondary" onClick={onSources}>{mt('sources', lang)}</button>
        </div>
      </div>
    </div>
  );
}

/** Result screen of the single LIVE day: what the real Sun and real space weather did today. No invented numbers. */
export function LiveEnd({ lang, state, live, onArchive, onSources, onNotebook }: { lang: L; state: MoonState; live: LiveInfo; onArchive: () => void; onSources: () => void; onNotebook: () => void }) {
  const r = state.reports[0];
  const t = live.today;
  const day = state.days[0];
  const el = t ? Math.round(t.maxSunEl * 10) / 10 : null;
  return (
    <div className="c3d-modal solid">
      <div className="c3d-sheet wide">
        <div className={live.status.state === 'live' ? 'live-label' : 'c3d-archive'}>
          {live.status.state === 'live' ? mt('badgeLive', lang) : `${mt('lastUpdate', lang)} ${live.status.fetchedAt ? when(live.status.fetchedAt, lang) : '?'}`}
        </div>
        <h2>{mt('liveEndTitle', lang)}</h2>
        {t && <p>{el !== null && el > 0 ? mt('liveSunUp', lang).replace('{el}', String(el)) : mt('liveSunDown', lang)}</p>}
        <div className="c3d-endrow">
          {state.setup.towers.map((tw, i) => (
            <span key={i}>
              <SunIcon className="gold" /> {Math.round(tw.litPctByDay[0] ?? 0)}% <small>{mt('liveTower', lang)}</small>
            </span>
          ))}
        </div>
        <p>{live.latest ? (day.sparkleBand === 'calm' ? mt('liveCalm', lang) : mt('liveStorm', lang)) : mt('liveNoData', lang)}</p>
        {r && (
          <div className="c3d-endrow">
            <span><RadIcon className="rad" /> +{r.dose.amount}</span>
            <span><StarIcon className="gold" /> {r.science.gained}</span>
          </div>
        )}
        <ul className="c3d-facts">
          {live.latest && <LiveFacts lang={lang} live={live} />}
        </ul>
        <small className="c3d-note">{mt('liveNote', lang)}</small>
        <p className="c3d-lesson">{mt('liveAgain', lang)}</p>
        <div className="c3d-row">
          <button className="c3d-primary" onClick={onArchive}><RedoIcon /> {mt('toArchive', lang)}</button>
          <button className="c3d-secondary" onClick={onNotebook}>{mt('notebook', lang)}</button>
          <button className="c3d-secondary" onClick={onSources}>{mt('sources', lang)}</button>
        </div>
      </div>
    </div>
  );
}

const show = (v: unknown): string => (typeof v === 'object' ? JSON.stringify(v) : String(v));

export function SourcesPanel({ lang, meta, datasets = [], onClose }: { lang: L; meta: TerrainMeta; datasets?: { name: string; url: string; citation: string }[]; onClose: () => void }) {
  const rules = listMoonRules();
  const groups = [...new Set(rules.map((r) => r.group))];
  return (
    <div className="c3d-modal" onClick={onClose}>
      <div className="c3d-sheet wide" onClick={(e) => e.stopPropagation()}>
        <h3>{mt('sources', lang)}</h3>
        <p className="c3d-archive">{mt('archive', lang)}</p>
        <p>{tx('fillNote', lang)}</p>
        <h4>{mt('dataTitle', lang)}</h4>
        <ul className="c3d-facts">
          <li>{lang === 'tr' ? meta.nameTr : meta.nameEn}</li>
          {meta.sources.map((s) => (
            <li key={s.sourceId}>{s.citation}</li>
          ))}
        </ul>
        {datasets.length > 0 && (
          <>
            <h4>{mt('exploreDatasets', lang)}</h4>
            <ul className="c3d-facts">
              {datasets.map((d) => (
                <li key={d.name}>
                  <b>{d.name}</b>: {d.citation}
                  <small>{d.url}</small>
                </li>
              ))}
            </ul>
          </>
        )}
        <h4>{mt('rulesTitle', lang)}</h4>
        {groups.map((g) => (
          <details key={g}>
            <summary>{g}</summary>
            <table className="c3d-rules">
              <tbody>
                {rules.filter((r) => r.group === g).map((r) => (
                  <tr key={r.key}>
                    <td>{r.key}</td>
                    <td><b>{show(r.rule.value)}</b></td>
                    <td className={r.rule.isAssumption ? 'asm' : 'src'}>{r.rule.isAssumption ? mt('assumption', lang) : mt('measured', lang)}{r.rule.source ? `: ${r.rule.source}` : ''}</td>
                    <td>{r.rule.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
        <button className="c3d-primary" onClick={onClose}>{mt('close', lang)}</button>
      </div>
    </div>
  );
}
