import { useCallback, useRef, useState } from 'react';

export type RoomId = 'water' | 'garden' | 'wall';
export const ROOMS: RoomId[] = ['water', 'garden', 'wall'];

interface Options {
  /** Return false to refuse a room (tutorial). The ball floats back to Pati. */
  accept?: (room: RoomId) => boolean;
  onAssign?: (room: RoomId) => void;
}

/** Ball allocation state shared by tutorial and day loop. Works for drag AND tap-ball-then-tap-room. */
export function useBalls(initialCount: number, opts: Options = {}) {
  const [assign, setAssign] = useState<(RoomId | null)[]>(() => Array.from({ length: initialCount }, () => null));
  const [selected, setSelected] = useState<number | null>(null);
  const ref = useRef(assign);
  ref.current = assign;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const reset = useCallback((count: number) => {
    setAssign(Array.from({ length: count }, () => null));
    setSelected(null);
  }, []);

  const place = useCallback((i: number, room: RoomId): boolean => {
    if (ref.current[i] !== null) return false;
    if (optsRef.current.accept && !optsRef.current.accept(room)) return false;
    setAssign((a) => a.map((r, k) => (k === i ? room : r)));
    setSelected(null);
    optsRef.current.onAssign?.(room);
    return true;
  }, []);

  /** Tap on a room: place the selected ball, else take one ball back from that room. */
  const tapRoom = useCallback(
    (room: RoomId): boolean => {
      if (selected !== null) return place(selected, room);
      const idx = ref.current.lastIndexOf(room);
      if (idx >= 0 && !optsRef.current.accept) {
        setAssign((a) => a.map((r, k) => (k === idx ? null : r)));
      }
      return false;
    },
    [selected, place],
  );

  const counts = {
    water: assign.filter((r) => r === 'water').length,
    garden: assign.filter((r) => r === 'garden').length,
    wall: assign.filter((r) => r === 'wall').length,
  };
  const free = assign.map((r, i) => (r === null ? i : -1)).filter((i) => i >= 0);
  return { assign, selected, setSelected, free, counts, place, tapRoom, reset };
}
