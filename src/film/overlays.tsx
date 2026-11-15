// HTML overlays: titles, labels, data card, stamps, end card, transition flashes. Every style is a pure function of t
// (no CSS animations/transitions) so screenshots are deterministic.
import type { CSSProperties, ReactNode } from 'react';
import { clamp01, easeInOut, easeOut, easeOutBack, lerp, rng, seg, smooth, T, tri } from './timeline';
import { RADIATION, RADIATION_PEAK } from './radiation';

const VISOR = '#4DB3FF';
const ALARM = '#E5262E';
const SUN = '#FFC23D';
const FONT_UI = "'Lexend', 'Segoe UI', system-ui, sans-serif";
const FONT_STENCIL = "'Saira Stencil One', 'Lexend', sans-serif";
const FONT_CARD = "'Segoe UI', system-ui, sans-serif";

const fill: CSSProperties = { position: 'absolute', inset: 0 };

// ---------------------------------------------------------------- scene 1: kinetic title
function Title({ t }: { t: number }) {
  if (t > 3.0) return null;
  const word = 'ASTROKIDS';
  const out = smooth(seg(t, 2.45, 2.95));
  const letters = [...word].map((ch, i) => {
    const k = easeOut(seg(t, 0.55 + i * 0.05, 1.05 + i * 0.05));
    return (
      <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', lineHeight: 1.0, paddingBottom: 6 }}>
        <span style={{ display: 'inline-block', transform: `translateY(${(1 - k) * 112}%)`, opacity: k > 0 ? 1 : 0 }}>{ch}</span>
      </span>
    );
  });
  const sub = easeOut(seg(t, 1.05, 2.0));
  const line = easeInOut(seg(t, 0.95, 1.75));
  const pop = lerp(1, 1.05, smooth(seg(t, 0.5, 3.0)));
  return (
    <div style={{ position: 'absolute', left: 130, top: 330, width: 1060, opacity: 1 - out, transform: `scale(${pop})`, transformOrigin: '0 50%' }}>
      <div style={{ fontFamily: FONT_STENCIL, fontSize: 152, lineHeight: 1.02, color: '#fff', letterSpacing: `${lerp(0.09, 0.025, easeOut(seg(t, 0.55, 1.6)))}em`, textShadow: '0 4px 40px rgba(0,0,0,0.55), 0 0 70px rgba(77,179,255,0.25)', whiteSpace: 'nowrap' }}>{letters}</div>
      <div style={{ height: 5, width: 1030 * line, background: `linear-gradient(90deg, ${VISOR}, rgba(77,179,255,0))`, marginTop: 10, boxShadow: `0 0 18px ${VISOR}` }} />
      <div style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 44, color: VISOR, letterSpacing: `${lerp(0.95, 0.4, sub)}em`, opacity: sub, marginTop: 24, whiteSpace: 'nowrap', textShadow: '0 2px 24px rgba(0,0,0,0.7)' }}>MOON BASE COMMANDER</div>
    </div>
  );
}

function Credit({ t }: { t: number }) {
  if (t > 3.0) return null;
  const a = smooth(seg(t, 0.3, 0.9)) * (1 - smooth(seg(t, 2.5, 2.9)));
  return <div style={{ position: 'absolute', left: 64, bottom: 52, fontFamily: FONT_UI, fontSize: 24, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.78)', opacity: a, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>Artemis I launch · NASA</div>;
}

// ---------------------------------------------------------------- data labels
function Label({ t, a, b, text, color }: { t: number; a: number; b: number; text: string; color: string }) {
  if (t < a || t > b) return null;
  const inn = easeOut(seg(t, a, a + 0.45));
  const outt = smooth(seg(t, b - 0.35, b));
  const al = inn * (1 - outt);
  return (
    <div style={{ position: 'absolute', left: 64, bottom: 62, opacity: al, transform: `translateX(${(1 - inn) * -28}px)`, display: 'flex', alignItems: 'center', gap: 18, padding: '16px 30px 16px 24px', borderRadius: 18, background: 'rgba(5,7,13,0.58)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 8px 40px rgba(0,0,0,0.45)' }}>
      <span style={{ width: 16, height: 16, borderRadius: 16, background: color, boxShadow: `0 0 18px ${color}`, display: 'inline-block' }} />
      <span style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 36, letterSpacing: '0.02em', color: '#f2f7ff' }}>{text}</span>
    </div>
  );
}

