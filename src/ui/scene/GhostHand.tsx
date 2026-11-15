import { useEffect, useState } from 'react';

interface Props {
  /** CSS selectors of the element to start from and the element to end on. */
  from?: string;
  to: string;
}

/** A translucent hand that demonstrates a tap (no `from`) or a drag (`from` -> `to`). */
export default function GhostHand({ from, to }: Props) {
  const [pos, setPos] = useState<{ fx: number; fy: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const centre = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const t = centre(to);
      const f = from ? centre(from) : t;
      if (t && f) setPos({ fx: f.x, fy: f.y, tx: t.x, ty: t.y });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [from, to]);

  if (!pos) return null;
  const style = {
    '--fx': `${pos.fx}px`, '--fy': `${pos.fy}px`, '--tx': `${pos.tx}px`, '--ty': `${pos.ty}px`,
  } as React.CSSProperties;
  return (
    <div className={`ghost ${from ? 'ghost--drag' : 'ghost--tap'}`} style={style} aria-hidden="true">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <path
          d="M26 8 q4 -2 6 2 v18 l4 -2 q4 -1 5 3 l1 -1 q4 -1 5 3 l1 0 q4 0 5 4 v12 q0 12 -12 14 h-10 q-10 0 -14 -10 l-8 -14 q-1 -4 3 -5 q3 -1 5 2 l4 5 V12 q0 -3 3 -4z"
          fill="#fff"
          stroke="#1b2340"
          strokeWidth="2.5"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}
