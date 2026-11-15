/** Stylised (not photographic) picture of Belka and Strelka's flight, 1960. */
export function FrameStill() {
  return (
    <svg viewBox="0 0 200 150" className="frame__svg" aria-hidden="true">
      <rect x="4" y="4" width="192" height="142" rx="16" fill="#8a5a2b" />
      <rect x="14" y="14" width="172" height="122" rx="8" fill="#0e1a3d" />
      <circle cx="30" cy="34" r="1.8" fill="#fff6d6" />
      <circle cx="150" cy="26" r="1.8" fill="#fff6d6" />
      <circle cx="110" cy="48" r="1.4" fill="#fff6d6" />
      <circle cx="100" cy="150" r="70" fill="#3b86d6" />
      <path d="M60 110 q20 -14 40 -4 q20 -10 40 4" fill="#5cb85c" opacity="0.8" />
      <ellipse cx="100" cy="64" rx="18" ry="12" fill="#e8ecf5" stroke="#aab" strokeWidth="2" />
      <circle cx="100" cy="62" r="5" fill="#243061" />
      <Dog x={78} y={92} />
      <Dog x={122} y={92} flip />
    </svg>
  );
}

function Dog({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path className="frame__tail" d="M12 8 q10 -4 8 -14" stroke="#e9c58e" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="0" cy="10" rx="14" ry="10" fill="#e9c58e" />
      <circle cx="-8" cy="-4" r="9" fill="#e9c58e" />
      <path d="M-15 -8 q-6 6 -2 12 q4 -2 5 -8z" fill="#c99a5b" />
      <circle cx="-11" cy="-5" r="1.6" fill="#1b2340" />
      <ellipse cx="-14" cy="-1" rx="2.2" ry="1.6" fill="#241a33" />
    </g>
  );
}

/** The little animation: capsule parachutes down, two dogs wag, mice peek out. */
export function FrameAnim() {
  return (
    <svg viewBox="0 0 240 180" className="frame__anim" aria-hidden="true">
      <rect x="0" y="0" width="240" height="180" rx="22" fill="#0e1a3d" />
      <circle cx="40" cy="30" r="1.8" fill="#fff6d6" />
      <circle cx="200" cy="40" r="1.8" fill="#fff6d6" />
      <circle cx="150" cy="18" r="1.4" fill="#fff6d6" />
      <path d="M0 150 q60 -30 120 -18 q60 -12 120 18 V180 H0 Z" fill="#5cb85c" />
      <path d="M0 165 q120 -16 240 0 V180 H0 Z" fill="#3f9b4c" />
      <g className="frame__chute">
        <path d="M70 12 Q120 -24 170 12 Z" fill="#ff8a1f" />
        <path d="M70 12 L116 56 M170 12 L124 56 M120 -2 L120 56" stroke="#fff" strokeWidth="1.6" />
        <rect x="104" y="54" width="32" height="24" rx="10" fill="#e8ecf5" stroke="#aab" strokeWidth="2" />
        <circle cx="120" cy="66" r="6" fill="#243061" />
      </g>
      <g transform="translate(70 150)">
        <Dog x={0} y={0} />
      </g>
      <g transform="translate(170 150)">
        <Dog x={0} y={0} flip />
      </g>
      <g className="frame__mouse frame__mouse--a">
        <circle cx="22" cy="168" r="7" fill="#b8b2c4" />
        <circle cx="16" cy="161" r="3.6" fill="#d9a7b0" />
        <circle cx="28" cy="161" r="3.6" fill="#d9a7b0" />
        <circle cx="20" cy="168" r="1.2" fill="#1b2340" />
        <circle cx="25" cy="168" r="1.2" fill="#1b2340" />
      </g>
      <g className="frame__mouse frame__mouse--b">
        <circle cx="216" cy="170" r="7" fill="#c9bfae" />
        <circle cx="210" cy="163" r="3.6" fill="#d9a7b0" />
        <circle cx="222" cy="163" r="3.6" fill="#d9a7b0" />
        <circle cx="214" cy="170" r="1.2" fill="#1b2340" />
        <circle cx="219" cy="170" r="1.2" fill="#1b2340" />
      </g>
    </svg>
  );
}
