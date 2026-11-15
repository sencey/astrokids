// Daily LRO CRaTER absorbed-dose ratio vs the quiet baseline (NASA RadLab), copied from src/data/scenarios/may-2024.json
// (days[].sparkleRatio, the same numbers the game uses). The peak, 14 May 2024, is the x301.5 in the story.
export const RADIATION: { date: string; ratio: number }[] = [
  { date: '2024-05-08', ratio: 1.11 },
  { date: '2024-05-09', ratio: 2.2 },
  { date: '2024-05-10', ratio: 45.32 },
  { date: '2024-05-11', ratio: 213.58 },
  { date: '2024-05-12', ratio: 47.91 },
  { date: '2024-05-13', ratio: 71.66 },
  { date: '2024-05-14', ratio: 301.53 },
  { date: '2024-05-15', ratio: 101.56 },
];
export const RADIATION_PEAK = 301.53;
