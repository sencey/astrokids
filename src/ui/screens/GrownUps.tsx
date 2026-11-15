import { useEffect, useMemo, useState } from 'react';
import { BADGE_RULES } from '../../game/badges';
import { listRules } from '../../game/rules';
import type { Provenance } from '../../game/types';
import { resetAll } from '../../storage/store';
import { useApp } from '../AppContext';
import { compare, scenario } from '../data/loadScenario';
import { liveRuleHolds, loadLive } from '../data/live';
import type { LiveResult } from '../data/live';
import { BackIcon } from './icons';
import './grownups.css';

/** Deterministic shuffle (mulberry32) so the gate is stable within a day but not a fixed layout. */
function shuffled(seed: number): number[] {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Gate({ onPass, onBack }: { onPass: () => void; onBack: () => void }) {
  const { t } = useApp();
  const order = useMemo(() => shuffled(Math.floor(Date.now() / 86_400_000)), []);
  const [taps, setTaps] = useState<number[]>([]);
  const press = (n: number) => {
    const next = [...taps, n];
    if (next.length === 1) {
      setTaps(n === 7 ? next : []);
    } else if (next.length === 2) {
      if (next[0] === 7 && n === 3) onPass();
      else setTaps([]);
    }
  };
  return (
    <main className="screen gate">
      <button type="button" className="btn btn--round btn--ghost gate__back" aria-label={t('back')} onClick={onBack}>
        <BackIcon />
      </button>
      <h1>{t('gate.instruction')}</h1>
      <div className="gate__grid">
        {order.map((n) => (
          <button key={n} type="button" className="btn gate__btn" onClick={() => press(n)}>
            {n}
          </button>
        ))}
      </div>
    </main>
  );
}

const fmtValue = (v: unknown) => (typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function GrownUps({ onBack, skipGate }: { onBack: () => void; skipGate?: boolean }) {
  const { t, lang, settings, updateSettings } = useApp();
  const [open, setOpen] = useState(!!skipGate);
  const [live, setLive] = useState<LiveResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) void loadLive().then(setLive);
  }, [open]);

  if (!open) return <Gate onPass={() => setOpen(true)} onBack={onBack} />;

  const liveData = live?.status === 'ok' ? live.data : null;
  const liveOk = liveData ? liveRuleHolds(liveData) : false;
  const archiveSources: Provenance[] = [
    ...scenario.sources,
    ...compare.instruments.map((i) => i.provenance),
  ].filter((p, i, arr) => arr.findIndex((q) => q.sourceUrl === p.sourceUrl) === i);
  const rules = listRules();

  const slider = (key: 'music' | 'sfx' | 'voice', label: string) => (
    <label className="gu-row">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={settings[key]} onChange={(e) => updateSettings({ [key]: Number(e.target.value) })} />
    </label>
  );

  return (
    <main className="screen grownups">
      <header className="gu-head">
        <button type="button" className="btn btn--round btn--ghost" aria-label={t('back')} onClick={onBack}>
          <BackIcon />
        </button>
        <h1>{t('grownups')}</h1>
      </header>

      <section className="gu-card">
        <h2>{t('gu.settings')}</h2>
        <div className="gu-row">
          <span>{t('gu.language')}</span>
          <div className="gu-seg">
            {(['tr', 'en'] as const).map((l) => (
              <button key={l} type="button" className={`btn ${settings.lang === l ? 'btn--accent' : ''}`} aria-pressed={settings.lang === l} onClick={() => updateSettings({ lang: l })}>
                {l === 'tr' ? 'TÃ¼rkÃ§e' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <div className="gu-row">
          <span>{t('gu.captions')}</span>
          <div className="gu-seg">
            {(['auto', 'on', 'off'] as const).map((c) => (
              <button key={c} type="button" className={`btn ${settings.captions === c ? 'btn--accent' : ''}`} aria-pressed={settings.captions === c} onClick={() => updateSettings({ captions: c })}>
                {t(`gu.captions.${c}` as const)}
              </button>
            ))}
          </div>
        </div>
        {slider('music', t('gu.music'))}
        {slider('sfx', t('gu.sfx'))}
        {slider('voice', t('gu.voice'))}
        <label className="gu-row">
          <span>{t('gu.reduceMotion')}</span>
          <input type="checkbox" className="gu-check" checked={settings.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} />
        </label>
        <div className="gu-row">
          <span>{t('gu.reset')}</span>
          {!confirmReset ? (
            <button type="button" className="btn" onClick={() => setConfirmReset(true)}>{t('gu.reset')}</button>
          ) : (
            <button type="button" className="btn btn--accent" onClick={() => { void resetAll().then(() => { setDone(true); setConfirmReset(false); }); }}>
              {t('gu.resetConfirm')}
            </button>
          )}
          {done && <em>{t('gu.resetDone')}</em>}
        </div>
      </section>

      <section className="gu-card">
        <h2>{t('gu.privacy')}</h2>
        <p>{t('gu.privacyText')}</p>
        <h2>{t('gu.fiction')}</h2>
        <p>{t('gu.fictionText')}</p>
      </section>

      <section className="gu-card">
        <h2>{t('gu.legend')}</h2>
        <ul className="gu-legend">
          <li><span className="badge badge--live">{t('badge.live')}</span> {t('gu.legend.live')}</li>
          <li><span className="badge badge--archive">{t('badge.archive')}</span> {t('gu.legend.archive')}</li>
          <li><span className="badge badge--rule">{t('badge.rule')}</span> {t('gu.legend.rule')}</li>
        </ul>
      </section>

      <section className="gu-card">
        <h2>{t('gu.sources')}</h2>
        <ul className="gu-sources">
          {archiveSources.map((p) => (
            <li key={p.sourceUrl}>
              <span className="badge badge--archive">{t('badge.archive')}</span> <strong>{p.sourceId}</strong>
              <code>{p.sourceUrl}</code>
              <small>{t('gu.fetchedAt')}: {p.fetchedAt}</small>
            </li>
          ))}
          {liveData?.provenance.map((p) => (
            <li key={p.sourceUrl}>
              {liveOk && <span className="badge badge--live">{t('badge.live')}</span>} <strong>{p.sourceId}</strong>
              <code>{p.sourceUrl}</code>
              <small>{t('gu.fetchedAt')}: {p.fetchedAt}</small>
            </li>
          ))}
          {live && live.status !== 'ok' && <li>{t('sky.offlineText')}</li>}
        </ul>
      </section>

      <section className="gu-card">
        <h2>{t('gu.rules')}</h2>
        <div className="gu-table" role="table">
          <div role="row" className="gu-tr gu-tr--head">
            <span>{t('gu.rule')}</span><span>{t('gu.value')}</span><span>{t('gu.basis')}</span>
          </div>
          {rules.map(({ group, key, rule }) => (
            <div role="row" className="gu-tr" key={`${group}.${key}`}>
              <span><strong>{group}.{key}</strong><small>{rule.note}</small></span>
              <span>{fmtValue(rule.value)}</span>
              <span>
                {rule.isAssumption ? <span className="badge badge--rule">{t('badge.rule')}</span> : <span className="badge badge--archive">{t('gu.sourced')}</span>}
                {rule.source && <small>{rule.source}</small>}
              </span>
            </div>
          ))}
          {Object.entries(BADGE_RULES).map(([k, r]) => (
            <div role="row" className="gu-tr" key={k}>
              <span><strong>badge.{k}</strong><small>{r.note}</small></span>
              <span>{fmtValue(Object.fromEntries(Object.entries(r).filter(([n]) => n !== 'note' && n !== 'isAssumption')))}</span>
              <span><span className="badge badge--rule">{t('badge.rule')}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="gu-card">
        <h2>{t('gu.credits')}</h2>
        <p>{t('gu.creditsText')}</p>
        <p><small>{lang === 'tr' ? 'SÃ¼rÃ¼m' : 'Build'}: Space Apps 2026</small></p>
      </section>
    </main>
  );
}

