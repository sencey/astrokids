import type { ReactNode } from 'react';
import { useApp } from '../AppContext';
import { Astronaut, Bowl, DoghouseArt, Garden, SolarPanel, WaterMachine } from './Art';
import type { RoomId } from './useBalls';
import './scene.css';

interface Props {
  hud?: ReactNode;
  sky?: ReactNode;
  pati: ReactNode;
  water: number;
  garden: number;
  tankMax: number;
  wall: number;
  droop?: number;
  crewInside: boolean;
  /** Little crew visible outside on the Moon surface. */
  crewCount?: number;
  sampleBag?: boolean;
  assigned?: Record<RoomId, number>;
  armed?: boolean;
  hover?: RoomId | null;
  glow?: RoomId | 'door' | 'solar' | null;
  onRoomTap?: (r: RoomId) => void;
  onDoor?: () => void;
  onSolar?: () => void;
  solarVisible?: boolean;
  /** Dims the whole habitat (capsule at night in the tutorial wake-up etc.). */
  children?: ReactNode;
}

export default function Stage(p: Props) {
  const { t } = useApp();
  const assigned = p.assigned ?? { water: 0, garden: 0, wall: 0 };
  const tap = (r: RoomId) => () => p.onRoomTap?.(r);
  const roomProps = (r: RoomId, label: string) => ({
    className: `room room--${r} ${p.armed ? 'room--armed' : ''} ${p.hover === r ? 'room--hover' : ''} ${p.glow === r ? 'room--glow' : ''}`,
    'data-room': r,
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onPointerDown: tap(r),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        p.onRoomTap?.(r);
      }
    },
  });
  const orbs = (n: number) =>
    n > 0 && (
      <div className="room__orbs" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="orb" />
        ))}
      </div>
    );

  const crew = p.crewCount ?? 2;
  return (
    <div className="stage">
      {p.hud && <div className="stage__hud">{p.hud}</div>}
      {p.sky && <div className="stage__sky">{p.sky}</div>}
      <div className="habitat">
        <div className="stage__pati">{p.pati}</div>

        <div {...roomProps('water', t('room.water'))}>
          <WaterMachine />
          <Bowl kind="water" level={p.water} max={p.tankMax} label={t('room.water')} />
          {orbs(assigned.water)}
        </div>

        <div {...roomProps('garden', t('room.garden'))}>
          <Garden level={p.garden} max={p.tankMax} droop={p.droop ?? 0} />
          <Bowl kind="food" level={p.garden} max={p.tankMax} label={t('room.garden')} />
          {orbs(assigned.garden)}
        </div>

        <div {...roomProps('wall', t('room.house'))}>
          <DoghouseArt wall={p.wall} />
          {orbs(assigned.wall)}
          <button
            type="button"
            className={`door ${p.crewInside ? 'door--closed' : 'door--open'} ${p.glow === 'door' ? 'door--glow' : ''}`}
            aria-label={p.crewInside ? t('door.closed') : t('door.open')}
            aria-pressed={p.crewInside}
            disabled={!p.onDoor && !p.onRoomTap}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (p.armed) p.onRoomTap?.('wall');
              else (p.onDoor ?? (() => p.onRoomTap?.('wall')))();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                (p.onDoor ?? (() => p.onRoomTap?.('wall')))();
              }
            }}
          >
            {p.crewInside && (
              <span className="door__crew">
                <Astronaut />
                <Astronaut />
              </span>
            )}
          </button>
        </div>

        {p.solarVisible !== false && (
          <button
            type="button"
            className={`solar ${p.glow === 'solar' ? 'solar--glow' : ''}`}
            aria-label={t('solar')}
            disabled={!p.onSolar}
            onPointerDown={() => p.onSolar?.()}
          >
            <SolarPanel />
          </button>
        )}
      </div>

      <div className="ground" aria-hidden="true">
        <div className="ground__craters" />
        {!p.crewInside &&
          Array.from({ length: crew }, (_, i) => (
            <div key={i} className={`ground__crew ground__crew--${i}`}>
              <Astronaut bag={i === 0 && p.sampleBag} />
            </div>
          ))}
      </div>
      {p.children}
    </div>
  );
}