// ---------------------------------------------------------------- scene 3 sticker
function PatiSticker({ t }: { t: number }) {
  if (t < 8.95 || t > 10.3) return null;
  const k = easeOutBack(seg(t, 9.0, 9.45));
  const out = smooth(seg(t, 10.0, 10.25));
  const wob = Math.sin((t - 9.0) * 7) * 4 * (1 - seg(t, 9.0, 10.0));
  return (
    <div style={{ position: 'absolute', right: 150, bottom: 150, transform: `scale(${Math.max(0, k) * (1 - out * 0.3)}) rotate(${-6 + wob}deg)`, opacity: 1 - out, transformOrigin: '50% 100%' }}>
      <div style={{ width: 250, height: 250, borderRadius: 250, background: 'radial-gradient(circle at 50% 35%, #ffffff 0%, #dfeeff 70%)', border: `8px solid ${VISOR}`, boxShadow: `0 0 50px rgba(77,179,255,0.55), 0 12px 40px rgba(0,0,0,0.5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img src="/pati/expr-happy.webp" alt="" style={{ width: 215, height: 215, objectFit: 'contain' }} />
      </div>
      <div style={{ marginTop: -26, marginLeft: 40, display: 'inline-block', padding: '8px 24px', borderRadius: 40, background: '#FF5A1F', color: '#fff', fontFamily: FONT_STENCIL, fontSize: 40, letterSpacing: '0.08em', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>PATI</div>
    </div>
  );
}

// ---------------------------------------------------------------- scene 6: data card
function StormCard({ t }: { t: number }) {
  const a = 17.15;
  if (t < a || t > T.s7 + 0.05) return null;
  const inn = easeOutBack(seg(t, a, a + 0.6));
  const out = smooth(seg(t, T.s7 - 0.3, T.s7));
  const W = 540;
  const H = 250;
  const maxV = 330;
  const pts = RADIATION.map((d, i) => [(i / (RADIATION.length - 1)) * W, H - (d.ratio / maxV) * H] as const);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const draw = easeInOut(seg(t, 17.6, 19.7));
  const num = Math.floor(lerp(1, RADIATION_PEAK, easeOut(seg(t, 18.5, 19.9))));
  const peakIdx = RADIATION.findIndex((d) => d.ratio === RADIATION_PEAK);
  const pk = pts[peakIdx];
  const pkShow = smooth(seg(t, 19.2, 19.6));
  const shake = t > 19.5 && t < 19.9 ? Math.sin(t * 90) * 2.5 * (1 - seg(t, 19.5, 19.9)) : 0;
  return (
    <div style={{ position: 'absolute', right: 70, top: 120, width: 640, height: 800, opacity: 1 - out, transform: `translate(${(1 - Math.min(inn, 1)) * 520 + shake}px, 0) scale(${1 + Math.max(0, inn - 1) * 0.1})`, borderRadius: 28, background: 'linear-gradient(180deg, rgba(14,9,18,0.8), rgba(8,6,12,0.86))', border: `2px solid rgba(229,38,46,0.55)`, boxShadow: '0 0 60px rgba(229,38,46,0.28), 0 20px 60px rgba(0,0,0,0.6)', padding: '34px 50px', boxSizing: 'border-box', fontFamily: FONT_UI, color: '#fff' }}>
      <div style={{ fontWeight: 600, fontSize: 26, letterSpacing: '0.16em', color: '#ff9b8f' }}>SOLAR STORM · MAY 2024</div>
      <svg width={W} height={H + 20} viewBox={`-6 -10 ${W + 12} ${H + 20}`} style={{ marginTop: 24, overflow: 'visible' }}>
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ALARM} stopOpacity="0.55" />
            <stop offset="1" stopColor={ALARM} stopOpacity="0" />
          </linearGradient>
          <clipPath id="rc">
            <rect x={-6} y={-10} width={(W + 12) * draw} height={H + 24} />
          </clipPath>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={0} x2={W} y1={(i / 3) * H} y2={(i / 3) * H} stroke="rgba(255,255,255,0.10)" strokeWidth={1.5} />
        ))}
        <g clipPath="url(#rc)">
          <path d={`${path} L${W} ${H} L0 ${H} Z`} fill="url(#rg)" />
          <path d={path} fill="none" stroke="#ff5a4f" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(255,70,60,0.9))' }} />
        </g>
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={7} fill="#fff" opacity={draw * W >= p[0] - 1 ? 1 : 0} />
        ))}
        <circle cx={pk[0]} cy={pk[1]} r={13 + 12 * ((t * 1.7) % 1)} fill="none" stroke="#fff" strokeWidth={3} opacity={pkShow * (1 - ((t * 1.7) % 1))} />
      </svg>
      <div style={{ position: 'relative', height: 34, fontSize: 24, color: 'rgba(255,255,255,0.7)', marginTop: 10 }}>
        <span style={{ position: 'absolute', left: 0 }}>8 May</span>
        <span style={{ position: 'absolute', left: (6 / 7) * W, transform: 'translateX(-50%)', color: '#ffb0a8', opacity: pkShow }}>14 May</span>
        <span style={{ position: 'absolute', right: 0 }}>15 May</span>
      </div>
      <div style={{ fontFamily: FONT_STENCIL, fontSize: 190, lineHeight: 1, marginTop: 30, color: '#ff4d43', textShadow: '0 0 40px rgba(255,60,50,0.75), 0 4px 0 rgba(0,0,0,0.4)', letterSpacing: '0.01em' }}>×{num}</div>
      <div style={{ fontWeight: 600, fontSize: 32, marginTop: 6 }}>LRO CRaTER radiation · NASA</div>
      <div style={{ fontSize: 25, marginTop: 10, color: 'rgba(255,255,255,0.62)' }}>Space weather: NASA DONKI</div>
    </div>
  );
}

// ---------------------------------------------------------------- tints
function StormTint({ t }: { t: number }) {
  let a = 0;
  if (t >= 16.9 && t < T.s7) a = smooth(seg(t, 16.9, 17.8)) * 0.55;
  else if (t >= T.s7 && t < T.s8) a = lerp(0.5, 0, smooth(seg(t, 21.2, 22.35)));
  if (a <= 0.001) return null;
  const pulse = 0.8 + 0.2 * Math.sin(t * 6.5);
  return <div style={{ ...fill, pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 50%, rgba(229,38,46,${0.06 * a}) 30%, rgba(229,38,46,${0.55 * a * pulse}) 100%)`, mixBlendMode: 'normal' }} />;
}

// ---------------------------------------------------------------- SAFE stamp
function SafeStamp({ t }: { t: number }) {
  if (t < 21.9 || t > T.s8 + 0.2) return null;
  const k = seg(t, 21.9, 22.12);
  const sc = lerp(2.4, 1, easeOut(k)) + (t > 22.12 ? Math.sin((t - 22.12) * 30) * 0.015 * (1 - seg(t, 22.12, 22.5)) : 0);
  const out = smooth(seg(t, 22.35, 22.5));
  const ring = seg(t, 22.1, 22.7);
  return (
    <div style={{ position: 'absolute', left: 1180, top: 190, opacity: easeOut(k) * (1 - out), transform: `scale(${sc}) rotate(-7deg)`, transformOrigin: '50% 50%' }}>
      <div style={{ position: 'absolute', inset: -10, borderRadius: 30, border: `4px solid ${VISOR}`, transform: `scale(${1 + ring * 0.6})`, opacity: (1 - ring) * 0.8 }} />
      <div style={{ padding: '6px 54px 10px', border: `9px solid #8fe3ff`, borderRadius: 22, color: '#8fe3ff', fontFamily: FONT_STENCIL, fontSize: 168, letterSpacing: '0.06em', lineHeight: 1.05, background: 'rgba(10,30,70,0.45)', textShadow: '0 0 36px rgba(77,179,255,0.9)', boxShadow: '0 0 60px rgba(77,179,255,0.5), inset 0 0 30px rgba(77,179,255,0.3)' }}>SAFE</div>
    </div>
  );
}

// ---------------------------------------------------------------- end card (look of scripts/video/endcard.html, animated)
const STARS = (() => {
  const r = rng(7);
  return Array.from({ length: 260 }, () => ({ x: r() * 1920, y: r() * 1080, a: 0.2 + r() * 0.7, s: 0.3 + r() * 1.8, ph: r() * 6.28, sp: 0.5 + r() * 1.5 }));
})();

function EndCard({ t }: { t: number }) {
  if (t < T.s8 - 0.2) return null;
  const bg = smooth(seg(t, 22.5, 22.9));
  const logoK = easeOutBack(seg(t, 22.55, 23.4));
  const logoA = smooth(seg(t, 22.55, 23.0));
  const glow = 0.25 + 0.2 * Math.sin((t - 22.5) * 2.2);
  const words: [string, number, boolean][] = [['Real', 24.1, false], ['NASA', 24.35, true], ['data.', 24.6, false], ['Real', 25.0, false], ['decisions.', 25.15, false]];
  const sub = smooth(seg(t, 25.5, 25.95));
  const fade = 1 - smooth(seg(t, 26.0, 26.5));
  return (
    <div style={{ ...fill, opacity: bg * fade, background: 'radial-gradient(ellipse at 50% 38%, #16224a 0%, #0a1028 45%, #03050c 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, fontFamily: FONT_CARD, color: '#fff' }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x - (t - 22.5) * s.s * 2} cy={s.y} r={s.s} fill="#fff" opacity={s.a * (0.65 + 0.35 * Math.sin(t * s.sp + s.ph))} />
        ))}
      </svg>
      <img src="/brand/astrakids-logo.webp" alt="AstroKids" style={{ width: 760, height: 'auto', position: 'relative', opacity: logoA, transform: `scale(${lerp(0.82, 1, Math.min(logoK, 1.04))})`, filter: `drop-shadow(0 0 ${40 + glow * 50}px rgba(120,170,255,${0.35 + glow * 0.3}))` }} />
      <h1 style={{ position: 'relative', margin: 0, fontSize: 76, fontWeight: 800, letterSpacing: '0.5px', textAlign: 'center', display: 'flex', gap: 20, height: 92 }}>
        {words.map(([w, at, gold], i) => {
          const k = easeOut(seg(t, at, at + 0.28));
          return (
            <span key={i} style={{ display: 'inline-block', opacity: k, transform: `translateY(${(1 - k) * 34}px)`, color: gold ? '#ffd24a' : '#fff', textShadow: gold ? `0 0 ${30 * tri(t, at, at + 0.25, at + 0.9)}px rgba(255,210,74,0.9)` : 'none' }}>{w}</span>
          );
        })}
      </h1>
      <p style={{ position: 'relative', margin: 0, fontSize: 30, letterSpacing: 3, color: '#9fb2dd', textTransform: 'uppercase', opacity: sub, transform: `translateY(${(1 - sub) * 12}px)` }}>NASA Space Apps Challenge 2026</p>
    </div>
  );
}

