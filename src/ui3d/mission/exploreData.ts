/** UI helpers over the real exploration module (src/game/explore): localized POI text, outing steps, welcome flag. */
import { BADGES, earnedBadges, exploredFraction, loadProgress } from '../../game/explore/explore';
import type { BadgeId, Mission, MissionStats } from '../../game/explore/explore';
import { EXPLORE } from '../../game/explore/config';
import { isDiscoverable } from '../../game/explore/pois';
import type { Poi } from '../../game/explore/pois';
import type { L } from '../text';

export type { BadgeId, Mission, Poi };
export { BADGES, isDiscoverable };

export const WELCOME_KEY = 'astrakids.welcome.v1';

export const poiName = (p: Poi, l: L): string => (l === 'tr' ? p.nameTr : p.nameEn);
export const poiFact = (p: Poi, l: L): string => (l === 'tr' ? p.factTr : p.factEn);
export const badgeName = (id: BadgeId, l: L): string => {
  const b = BADGES.find((x) => x.id === id);
  return b ? (l === 'tr' ? b.nameTr : b.nameEn) : id;
};
/** Kid-friendly name of a dataset (the raw id stays in the Sources panel). */
export function friendlySource(name: string, l: L): string {
  const n = name.toLowerCase();
  if (n.includes('ldem')) return l === 'tr' ? 'NASA LRO lazer yükseklik ölçeri (LOLA)' : 'NASA LRO laser altimeter (LOLA)';
  if (n.includes('avgvisib')) return l === 'tr' ? 'NASA kutup ışık haritası' : 'NASA polar illumination map';
  if (n.includes('lpsr')) return l === 'tr' ? 'NASA kalıcı gölge bölgesi haritası' : 'NASA permanently-shadowed-region map';
  if (n.includes('astronomy-engine')) return l === 'tr' ? 'Güneş ve Dünya konumları: astronomy-engine' : 'Sun & Earth positions: astronomy-engine';
  return name;
}
export function poiSourceLine(p: Poi, l: L): string {
  const names = [p.source.name, p.source.extra?.name].filter((x): x is string => !!x).map((x) => friendlySource(x, l));
  return [...new Set(names)].join(' + ');
}
/** Raw dataset ids + citations of all points of interest (for the grown-ups' Sources panel). */
export function rawDatasets(pois: readonly Poi[]): { name: string; url: string; citation: string }[] {
  const m = new Map<string, { name: string; url: string; citation: string }>();
  for (const p of pois) for (const s of [p.source, p.source.extra]) if (s && !m.has(s.name)) m.set(s.name, s);
  return [...m.values()];
}

export const missionText = (m: Mission, l: L): string => (l === 'tr' ? m.textTr : m.textEn);

export const readWelcomeDone = (): boolean => {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
};
export const writeWelcomeDone = () => {
  try {
    localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    /* ignore */
  }
};

/** the energy chips of the plan row */
export const EXPLORE_STEPS = [2, 4, 6] as const;
/** largest step that fits in `left` energy (0 = none fits) */
export const fitExplore = (want: number, left: number): number => [...EXPLORE_STEPS].reverse().find((n) => n <= want && n <= left) ?? 0;

/** Saved progress (the scene writes it): found place ids and the badges they earn. */
export function savedProgress(pois: readonly Poi[], extent: number, home: { x: number; z: number }): { discovered: string[]; badges: BadgeId[] } {
  const p = loadProgress();
  const frac = exploredFraction(p.mask, EXPLORE.maskN, extent, home);
  return { discovered: p.discovered, badges: earnedBadges(pois, p.discovered, frac) };
}

export const missionStats = (pois: readonly Poi[], found: readonly string[], walkedM: number): MissionStats => ({ walkedM, found: pois.filter((p) => found.includes(p.id)) });
