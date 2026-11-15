import { describe, expect, it } from 'vitest';
import fixtureJson from './fixtures/may-2024.fixture.json';
import { resolveDay } from '../resolveDay';
import {
  applyDay,
  matchShock,
  forecastErrorMinutes,
  guessErrorHours,
  formatHoursMinutes,
  isFinished,
  setForecastGuess,
  startMission,
  summary,
} from '../mission';
import { earnedBadges } from '../badges';
import { bandFromRatio, listRules } from '../rules';
import type { DayChoice, MissionState, Scenario, ScenarioDay } from '../types';

const scenario = fixtureJson as unknown as Scenario;
const day = (i: number): ScenarioDay => scenario.days[i - 1]!;
const none = { water: 0, garden: 0, wall: 0 };
const outside = (over: Partial<DayChoice> = {}): DayChoice => ({ balls: none, location: 'outside', alarmTappedInTime: false, ...over });
const inside = (over: Partial<DayChoice> = {}): DayChoice => ({ balls: none, location: 'inside', alarmTappedInTime: false, ...over });
const withWall = (level: number): MissionState => ({ ...startMission(scenario, 'captain'), wall: level });
const dose = (s: MissionState, d: ScenarioDay, c: DayChoice) => resolveDay(s, d, c, s.mode).result.dose;

describe('bands and rules', () => {
  it('maps RadLab ratio to band', () => {
    expect(bandFromRatio(2.9)).toBe('calm');
    expect(bandFromRatio(3)).toBe('storm');
    expect(bandFromRatio(99.9)).toBe('storm');
    expect(bandFromRatio(100)).toBe('super');
  });
  it('lists rules with provenance fields', () => {
    expect(listRules().length).toBeGreaterThan(10);
    expect(listRules().every((r) => typeof r.rule.isAssumption === 'boolean')).toBe(true);
  });
});

describe('sparkle dose', () => {
  it('inside: ceil(base / divisor)', () => {
    expect(dose(withWall(0), day(3), inside())).toBe(6);
    expect(dose(withWall(1), day(3), inside())).toBe(3);
    expect(dose(withWall(2), day(3), inside())).toBe(2);
    expect(dose(withWall(3), day(3), inside())).toBe(2);
    expect(dose(withWall(3), day(7), inside())).toBe(3);
  });
  it('alarm in time: base 6, wall 3 -> 4', () => {
    expect(dose(withWall(3), day(3), outside({ alarmTappedInTime: true }))).toBe(4);
  });
  it('alarm in time: base 12, wall 3 -> 8 (super with an alarm)', () => {
    const d: ScenarioDay = { ...day(7), alarmAt: '2024-05-14T10:00Z' };
    expect(dose(withWall(3), d, outside({ alarmTappedInTime: true }))).toBe(8);
  });
  it('alarm in time with wall 0 gives no help', () => {
    expect(dose(withWall(0), day(3), outside({ alarmTappedInTime: true }))).toBe(6);
  });
  it('missed alarm: full base', () => {
    expect(dose(withWall(3), day(3), outside())).toBe(6);
  });
  it('unannounced storm outside: full base even if the child taps', () => {
    const d: ScenarioDay = { ...day(7), alertOngoing: false };
    const r = resolveDay(withWall(3), d, outside({ alarmTappedInTime: true }), 'captain').result;
    expect(r.dose).toBe(12);
    expect(r.unannounced).toBe(true);
  });
  it('ongoing alert: not unannounced, outside = full base dose', () => {
    const r = resolveDay(withWall(3), day(7), outside(), 'captain').result;
    expect(r.alertOngoing).toBe(true);
    expect(r.unannounced).toBe(false);
    expect(r.dose).toBe(12);
    expect(resolveDay(withWall(3), day(7), inside(), 'captain').result.dose).toBe(3);
  });
  it('calm day always adds 1, inside or outside', () => {
    expect(dose(withWall(3), day(1), inside())).toBe(1);
    expect(dose(withWall(0), day(1), outside())).toBe(1);
  });
  it('wall balls apply the same day', () => {
    const r = resolveDay(withWall(0), day(3), inside({ balls: { water: 0, garden: 0, wall: 3 } }), 'captain');
    expect(r.result.wallLevel).toBe(3);
    expect(r.result.dose).toBe(2);
    expect(r.nextState.wall).toBe(3);
  });
});

