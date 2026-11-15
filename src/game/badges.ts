import { getConfig } from './rules';
import { guessErrorHours } from './mission';
import type { MissionState } from './types';

export type BadgeId = 'patientGuard' | 'braveExplorer' | 'masterGardener' | 'goodForecaster';

/** Mission patches are descriptive ("how you played"), never a ranking. All thresholds are assumptions. */
export const BADGE_RULES = {
  patientGuard: { maxJarFraction: 0.5, isAssumption: true, note: 'Jar at most half full at the end.' },
  braveExplorer: { minSamplesPerDay: 0.6, isAssumption: true, note: 'Samples on at least 60% of days played.' },
  masterGardener: { minTankFraction: 0.5, isAssumption: true, note: 'Both tanks at least half full every day.' },
  goodForecaster: { maxErrorHours: 7, isAssumption: true, note: 'Captain arrival guess within 7 h of the real shock.' },
} as const;

export function earnedBadges(state: MissionState): BadgeId[] {
  const cfg = getConfig(state.mode);
  const played = state.results.length;
  if (played === 0) return [];
  const badges: BadgeId[] = [];

  if (state.jar <= cfg.jarCapacity * BADGE_RULES.patientGuard.maxJarFraction) badges.push('patientGuard');
  if (state.samples / played >= BADGE_RULES.braveExplorer.minSamplesPerDay) badges.push('braveExplorer');

  const half = cfg.tankMax * BADGE_RULES.masterGardener.minTankFraction;
  if (state.results.every((r) => r.waterAfter >= half && r.gardenAfter >= half)) badges.push('masterGardener');

  if (state.mode === 'captain') {
    const err = guessErrorHours(state);
    if (err !== null && err <= BADGE_RULES.goodForecaster.maxErrorHours) badges.push('goodForecaster');
  }
  return badges;
}
