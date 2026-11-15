import type { ReactElement, SVGProps } from 'react';
import type { BuildingId } from '../three/types';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const S = (p: P, children: ReactElement | ReactElement[]) => (
  <svg {...base} width="1em" height="1em" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const SunIcon = (p: P) =>
  S(p, [
    <circle key="c" cx="24" cy="24" r="8" fill="currentColor" />,
    <path key="r" d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M14 34l-4 4" />,
  ]);
export const IceIcon = (p: P) => S(p, <path d="M24 4v40M7 14l34 20M41 14L7 34M18 7l6 6 6-6M18 41l6-6 6 6" />);
export const PlayIcon = (p: P) => S(p, <path d="M14 8l26 16-26 16z" fill="currentColor" />);
export const PauseIcon = (p: P) => S(p, <path d="M15 9v30M33 9v30" strokeWidth={7} />);
export const LeftIcon = (p: P) => S(p, <path d="M30 8L14 24l16 16" strokeWidth={5} />);
export const RightIcon = (p: P) => S(p, <path d="M18 8l16 16-16 16" strokeWidth={5} />);
export const UpIcon = (p: P) => S(p, <path d="M8 30l16-16 16 16" strokeWidth={5} />);
export const DownIcon = (p: P) => S(p, <path d="M8 18l16 16 16-16" strokeWidth={5} />);
export const PlusIcon = (p: P) => S(p, <path d="M24 8v32M8 24h32" strokeWidth={5} />);
export const MinusIcon = (p: P) => S(p, <path d="M8 24h32" strokeWidth={5} />);
export const CheckIcon = (p: P) => S(p, <path d="M8 26l11 11L40 12" strokeWidth={6} />);
export const CloseIcon = (p: P) => S(p, <path d="M10 10l28 28M38 10L10 38" strokeWidth={5} />);
export const MoonIcon = (p: P) => S(p, <path d="M32 6a18 18 0 1 0 10 28A15 15 0 0 1 32 6z" fill="currentColor" />);
export const EyeIcon = (p: P) => S(p, [<path key="a" d="M3 24s8-14 21-14 21 14 21 14-8 14-21 14S3 24 3 24z" />, <circle key="b" cx="24" cy="24" r="6" fill="currentColor" />]);
export const BulbIcon = (p: P) => S(p, [<path key="a" d="M16 30c-6-5-6-16 8-16s14 11 8 16c-2 2-3 4-3 6H19c0-2-1-4-3-6z" />, <path key="b" d="M19 42h10" />]);
export const InfoIcon = (p: P) => S(p, [<circle key="a" cx="24" cy="24" r="18" />, <path key="b" d="M24 22v12" strokeWidth={5} />, <circle key="c" cx="24" cy="14.5" r="2" fill="currentColor" />]);
export const ClockIcon = (p: P) => S(p, [<circle key="a" cx="24" cy="24" r="18" />, <path key="b" d="M24 13v11l8 5" />]);
export const BoltIcon = (p: P) => S(p, <path d="M28 4L12 27h10l-3 17 17-25H26z" fill="currentColor" />);
export const TankIcon = (p: P) => S(p, [<rect key="a" x="12" y="8" width="24" height="34" rx="9" />, <path key="b" d="M19 4h10M12 24h24" />]);
export const RadIcon = (p: P) => S(p, [<circle key="a" cx="24" cy="24" r="4" fill="currentColor" />, <path key="b" d="M24 20L16 6a20 20 0 0 1 16 0zM21 26L7 34a20 20 0 0 1 8-14zM27 26l14 8a20 20 0 0 1-8-14z" fill="currentColor" strokeWidth={1.5} />]);
export const StarIcon = (p: P) => S(p, <path d="M24 5l5.6 12.2 13.4 1.5-10 9 2.8 13.1L24 34l-11.8 6.8L15 27.7 5 18.7l13.4-1.5z" fill="currentColor" />);
export const BellIcon = (p: P) => S(p, [<path key="a" d="M10 34c3-3 4-7 4-12a10 10 0 0 1 20 0c0 5 1 9 4 12z" />, <path key="b" d="M20 40a4 4 0 0 0 8 0" />]);
export const StormIcon = (p: P) => S(p, [<path key="a" d="M14 32a9 9 0 1 1 3-17 11 11 0 0 1 21 3 7 7 0 0 1-1 14z" />, <path key="b" d="M25 28l-5 9h7l-3 8" style={{ stroke: 'var(--sun)' }} />]);
export const CalmIcon = (p: P) => S(p, [<path key="a" d="M34 8a16 16 0 1 0 6 26A13 13 0 0 1 34 8z" fill="currentColor" />, <path key="b" d="M12 10v6M9 13h6" />]);
export const ShieldIcon = (p: P) => S(p, <path d="M24 5l15 6v11c0 10-6 17-15 21C15 39 9 32 9 22V11z" />);
export const WalkIcon = (p: P) => S(p, [<circle key="a" cx="26" cy="8" r="4" fill="currentColor" />, <path key="b" d="M26 14l-4 12 8 6 2 10M22 26l-8 4M26 17l8 6M22 26l-5 16" />]);
export const HomeIcon = (p: P) => S(p, <path d="M6 24L24 8l18 16M12 20v22h24V20M20 42V30h8v12" />);
export const GearIcon = (p: P) => S(p, [<circle key="a" cx="24" cy="24" r="7" />, <path key="b" d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" />]);
export const BookIcon = (p: P) => S(p, <path d="M8 8h14a4 4 0 0 1 4 4v30a4 4 0 0 0-4-4H8zM40 8H26M40 8v30H26" />);
export const RedoIcon = (p: P) => S(p, <path d="M38 24a14 14 0 1 1-5-10.7M38 6v9h-9" strokeWidth={4} />);
export const RocketIcon = (p: P) => S(p, [<path key="a" d="M24 4c8 6 10 16 8 26H16c-2-10 0-20 8-26z" />, <circle key="b" cx="24" cy="17" r="3" />, <path key="c" d="M16 30l-6 8 8-2M32 30l6 8-8-2" />]);
export const CompassIcon = (p: P) => S(p, [<circle key="a" cx="24" cy="24" r="18" />, <path key="b" d="M31 17l-5 10-10 5 5-10z" fill="currentColor" />]);
export const PinIcon = (p: P) => S(p, [<path key="a" d="M24 44c-8-9-13-16-13-23a13 13 0 0 1 26 0c0 7-5 14-13 23z" />, <circle key="b" cx="24" cy="21" r="4.5" fill="currentColor" />]);
export const SlopeIcon = (p: P) => S(p, <path d="M4 38L28 12l16 26z" />);
export const FlagIcon = (p: P) => S(p, [<path key="a" d="M12 44V6" />, <path key="b" d="M12 8h26l-6 9 6 9H12z" fill="currentColor" />]);
export const AlbumIcon = (p: P) => S(p, [<rect key="a" x="8" y="6" width="32" height="36" rx="4" />, <path key="b" d="M24 15l2.6 5.6 6 .7-4.5 4 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.5-4 6-.7z" fill="currentColor" strokeWidth={1.5} />]);
export const MedalIcon = (p: P) => S(p, [<circle key="a" cx="24" cy="29" r="12" />, <path key="b" d="M15 5l6 14M33 5l-6 14" />, <path key="c" d="M24 23l2 4 4.4.6-3.2 3 .8 4.4-4-2.1-4 2.1.8-4.4-3.2-3 4.4-.6z" fill="currentColor" strokeWidth={1} />]);

export const BuildingIcon = ({ id, ...p }: { id: BuildingId } & P) => {
  switch (id) {
    case 'habitat':
      return S(p, [<path key="a" d="M8 40V24a16 14 0 0 1 32 0v16z" />, <path key="b" d="M8 30h32" style={{ stroke: 'var(--orange)' }} />, <path key="c" d="M20 40v-6h8v6" />]);
    case 'solarTower':
      return S(p, [<rect key="a" x="12" y="4" width="24" height="22" rx="2" />, <path key="b" d="M24 26v18M12 15h24M24 4v22" />]);
    case 'greenhouse':
      return S(p, [<path key="a" d="M6 40a18 18 0 0 1 36 0z" />, <path key="b" d="M24 40V26M24 32c-6-1-8-5-8-8 5 0 8 3 8 8zM24 30c5-1 7-4 7-7-5 0-7 3-7 7z" />]);
    case 'rover':
      return S(p, [<rect key="a" x="8" y="16" width="32" height="14" rx="3" />, <circle key="b" cx="14" cy="36" r="5" />, <circle key="c" cx="34" cy="36" r="5" />, <path key="d" d="M30 16V8" />]);
    case 'antenna':
      return S(p, [<path key="a" d="M8 10a22 22 0 0 0 22 22z" />, <path key="b" d="M24 28l-4 14h12l-4-14M34 8l4-4M38 16l5-1" />]);
    case 'batteryUnit':
      return S(p, [<rect key="a" x="9" y="14" width="26" height="22" rx="4" />, <path key="b" d="M35 21h4v8h-4" />, <path key="c" d="M23 18l-5 8h7l-3 8" style={{ stroke: 'var(--sun)' }} />]);
    case 'lander':
      return S(p, [<path key="a" d="M14 10h20l4 14H10z" />, <path key="b" d="M12 24L6 42M36 24l6 18M24 24v10" />]);
  }
};

/** Pati: round helmet bubble around a dog face. */
export const PatiFace = (p: P) => (
  <svg viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" {...p}>
    <circle cx="32" cy="32" r="29" fill="#cfeaff" fillOpacity="0.35" stroke="#e8f6ff" strokeWidth="3" />
    <ellipse cx="14" cy="26" rx="7" ry="13" fill="#8a5a2b" transform="rotate(12 14 26)" />
    <ellipse cx="50" cy="26" rx="7" ry="13" fill="#8a5a2b" transform="rotate(-12 50 26)" />
    <circle cx="32" cy="33" r="19" fill="#d9a066" />
    <ellipse cx="32" cy="42" rx="10" ry="7.5" fill="#f3e6d3" />
    <circle cx="25" cy="29" r="3" fill="#222" />
    <circle cx="39" cy="29" r="3" fill="#222" />
    <ellipse cx="32" cy="38" rx="3.6" ry="2.6" fill="#222" />
    <path d="M32 41v3M28 45q4 3 8 0" stroke="#222" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M14 52q18 8 36 0" stroke="#ff7a1a" strokeWidth="5" fill="none" strokeLinecap="round" />
  </svg>
);