// ---------------------------------------------------------------- transition flashes
const FLASHES: { at: number; pre: number; post: number; color: string; peak: number }[] = [
  { at: 5.95, pre: 0.2, post: 0.3, color: '#cfeeff', peak: 0.95 },
  { at: 8.2, pre: 0.22, post: 0.34, color: '#ffe2b0', peak: 0.85 },
  { at: 10.3, pre: 0.2, post: 0.32, color: '#c4e8ff', peak: 0.8 },
  { at: 13.6, pre: 0.2, post: 0.32, color: '#ffd37a', peak: 0.85 },
  { at: 16.8, pre: 0.18, post: 0.3, color: '#ff7a58', peak: 0.9 },
  { at: 17.4, pre: 0.05, post: 0.5, color: '#fff0c8', peak: 0.55 },
  { at: 20.6, pre: 0.2, post: 0.3, color: '#ffffff', peak: 0.85 },
  { at: 22.5, pre: 0.2, post: 0.4, color: '#cfe6ff', peak: 0.9 },
];
function Flashes({ t }: { t: number }) {
  const out: ReactNode[] = [];
  // S1 -> S2: exhaust white-out
  let w = 0;
  if (t < T.s2) w = smooth(seg(t, 2.4, 3.0));
  else w = 1 - smooth(seg(t, T.s2, T.s2 + 0.85));
  if (w > 0.001) out.push(<div key="w" style={{ ...fill, background: `radial-gradient(ellipse at 56% 55%, rgba(255,255,255,${w}) 0%, rgba(255,246,226,${w}) 60%, rgba(255,226,170,${w}) 100%)` }} />);
  FLASHES.forEach((f, i) => {
    if (t < f.at - f.pre || t > f.at + f.post) return;
    const a = t < f.at ? smooth(seg(t, f.at - f.pre, f.at)) : 1 - smooth(seg(t, f.at, f.at + f.post));
    out.push(<div key={i} style={{ ...fill, background: `radial-gradient(ellipse at 50% 50%, ${f.color} 0%, ${f.color} 35%, rgba(255,255,255,0) 110%)`, opacity: a * f.peak }} />);
    // anamorphic streak
    out.push(<div key={'s' + i} style={{ position: 'absolute', left: 0, right: 0, top: 530, height: 22, background: `linear-gradient(90deg, rgba(255,255,255,0), ${f.color} 25%, #fff 50%, ${f.color} 75%, rgba(255,255,255,0))`, opacity: a * 0.9, transform: `scaleX(${0.5 + a * 0.6})` }} />);
  });
  return <>{out}</>;
}

export function Overlays({ t }: { t: number }) {
  const clip = clamp01(t);
  void clip;
  return (
    <div style={{ ...fill, pointerEvents: 'none' }}>
      <Title t={t} />
      <Credit t={t} />
      <Label t={t} a={6.55} b={8.1} text="NASA LRO · LOLA terrain · 20 m/px" color={VISOR} />
      <PatiSticker t={t} />
      <Label t={t} a={10.75} b={13.45} text="Permanently shadowed region · NASA PGDA" color="#8fe3ff" />
      <Label t={t} a={15.0} b={16.65} text="≈75% sunlit · 8–13 May 2024" color={SUN} />
      <StormTint t={t} />
      <StormCard t={t} />
      <SafeStamp t={t} />
      <EndCard t={t} />
      <Flashes t={t} />
    </div>
  );
}
