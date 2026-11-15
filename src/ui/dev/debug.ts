// Dev-only read-only state hook for QA: window.__pati = { screen, step, dayIndex, mode }
interface PatiDebug {
  screen: string;
  step: string | null;
  dayIndex: number | null;
  mode: string;
}
const state: PatiDebug = { screen: 'wake', step: null, dayIndex: null, mode: 'playmate' };

export function setDebug(patch: Partial<PatiDebug>): void {
  if (!import.meta.env.DEV) return;
  Object.assign(state, patch);
  (window as unknown as { __pati?: PatiDebug }).__pati = { ...state };
}
