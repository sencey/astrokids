// Small SVG art pieces for the base scene. Resources are physical objects, never bars or percentages.

/** A bowl with `max` visible notches; `level` of them are filled. */
export function Bowl({ level, max, kind, label }: { level: number; max: number; kind: 'water' | 'food'; label: string }) {
  const color = kind === 'water' ? 'var(--water)' : 'var(--food)';
  const top = 30;
  const bottom = 76;
  const h = (bottom - top) / max;
  const id = `bowlclip-${kind}`;
  return (
    <svg className={`bowl bowl--${kind}`} viewBox="0 0 120 96" role="img" aria-label={label}>
      <defs>
        <clipPath id={id}>
          <path d="M12 30 H108 Q108 84 60 86 Q12 84 12 30 Z" />
        </clipPath>
      </defs>
      <path d="M12 30 H108 Q108 84 60 86 Q12 84 12 30 Z" fill="rgba(255,255,255,0.35)" stroke="#8a6a3c" strokeWidth="4" />
      <g clipPath={`url(#${id})`}>
        {Array.from({ length: max }, (_, i) => {
          const filled = i < level;
          return (
            <rect
              key={i}
              className={filled ? 'notch notch--on' : 'notch'}
              x="14"
              y={bottom + 10 - (i + 1) * h}
              width="92"
              height={h - 1.6}
              rx="2"
              fill={filled ? color : 'rgba(27,35,64,0.12)'}
            />
          );
        })}
      </g>
      <ellipse cx="60" cy="30" rx="48" ry="6" fill="none" stroke="#8a6a3c" strokeWidth="4" />
      {kind === 'water' && level > 0 && <ellipse cx="46" cy="30" rx="10" ry="2" fill="#fff" opacity="0.5" />}
    </svg>
  );
}

/** Glass jar with sparkles. Capacity is shown by the jar's size, not by a bar. */
export function Jar({ count, capacity, label, pulse }: { count: number; capacity: number; label: string; pulse?: boolean }) {
  const cols = 5;
  const dots = Array.from({ length: Math.min(count, capacity) }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const jx = Math.sin(i * 12.9898) * 3;
    return { x: 22 + col * 11.5 + jx + (row % 2) * 4, y: 98 - row * 11, d: (i % 5) * 0.4 };
  });
  return (
    <svg className={`jar ${pulse ? 'jar--pulse' : ''}`} viewBox="0 0 90 112" role="img" aria-label={label}>
      <rect x="22" y="4" width="46" height="12" rx="5" fill="#8a6a3c" />
      <path d="M26 16 H64 Q80 22 80 44 V94 Q80 108 66 108 H24 Q10 108 10 94 V44 Q10 22 26 16 Z" fill="var(--glass)" stroke="#dfeaff" strokeWidth="3" />
      <path d="M18 44 V90" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      {dots.map((d, i) => (
        <circle key={i} className="spark" cx={d.x} cy={d.y} r="4.2" fill="var(--spark)" style={{ animationDelay: `${d.d}s` }} />
      ))}
    </svg>
  );
}

