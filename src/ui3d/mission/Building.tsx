import { useEffect } from 'react';
import { BuildingIcon } from '../icons';
import type { L } from '../text';
import { BUILDING_TEXT, mt } from './text';
import type { MKey } from './text';

export interface BuildingStat {
  label: MKey;
  value: string;
}

/** Compact info card for a tapped building. One at a time; any tap (or Esc) closes it. */
export function BuildingCard({ lang, id, stat, onClose }: { lang: L; id: string; stat: BuildingStat[]; onClose: () => void }) {
  useEffect(() => {
    // the opening tap must not close it at once
    let on = false;
    const t = window.setTimeout(() => (on = true), 250);
    const close = () => on && onClose();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', key);
    };
  }, [id, onClose]);
  const txt = BUILDING_TEXT[id];
  if (!txt) return null;
  return (
    <aside className="bc-card" role="status" aria-live="polite">
      <span className="bc-ic">
        <BuildingIcon id={id as Parameters<typeof BuildingIcon>[0]['id']} />
      </span>
      <div className="bc-txt">
        <h2>{txt.name[lang]}</h2>
        <p>{txt.what[lang]}</p>
        {stat.map((s) => (
          <p key={s.label} className="bc-stat">
            {mt(s.label, lang)}: <b>{s.value}</b>
          </p>
        ))}
      </div>
    </aside>
  );
}