describe('samples and tanks', () => {
  it('outside gives a sample, inside does not (also with alarm)', () => {
    const s = startMission(scenario, 'captain');
    expect(resolveDay(s, day(3), outside(), 'captain').result.sampleGained).toBe(true);
    expect(resolveDay(s, day(3), outside({ alarmTappedInTime: true }), 'captain').result.sampleGained).toBe(true);
    expect(resolveDay(s, day(3), inside(), 'captain').result.sampleGained).toBe(false);
  });
  it('tank: gain capped at +2, minus 2, max 10', () => {
    const s = startMission(scenario, 'captain');
    const r = resolveDay(s, day(1), outside({ balls: { water: 4, garden: 0, wall: 0 } }), 'captain');
    expect(r.nextState.water).toBe(8); // 8 + 2 - 2
    expect(r.nextState.garden).toBe(6); // 8 - 2
  });
  it('tank never exceeds max', () => {
    const s = { ...startMission(scenario, 'captain'), water: 10 };
    expect(resolveDay(s, day(1), outside({ balls: { water: 2, garden: 0, wall: 0 } }), 'captain').nextState.water).toBe(10);
  });
  it('garden gain is at most +1 when sheltered all day', () => {
    const s = startMission(scenario, 'captain');
    const r = resolveDay(s, day(1), inside({ balls: { water: 0, garden: 2, wall: 0 } }), 'captain');
    expect(r.nextState.garden).toBe(7); // 8 + 1 - 2
  });
  it('empty tank: Earth resupply to 3, today sample lost', () => {
    const s = { ...startMission(scenario, 'captain'), water: 2 };
    const r = resolveDay(s, day(1), outside(), 'captain');
    expect(r.result.resupplied.water).toBe(true);
    expect(r.nextState.water).toBe(3);
    expect(r.result.sampleGained).toBe(false);
    expect(r.result.sampleLost).toBe(true);
    expect(r.nextState.samples).toBe(0);
    expect(r.nextState.resupplies).toBe(1);
  });
  it('rejects too many balls', () => {
    expect(() => resolveDay(startMission(scenario, 'captain'), day(1), outside({ balls: { water: 3, garden: 2, wall: 0 } }), 'captain')).toThrow();
  });
});

describe('jar and mission end', () => {
  it('captain: full jar ends mission early', () => {
    let s = startMission(scenario, 'captain');
    s = { ...s, jar: 15, days: [day(7), day(8)] };
    const { nextState } = applyDay(s, outside());
    expect(nextState.jar).toBe(20); // capped
    expect(nextState.outcome).toBe('earlyReturn');
    expect(isFinished(nextState)).toBe(true);
    expect(() => applyDay(nextState, outside())).toThrow();
  });
  it('playmate: jar never ends the mission early', () => {
    let s = startMission(scenario, 'playmate');
    s = { ...s, jar: 19 };
    const r = applyDay(s, outside());
    expect(r.nextState.jar).toBe(20);
    expect(r.nextState.outcome).toBeNull();
  });
  it('playmate filters to 2024-05-10..14 and starts with wall 1, tanks 4', () => {
    const s = startMission(scenario, 'playmate');
    expect(s.days.map((d) => d.date)).toEqual(['2024-05-10', '2024-05-11', '2024-05-12', '2024-05-13', '2024-05-14']);
    expect(s.wall).toBe(1);
    expect(s.water).toBe(4);
  });
  it('playmate: 3 balls, tank gain max +1', () => {
    const s = startMission(scenario, 'playmate');
    expect(() => resolveDay(s, day(3), outside({ balls: { water: 2, garden: 2, wall: 0 } }), 'playmate')).toThrow();
    const r = resolveDay(s, day(3), outside({ balls: { water: 3, garden: 0, wall: 0 } }), 'playmate');
    expect(r.nextState.water).toBe(4); // 4 + 1 - 1
  });
  it('completes after the last day', () => {
    let s = startMission(scenario, 'playmate');
    for (let i = 0; i < 5; i++) s = applyDay(s, inside({ balls: { water: 1, garden: 1, wall: 0 } })).nextState;
    expect(s.outcome).toBe('completed');
  });
});

