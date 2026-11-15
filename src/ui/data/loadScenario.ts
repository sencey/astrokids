// The ONE place where scenario data enters the UI.
// SWITCH LINE (real data <-> fixture): change the next import to
//   '../../game/__tests__/fixtures/may-2024.fixture.json' to use the test fixture.
import scenarioJson from '../../data/scenarios/may-2024.json';
import compareJson from '../../data/scenarios/may-2024-compare.json';
import type { Provenance, Scenario } from '../../game/types';

export const scenario = scenarioJson as unknown as Scenario;

export interface CompareInstrument {
  instrument: string;
  place: 'iss' | 'lunarOrbit' | 'deepSpace' | 'marsSurface';
  peakDate: string;
  ratio: number;
  quietBaseline: number;
  unit: string;
  provenance: Provenance;
}
export interface Compare {
  status: string;
  note?: string;
  peakWindow?: [string, string];
  generatedAt?: string;
  instruments: CompareInstrument[];
}
export const compare: Compare = (() => {
  const c = compareJson as unknown as Partial<Compare>;
  return { status: c.status ?? 'empty', note: c.note, peakWindow: c.peakWindow, generatedAt: c.generatedAt, instruments: c.instruments ?? [] };
})();
