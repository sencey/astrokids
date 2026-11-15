import { createElement } from 'react';
import type { MutableRefObject, ReactElement } from 'react';
import type { ModelId } from '../types';
import { Antenna, Astronaut, BatteryUnit, Greenhouse, Habitat, Lander, Pati, Rover, SolarTower } from './primitives';
import type { GaitDrive } from './primitives';

export interface ModelDef {
  /** Path under public/ (resolved against BASE_URL at load time). */
  glbPath: string;
  /** Applied to the GLB only (primitives are already authored at 1 unit = 1 m). */
  scale: number;
  yOffset: number;
  fallback: (anim?: string, drive?: MutableRefObject<GaitDrive>, fill?: number) => ReactElement;
}

const def = (id: ModelId, fallback: ModelDef['fallback'], scale = 1, yOffset = 0): ModelDef => ({
  glbPath: `/models/${id}.glb`,
  scale,
  yOffset,
  fallback,
});

export const MODELS: Record<ModelId, ModelDef> = {
  habitat: def('habitat', () => createElement(Habitat)),
  solarTower: def('solarTower', () => createElement(SolarTower)),
  greenhouse: def('greenhouse', () => createElement(Greenhouse)),
  rover: def('rover', (_anim, drive) => createElement(Rover, { drive })),
  batteryUnit: def('batteryUnit', (_anim, _drive, fill) => createElement(BatteryUnit, { fill })),
  antenna: def('antenna', () => createElement(Antenna)),
  lander: def('lander', () => createElement(Lander)),
  astronaut: def('astronaut', (anim, drive) => createElement(Astronaut, { anim, drive })),
  pati: def('pati', (anim) => createElement(Pati, { anim })),
};

