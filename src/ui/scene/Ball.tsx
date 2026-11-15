import { useRef, useState } from 'react';
import type { RoomId } from './useBalls';

const SNAP_RADIUS = 120; // px

/** Nearest room whose rectangle is within the snap radius of the pointer. */
export function nearestRoom(x: number, y: number): RoomId | null {
  let best: RoomId | null = null;
  let bestD = SNAP_RADIUS;
  document.querySelectorAll<HTMLElement>('[data-room]').forEach((el) => {
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d <= bestD) {
      bestD = d;
      best = el.dataset.room as RoomId;
    }
  });
  return best;
}

interface Props {
  index: number;
  selected: boolean;
  label: string;
  onSelect: (i: number | null) => void;
  /** Return true if the drop was accepted. */
  onDrop: (i: number, room: RoomId) => boolean;
  onHover: (room: RoomId | null) => void;
  style?: React.CSSProperties;
}

export default function Ball({ index, selected, label, onSelect, onDrop, onHover, style }: Props) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(false);

  const end = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!start.current) return;
    const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10;
    start.current = null;
    setDrag(false);
    onHover(null);
    if (moved) {
      const room = nearestRoom(e.clientX, e.clientY);
      if (!(room && onDrop(index, room))) {
        setOff({ x: 0, y: 0 }); // floats back to Pati, never lost
        onSelect(null);
      }
    } else {
      setOff({ x: 0, y: 0 }); // a tap: stays selected, waiting for a room tap
    }
  };

  return (
    <button
      type="button"
      className={`ball ${selected ? 'ball--selected' : ''} ${drag ? 'ball--drag' : ''}`}
      data-ball={index}
      aria-label={label}
      aria-pressed={selected}
      style={{ ...style, transform: `translate(${off.x}px, ${off.y}px)` }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, y: e.clientY };
        setDrag(true);
        onSelect(index);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        setOff({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
        onHover(nearestRoom(e.clientX, e.clientY));
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(e) => {
        if (e.detail === 0) onSelect(selected ? null : index); // keyboard
      }}
    >
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="26" fill="var(--spark)" stroke="#e0a800" strokeWidth="3" />
        <path d="M14 26 Q30 14 46 26" stroke="#fff6c7" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M33 14 l-8 17 h8 l-4 14 12 -19 h-8 z" fill="#e0a800" opacity="0.85" />
      </svg>
    </button>
  );
}
