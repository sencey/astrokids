import type { ReactNode } from 'react';
import { flareSize } from './skyMath';
import type { CloudState } from './skyMath';

interface Props {
  flareClass?: string | null;
  cloud?: CloudState | null;
  /** Fraction (0..1) along the track where the child's guess marker sits. */
  guessAt?: number | null;
  label?: ReactNode;
  ariaLabel: string;
  calm?: boolean;
}

/** Sun (left) -> base (right). The cloud's soft shadow width is the +-7 h forecast uncertainty. */
export default function SkyTrack({ flareClass, cloud, guessAt, label, ariaLabel, calm }: Props) {
  const size = flareSize(flareClass);
  const px = 30 + size * 90;
  return (
    <div className={`sky ${calm ? 'sky--calm' : ''}`} role="img" aria-label={ariaLabel}>
      <div className="sky__sun" style={{ ['--glow' as string]: `${px}px` }}>
        <span className={`sky__glow ${size > 0 ? 'sky__glow--on' : ''}`} />
        <span className="sky__disc" />
      </div>
      <div className="sky__line" />
      {cloud && (
        <>
          <div
            className="sky__shadow"
            style={{ left: `${cloud.progress * 84 + 8}%`, width: `${cloud.widthFrac * 84}%` }}
          />
          <svg className="sky__cloud" style={{ left: `${cloud.progress * 84 + 8}%` }} viewBox="0 0 90 56" aria-hidden="true">
            <g fill="#e8e1f7" opacity="0.95">
              <ellipse cx="30" cy="34" rx="24" ry="16" />
              <ellipse cx="52" cy="28" rx="22" ry="18" />
              <ellipse cx="66" cy="38" rx="18" ry="12" />
            </g>
            <ellipse cx="46" cy="40" rx="34" ry="8" fill="#b9a9e0" opacity="0.5" />
          </svg>
        </>
      )}
      {guessAt != null && (
        <div className="sky__guess" style={{ left: `${guessAt * 84 + 8}%` }} aria-hidden="true">
          <svg viewBox="0 0 30 40"><path d="M15 2 C5 2 3 14 15 38 C27 14 25 2 15 2 Z" fill="var(--accent)" stroke="#fff" strokeWidth="2" /><circle cx="15" cy="14" r="5" fill="#fff" /></svg>
        </div>
      )}
      <div className="sky__base" aria-hidden="true">
        <svg viewBox="0 0 70 50"><path d="M5 46 A30 30 0 0 1 65 46 Z" fill="var(--cream-2)" stroke="var(--cream-3)" strokeWidth="3" /><rect x="29" y="30" width="12" height="16" rx="5" fill="var(--accent)" /></svg>
      </div>
      {label && <div className="sky__label">{label}</div>}
    </div>
  );
}
