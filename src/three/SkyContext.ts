import { createContext, useContext } from 'react';
import type { MutableRefObject } from 'react';
import { Vector3 } from 'three';

/** Live sky state, written every frame by <Sky/>, read by models (panels face the Sun, dishes face Earth). */
export interface SkyState {
  sunAz: number;
  sunEl: number;
  earthAz: number;
  earthEl: number;
  sunDir: Vector3;
  earthDir: Vector3;
}
export const makeSkyState = (): SkyState => ({
  sunAz: 0,
  sunEl: 1,
  earthAz: 0,
  earthEl: 5,
  sunDir: new Vector3(0, 0.02, -1).normalize(),
  earthDir: new Vector3(0.9, 0.1, -0.3).normalize(),
});

export const SkyCtx = createContext<MutableRefObject<SkyState>>({ current: makeSkyState() });
export const useSky = () => useContext(SkyCtx);