describe('forecast helper, summary, badges', () => {
  it('12:50 -> 16:36 is 3 h 46 min', () => {
    expect(matchShock(scenario.days, '2024-05-10T12:50Z')).toBe('2024-05-10T16:36Z');
    const m = forecastErrorMinutes(scenario.days, '2024-05-10T12:50Z');
    expect(m).toBe(226);
    expect(formatHoursMinutes(m!)).toBe('3 h 46 min');
  });
  it('day-6 forecast (cloud never came) matches no shock', () => {
    expect(forecastErrorMinutes(scenario.days, '2024-05-13T12:23Z')).toBeNull();
  });
  it('early arrival gives a negative error; ties pick the earlier shock', () => {
    const d = { ...day(5), shocks: [{ eventTime: '2024-06-01T09:00Z', location: 'Earth' }, { eventTime: '2024-06-01T15:00Z', location: 'Earth' }] };
    expect(forecastErrorMinutes([d], '2024-06-01T12:00Z')).toBe(-180);
    expect(matchShock([d], '2024-06-03T12:00Z')).toBeNull();
  });
  it('guess without a matching shock scores null', () => {
    const s = setForecastGuess(startMission(scenario, 'captain'), 'fixture-sim-2', '2024-05-13T12:00Z');
    expect(guessErrorHours(s)).toBeNull();
    expect(earnedBadges(applyDay(s, outside()).nextState)).not.toContain('goodForecaster');
  });
  it('guess scoring uses the matched shock', () => {
    const s = setForecastGuess(startMission(scenario, 'captain'), 'fixture-sim-1', '2024-05-10T20:00Z');
    expect(guessErrorHours(s)).toBeCloseTo(3.4, 5);
  });
  it('summary totals', () => {
    let s = startMission(scenario, 'captain');
    s = applyDay(s, outside({ balls: { water: 2, garden: 2, wall: 0 } })).nextState;
    s = applyDay(s, inside()).nextState;
    const sum = summary(s);
    expect(sum.daysPlayed).toBe(2);
    expect(sum.samples).toBe(1);
    expect(sum.daysSheltered).toBe(1);
    expect(sum.totalSparkles).toBe(2);
    expect(sum.forecastErrors[0]).toEqual({ simulationId: 'fixture-sim-1', errorMinutes: 226 });
  });
  it('goodForecaster only for captain guesses within 7 h', () => {
    let s = startMission(scenario, 'captain');
    s = setForecastGuess(s, 'fixture-sim-1', '2024-05-10T20:00Z');
    s = applyDay(s, outside()).nextState;
    expect(earnedBadges(s)).toContain('goodForecaster');
    s = setForecastGuess(s, 'fixture-sim-1', '2024-05-11T12:00Z');
    expect(earnedBadges(s)).not.toContain('goodForecaster');
  });
  it('patientGuard for a low jar, braveExplorer for many samples', () => {
    let s = startMission(scenario, 'captain');
    s = applyDay(s, outside({ balls: { water: 2, garden: 2, wall: 0 } })).nextState;
    s = applyDay(s, outside({ balls: { water: 2, garden: 2, wall: 0 } })).nextState;
    expect(earnedBadges(s)).toEqual(expect.arrayContaining(['patientGuard', 'braveExplorer', 'masterGardener']));
  });
});

describe('determinism', () => {
  it('same input gives identical output and does not mutate state', () => {
    const s = startMission(scenario, 'captain');
    const snapshot = JSON.stringify(s);
    const c = outside({ balls: { water: 1, garden: 1, wall: 2 }, alarmTappedInTime: true });
    const a = resolveDay(s, day(3), c, 'captain');
    const b = resolveDay(s, day(3), c, 'captain');
    expect(a).toEqual(b);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