export function WaterMachine() {
  return (
    <svg className="art art--water" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="30" y="14" width="100" height="70" rx="18" fill="#cdd9e8" stroke="#8da0b8" strokeWidth="4" />
      <rect x="42" y="26" width="76" height="46" rx="12" fill="#7fb8e6" opacity="0.55" />
      <circle className="bubble b1" cx="62" cy="62" r="5" fill="#fff" />
      <circle className="bubble b2" cx="82" cy="64" r="4" fill="#fff" />
      <circle className="bubble b3" cx="100" cy="62" r="6" fill="#fff" />
      <rect x="70" y="84" width="20" height="16" fill="#8da0b8" />
      <path d="M130 50 H148 V104" stroke="#8da0b8" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Garden({ level, max, droop }: { level: number; max: number; droop: number }) {
  const ratio = level / max;
  const auto = ratio < 0.4 ? (0.4 - ratio) / 0.4 : 0;
  const d = Math.min(1, Math.max(auto, droop));
  const h = 22 + 36 * ratio;
  return (
    <svg className="art art--garden" viewBox="0 0 200 120" aria-hidden="true">
      <rect x="10" y="92" width="180" height="22" rx="10" fill="#8b5e3c" />
      {[34, 69, 104, 139, 168].map((x, i) => {
        const ang = d * (i % 2 ? 58 : -52);
        return (
          <g key={x} className="plant" style={{ transformOrigin: `${x}px 94px`, transform: `rotate(${ang}deg)`, animationDelay: `${i * 0.3}s` }}>
            <path d={`M${x} 94 V${94 - h - i * 3}`} stroke="#3f9b4c" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx={x - 8} cy={94 - h - i * 3 + 4} rx="9" ry="5" fill="#5cc067" transform={`rotate(-30 ${x - 8} ${94 - h - i * 3 + 4})`} />
            <ellipse cx={x + 8} cy={94 - h - i * 3 + 4} rx="9" ry="5" fill="#74d27d" transform={`rotate(30 ${x + 8} ${94 - h - i * 3 + 4})`} />
          </g>
        );
      })}
    </svg>
  );
}

/** Doghouse with 0-3 visible brick layers; the crew's helmets show in the open door. */
export function DoghouseArt({ wall }: { wall: number }) {
  const house = 'M30 150 V80 L90 28 L150 80 V150 Z';
  return (
    <svg className="art art--house" viewBox="0 0 180 160" aria-hidden="true">
      <defs>
        <pattern id="bricks" width="24" height="12" patternUnits="userSpaceOnUse">
          <rect width="24" height="12" fill="#c98a5a" />
          <path d="M0 0 H24 M0 6 H24 M6 0 V6 M18 6 V12" stroke="#a86a3f" strokeWidth="1.6" fill="none" />
        </pattern>
      </defs>
      {[3, 2, 1].map(
        (k) =>
          wall >= k && (
            <g key={k} className="wall-layer" transform={`translate(90 110) scale(${1 + 0.085 * k}) translate(-90 -110)`}>
              <path d={house} fill="url(#bricks)" stroke="#8a4f2a" strokeWidth="3" strokeLinejoin="round" />
            </g>
          ),
      )}
      <path d={house} fill="#f1ddb5" stroke="#8a4f2a" strokeWidth="4" strokeLinejoin="round" />
      <path d="M22 84 L90 24 L158 84" stroke="var(--accent)" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Astronaut({ bag, className }: { bag?: boolean; className?: string }) {
  return (
    <svg className={`astro ${className ?? ''}`} viewBox="0 0 50 70" aria-hidden="true">
      <rect x="9" y="26" width="32" height="30" rx="10" fill="#f4f4fa" stroke="#aab" strokeWidth="2" />
      <rect x="14" y="52" width="9" height="14" rx="4" fill="#e6e6f0" />
      <rect x="27" y="52" width="9" height="14" rx="4" fill="#e6e6f0" />
      <circle cx="25" cy="18" r="14" fill="#f4f4fa" stroke="#aab" strokeWidth="2" />
      <ellipse cx="25" cy="18" rx="9.5" ry="8" fill="#243061" />
      <ellipse cx="22" cy="15" rx="3" ry="2" fill="#7e90e6" opacity="0.8" />
      <rect x="22" y="34" width="7" height="7" rx="2" fill="var(--accent)" />
      {bag && (
        <g>
          <path d="M36 34 q10 2 8 14 q-6 4 -12 0 z" fill="#a8743c" stroke="#7a5128" strokeWidth="1.6" />
          <path d="M35 36 l5 -3" stroke="#7a5128" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

export function SolarPanel() {
  return (
    <svg className="art art--solar" viewBox="0 0 120 100" aria-hidden="true">
      <path d="M60 94 V56" stroke="#8da0b8" strokeWidth="6" strokeLinecap="round" />
      <path d="M14 56 L34 14 H106 L98 56 Z" fill="#1c2e66" stroke="#aab8d8" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 56 L44 14 M60 56 L70 14 M86 56 L88 14 M20 36 H102" stroke="#6c86d6" strokeWidth="2" />
      <circle cx="104" cy="14" r="9" fill="var(--spark)" />
    </svg>
  );
}

/** Sample bag shown on the ending screen: one rock per sample. */
export function SampleRocks({ count }: { count: number }) {
  return (
    <svg viewBox="0 0 150 60" className="rocks" role="img" aria-label={String(count)}>
      {Array.from({ length: Math.min(count, 8) }, (_, i) => (
        <g key={i} transform={`translate(${10 + i * 17} ${34 + (i % 2) * 6})`}>
          <path d="M0 14 L4 2 L14 0 L20 10 L14 18 Z" fill={i % 2 ? '#9a9fb0' : '#b8bccb'} stroke="#6f7488" strokeWidth="1.6" />
        </g>
      ))}
      {count === 0 && <path d="M10 44 H140" stroke="#6f7488" strokeWidth="2" strokeDasharray="4 6" />}
    </svg>
  );
}
