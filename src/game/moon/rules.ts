/**
 * Moon Base Commander: every tunable number, with provenance, so the
 * "For grown-ups" screen can list them. Nothing in the engine uses a bare
 * magic number; it all comes from here.
 */
export interface Rule<T> {
  value: T;
  source: string | null;
  isAssumption: boolean;
  note: string;
}

const rule = <T>(value: T, source: string | null, isAssumption: boolean, note: string): Rule<T> => ({
  value,
  source,
  isAssumption,
  note,
});

const ARTEMIS = 'Artemis I Orion storm-shelter measurement: 414 vs 95 uGy/min (reference event scaled)';
const CRATER = 'LRO CRaTER daily dose via NASA OSDR RadLab (ratio = daily dose / quiet-day dose, same detector)';
const LOLA = 'LRO LOLA terrain + real Sun ephemeris (computed % of each day sunlit)';
const ISS_SHARE = 'scaled from ISS life-support power share';

export const MOON_RULES = {
  mission: {
    days: rule(15, null, true, 'Mission length: 2024-05-08 .. 2024-05-22.'),
    startDate: rule('2024-05-08', 'NASA DONKI + RadLab archive', false, 'First mission day (Gannon storm week).'),
    endDate: rule('2024-05-22', 'NASA DONKI + RadLab archive', false, 'Last mission day.'),
    crew: rule(4, 'NASA Artemis crew size', false, 'Four crew members.'),
    baseTowers: rule(2, null, true, 'Solar towers placed from the base kit (before the lander cargo choice).'),
    cargoPicks: rule(2, 'Landers carry limited mass (CLPS-class payload limits)', true, 'The lander has room for TWO of: extra solar tower, battery bank, greenhouse.'),
    batteryBankExtra: rule(12, null, true, 'A battery bank adds this much battery capacity.'),
  },
  energy: {
    towerPeakUnits: rule(6, null, true, 'Units one solar tower makes in a fully sunlit day; production = round(6 x lit% / 100). Tuned from 10 so early-game choices are tight.'),
    batteryMax: rule(8, null, true, 'Base battery carries at most 8 units to the next day; extra is wasted.'),
    batteryStart: rule(6, null, true, 'Starting battery.'),
    darkDayMaxUnits: rule(3, null, true, 'A "dark day" is a day with total production of 3 units or less.'),
    litSource: rule(LOLA, LOLA, false, 'Where each tower\'s sunlit % comes from.'),
  },
  life: {
    max: rule(20, null, true, 'Life-support tank (air + water + food) capacity.'),
    start: rule(14, null, true, 'Starting tank level.'),
    consumptionPerDay: rule(4, 'NASA BVAD crew consumables, integer-scaled', true, 'Crew of 4 uses 1 per person per day.'),
    resupplyLevel: rule(6, null, true, 'Earth resupply sets an empty tank to 6 (non-punishing).'),
    resupplyCancelsWalk: rule(true, null, true, 'After a resupply the next day\'s science walk is cancelled (crew unloads cargo).'),
  },
  actions: {
    runningCost: rule(3, ISS_SHARE, true, 'Keep base running: heat + air recycling, in energy units.'),
    coldHabitatLitPct: rule(20, null, true, 'If the habitat slot is lit less than 20% of the day, heaters work harder.'),
    coldHabitatExtra: rule(1, null, true, 'Extra base-running energy on a cold-habitat day (parking next to the ice is cheap for ice trips but costly in heat).'),
    runningCostInside: rule(2, ISS_SHARE, true, 'Keep base running costs only 2 when the whole crew stays inside (no airlock cycling, less heat loss).'),
    runningPenalty: rule(3, ISS_SHARE, true, 'If not paid: life support -3 extra that day (cold, scrubbers off).'),
    iceBaseCost: rule(2, null, true, 'Ice trip: fixed energy cost.'),
    icePerKmCost: rule(1, null, true, 'Ice trip: +1 energy per started km from the habitat to the nearest permanently shadowed region (PSR).'),
    iceLifeGain: rule(6, 'LCROSS / LRO: water ice lives in permanently shadowed craters; ice -> water -> oxygen by electrolysis', true, 'Life support gained per ice trip (the integer is an assumption).'),
    iceMaxPerDay: rule(1, null, true, 'At most one ice trip a day.'),
    greenhouseCost: rule(2, 'CSA "Food production on the Moon" toolkit', true, 'Greenhouse: energy cost.'),
    greenhouseGain: rule(3, 'CSA "Food production on the Moon" toolkit', true, 'Greenhouse: life support gained.'),
    greenhouseLowLightPct: rule(30, null, true, 'If the greenhouse slot is lit less than 30% of the day it needs grow lights.'),
    greenhouseLowLightExtra: rule(1, null, true, 'Extra energy for grow lights (still allowed).'),
    shieldCost: rule(3, null, true, 'Shield layer: regolith berm +1 level, permanent.'),
    bermMax: rule(3, null, true, 'Berm levels 0-3.'),
    walkRimCost: rule(2, null, true, 'Science walk on the sunlit rim.'),
    walkRimScience: rule(1, null, true, 'Science from a rim walk.'),
    walkIceCost: rule(4, null, true, 'Science walk into a PSR.'),
    walkPerKmCost: rule(1, null, true, 'Science walk to a picked target: +1 energy per started km beyond the first km.'),
    walkIceScience: rule(3, 'Real science target: PSR samples (VIPER / LCROSS class)', true, 'Science from a PSR walk.'),
  },
  radiation: {
    doseLimit: rule(100, null, true, 'Crew radiation budget: 100 = the whole mission limit; at 100 the crew flies home early to rest.'),
    cosmicRays: rule(1, 'Galactic cosmic rays never stop (CRaTER quiet baseline)', false, 'Base dose of a calm day, never zero.'),
    ratioDivisor: rule(8, CRATER, true, 'Storm base dose = round(sparkleRatio / 8); the real ratio sets the number.'),
    stormClamp: rule<[number, number]>([4, 30], null, true, 'Storm base dose is clamped to 4..30.'),
    superClamp: rule<[number, number]>([12, 40], null, true, 'Super-storm base dose is clamped to 12..40.'),
    unknownRatioBase: rule<{ storm: number; super: number }>({ storm: 8, super: 20 }, null, true, 'Base dose when the real ratio is unknown (live mode).'),
    bermTopDivisor: rule(4, ARTEMIS, false, 'Berm level 3 divides the dose by 4.'),
    bermIntermediate: rule('divisor = 1 + level (0,1,2,3 -> 1,2,3,4)', null, true, 'Linear between no berm and the measured level 3.'),
    alarmExposedFraction: rule(0.5, null, true, 'Walkers recalled in time spend half the day outside.'),
    alertOngoingFullDose: rule(true, null, true, 'On a day with an alert still ongoing, going out means the full base dose.'),
    source: rule(CRATER, CRATER, false, 'Where the storm size comes from.'),
  },
  world: {
    startBattery: rule(8, null, true, 'Exploration-first start: the battery starts full at 8 (no cargo screen).'),
    maxTowers: rule(3, null, true, 'The starter kit lets the commander build up to 3 solar towers during the mission.'),
    maxBatteryUnits: rule(1, null, true, 'The starter kit has one battery unit (+12 capacity).'),
    maxGreenhouses: rule(1, null, true, 'The starter kit has one greenhouse.'),
    towerCost: rule(2, null, true, 'Energy to build one solar tower (it starts making energy the next day).'),
    batteryUnitCost: rule(3, null, true, 'Energy to build the battery unit (capacity grows at once).'),
    greenhouseBuildCost: rule(3, null, true, 'Energy to build the greenhouse.'),
    batteryUnitExtra: rule(12, null, true, 'A built battery unit adds this much battery capacity.'),
    darkLitPct: rule(20, null, true, 'Towers lit less than 20% of a day count as a dark day for mission hints.'),
    darkLookAheadDays: rule(3, null, true, 'Mission hints look this many days ahead for dark days.'),
    lowLifeLevel: rule(10, null, true, 'Mission hint "find ice" appears when life support is at or below this.'),
  },
  goal: {
    maxResupplies: rule(2, null, true, 'A mission counts as a success if the crew stays the whole 15 days and needs Earth resupply at most 2 times.'),
  },
  badges: {
    sunHunterAvgLitPct: rule(70, null, true, 'Sun hunter: a tower averaged at least 70% lit.'),
    iceMinerTrips: rule(5, null, true, 'Ice miner: at least 5 ice trips.'),
    safeHarborMaxDose: rule(25, null, true, 'Safe harbor: final dose 25 or less.'),
    scientistMinScience: rule(10, null, true, 'Scientist: science 10 or more.'),
  },
} as const;

export type MoonRules = typeof MOON_RULES;

/** Flat list of every rule for the grown-ups screen. */
export function listMoonRules(): { group: string; key: string; rule: Rule<unknown> }[] {
  return Object.entries(MOON_RULES).flatMap(([group, rules]) =>
    Object.entries(rules).map(([key, r]) => ({ group, key, rule: r as Rule<unknown> })),
  );
}



