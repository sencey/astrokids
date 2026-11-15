export type PatiMood = 'happy' | 'wink' | 'surprised' | 'determined' | 'sad';

/** What the game knows right now; every field is optional and defaults to "no". */
export interface PatiMoodState {
  /** the alarm overlay is on screen */
  alarm?: boolean;
  /** the briefing of a super-storm day is on screen */
  superBriefing?: boolean;
  /** the current day is a storm day */
  storm?: boolean;
  alertOngoing?: boolean;
  /** the commander is planning / playing a day with the regolith shield */
  shieldDay?: boolean;
  resupply?: boolean;
  earlyReturn?: boolean;
  lifeLow?: boolean;
  /** battery is empty and the towers are dark */
  batteryEmptyDark?: boolean;
  /** Pati is saying a tip / hint line */
  tip?: boolean;
  live?: boolean;
}

/** Single place that maps game state to the corner avatar's expression. Order = priority. */
export function patiMood(s: PatiMoodState): PatiMood {
  if (s.alarm || s.superBriefing) return 'surprised';
  if (s.storm || s.alertOngoing || s.shieldDay) return 'determined';
  if (s.resupply || s.earlyReturn || s.lifeLow || s.batteryEmptyDark) return 'sad';
  if (s.tip || s.live) return 'wink';
  return 'happy';
}

export type PatiPoseId = 'pose-main' | 'pose-run' | 'pose-jump' | 'pose-sit' | 'pose-wave' | 'pose-live' | 'expr-sad';
