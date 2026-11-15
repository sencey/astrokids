import { useEffect, useRef, useState } from 'react';
import './pati.css';

export type PatiPose = 'sleeping' | 'happy' | 'alert' | 'worried' | 'proud' | 'sleepy';
export type Outfit = 'none' | 'ball' | 'headset';

interface Props {
  pose: PatiPose;
  outfit?: Outfit;
  label: string;
  onTap?: () => void;
  onLongPress?: () => void;
  /** Collar button (morning "sniff"). */
  onCollar?: () => void;
  collarLabel?: string;
  glowCollar?: boolean;
  /** Change this number to make Pati bark (visual). */
  barkKey?: number;
  className?: string;
}

const C = {
  body: '#e9c58e',
  belly: '#f8e6c4',
  patch: '#b9803f',
  ear: '#c99a5b',
  ink: '#1b2340',
  nose: '#241a33',
};

export default function Pati({
  pose, outfit = 'none', label, onTap, onLongPress, onCollar, collarLabel, glowCollar, barkKey, className,
}: Props) {
  const [barking, setBarking] = useState(false);
  const pressTimer = useRef<number>(0);
  const barkTimer = useRef<number>(0);

  const bark = () => {
    setBarking(true);
    window.clearTimeout(barkTimer.current);
    barkTimer.current = window.setTimeout(() => setBarking(false), 650);
  };
  useEffect(() => {
    if (barkKey) bark();
    return () => window.clearTimeout(barkTimer.current);
  }, [barkKey]);
  useEffect(() => () => window.clearTimeout(pressTimer.current), []);

  const down = () => {
    bark();
    onTap?.();
    if (onLongPress) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = window.setTimeout(onLongPress, 900);
    }
  };
  const up = () => window.clearTimeout(pressTimer.current);

  const happyLike = pose === 'happy' || pose === 'proud';
  const sleepingLike = pose === 'sleeping';

  return (
    <div className={`pati pati--${pose} ${barking ? 'pati--bark' : ''} ${className ?? ''}`}>
      <button
        type="button"
        className="pati__main"
        aria-label={label}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            bark();
            onTap?.();
          }
        }}
      >
        <svg viewBox="0 0 200 225" role="img" aria-hidden="true" focusable="false">
          {/* tail */}
          <path
            className={`pati__tail ${happyLike ? 'pati__tail--wag' : ''}`}
            d="M138 178 Q176 160 170 122"
            stroke={C.body}
            strokeWidth="15"
            strokeLinecap="round"
            fill="none"
          />
          {/* body */}
          <g className="pati__body">
            <ellipse cx="100" cy="172" rx="46" ry="42" fill={C.body} />
            <ellipse cx="100" cy="180" rx="28" ry="28" fill={C.belly} />
            <ellipse cx="76" cy="208" rx="16" ry="10" fill={C.body} />
            <ellipse cx="124" cy="208" rx="16" ry="10" fill={C.body} />
          </g>
          {/* collar */}
          <g>
            <path d="M62 140 Q100 166 138 140 L136 154 Q100 180 64 154 Z" fill="var(--accent)" />
            <circle cx="100" cy="170" r="8" fill="#ffd36a" stroke="#c2620a" strokeWidth="2" />
            <line x1="72" y1="150" x2="64" y2="126" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
            <circle
              className={`pati__antenna ${pose === 'alert' || glowCollar ? 'pati__antenna--blink' : ''}`}
              cx="63"
              cy="123"
              r="5"
              fill="#ff5a3c"
            />
          </g>
          {outfit === 'ball' && (
            <g className="pati__ball">
              <circle cx="150" cy="204" r="14" fill="var(--spark)" stroke="#e0a800" strokeWidth="2" />
              <path d="M138 200 Q150 194 162 200" stroke="#e0a800" strokeWidth="2" fill="none" />
            </g>
          )}
          {/* head */}
          <g className="pati__head">
            {pose === 'alert' ? (
              <>
                <path d="M60 68 L52 14 L90 48 Z" fill={C.ear} />
                <path d="M140 68 L148 14 L110 48 Z" fill={C.ear} />
              </>
            ) : (
              <g className={pose === 'worried' ? 'pati__ears pati__ears--down' : 'pati__ears'}>
                <path d="M60 66 Q26 78 36 130 Q60 124 68 92 Z" fill={C.ear} />
                <path d="M140 66 Q174 78 164 130 Q140 124 132 92 Z" fill={C.ear} />
              </g>
            )}
            <ellipse cx="100" cy="95" rx="52" ry="46" fill={C.body} />
            <ellipse cx="78" cy="86" rx="19" ry="18" fill={C.patch} opacity="0.85" />
            <ellipse cx="100" cy="114" rx="27" ry="20" fill={C.belly} />
            <ellipse cx="100" cy="104" rx="9" ry="6.5" fill={C.nose} />
            {/* eyes */}
            {(pose === 'alert' || pose === 'worried') && (
              <>
                <g className="pati__eye">
                  <ellipse cx="80" cy="90" rx={pose === 'alert' ? 8 : 7} ry={pose === 'alert' ? 9 : 8.5} fill={C.ink} />
                  <circle cx="83" cy="86" r="2.6" fill="#fff" />
                </g>
                <g className="pati__eye">
                  <ellipse cx="120" cy="90" rx={pose === 'alert' ? 8 : 7} ry={pose === 'alert' ? 9 : 8.5} fill={C.ink} />
                  <circle cx="123" cy="86" r="2.6" fill="#fff" />
                </g>
              </>
            )}
            {pose === 'worried' && (
              <>
                <path d="M68 80 L90 72" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
                <path d="M132 80 L110 72" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
              </>
            )}
            {happyLike && (
              <>
                <path d="M70 94 Q80 82 90 94" stroke={C.ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
                <path d="M110 94 Q120 82 130 94" stroke={C.ink} strokeWidth="4.5" fill="none" strokeLinecap="round" />
              </>
            )}
            {sleepingLike && (
              <>
                <path d="M70 90 Q80 99 90 90" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M110 90 Q120 99 130 90" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
              </>
            )}
            {pose === 'sleepy' && (
              <>
                <path d="M70 92 Q80 100 90 92" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
                <path d="M110 92 Q120 100 130 92" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
                <ellipse cx="80" cy="95" rx="5" ry="2.2" fill={C.ink} />
                <ellipse cx="120" cy="95" rx="5" ry="2.2" fill={C.ink} />
              </>
            )}
            {/* mouth */}
            {happyLike ? (
              <>
                <path d="M86 116 Q100 140 114 116 Z" fill="#7a2d3a" />
                <ellipse cx="100" cy="127" rx="6" ry="3.5" fill="#ff9aa8" />
              </>
            ) : pose === 'alert' ? (
              <ellipse cx="100" cy="122" rx="5" ry="4" fill="#7a2d3a" />
            ) : pose === 'worried' ? (
              <path d="M90 124 Q100 116 110 124" stroke={C.ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            ) : pose === 'sleepy' ? (
              <ellipse cx="100" cy="122" rx="6" ry="8" fill="#7a2d3a" />
            ) : (
              <path d="M90 116 Q100 124 110 116" stroke={C.ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            )}
            {outfit === 'headset' && (
              <g>
                <path d="M50 88 Q100 8 150 88" stroke="#2a3566" strokeWidth="7" fill="none" strokeLinecap="round" />
                <rect x="40" y="82" width="16" height="30" rx="8" fill="#2a3566" />
                <rect x="144" y="82" width="16" height="30" rx="8" fill="#2a3566" />
                <path d="M48 110 Q50 134 82 130" stroke="#2a3566" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                <circle cx="84" cy="130" r="5" fill="var(--accent)" />
              </g>
            )}
          </g>
          {/* proud star */}
          {pose === 'proud' && <path className="pati__star" d="M168 52 l4 10 11 1 -8 7 3 11 -10 -6 -10 6 3 -11 -8 -7 11 -1 z" fill="var(--spark)" />}
          {(sleepingLike || pose === 'sleepy') && (
            <g className="pati__zzz" fill="var(--cream)" fontWeight="800" fontFamily="inherit">
              <text x="150" y="60" fontSize="22">z</text>
              <text x="166" y="38" fontSize="17">z</text>
              <text x="178" y="20" fontSize="13">z</text>
            </g>
          )}
          {/* bark arcs */}
          <g className="pati__arcs" fill="none" stroke="var(--cream)" strokeWidth="4" strokeLinecap="round">
            <path d="M160 96 Q170 104 160 112" />
            <path d="M170 86 Q186 104 170 122" />
          </g>
        </svg>
      </button>
      {onCollar && (
        <button
          type="button"
          className={`pati__collar ${glowCollar ? 'pati__collar--glow' : ''}`}
          aria-label={collarLabel ?? 'Collar'}
          onPointerDown={(e) => {
            e.stopPropagation();
            onCollar();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCollar();
            }
          }}
        />
      )}
    </div>
  );
}
