import { describe, expect, it } from 'vitest';
import { alarmDue, arrivalOutcome, pickPrimary } from './logic';

const base = { goal: 'walkToFlag', nearBase: true, alarm: 'none', buildMode: null, alertOngoing: false, away: false, lowEnergy: false, canAffordBuild: true, canAffordShield: true } as const;

describe('world logic', () => {
  it('rings the alarm after 60 s or 40% of walking', () => {
    const a = { hasAlarm: true, fired: false, walkSpent: 0, walkBudget: 10, playSeconds: 0 };
    expect(alarmDue(a)).toBe(false);
    expect(alarmDue({ ...a, walkSpent: 4 })).toBe(true);
    expect(alarmDue({ ...a, playSeconds: 60 })).toBe(true);
    expect(alarmDue({ ...a, hasAlarm: false, playSeconds: 99 })).toBe(false);
    expect(alarmDue({ ...a, fired: true, playSeconds: 99 })).toBe(false);
  });
  it('20 s to get home', () => {
    expect(arrivalOutcome(19000)).toBe('safe');
    expect(arrivalOutcome(21000)).toBe('late');
  });
  it('one contextual primary button', () => {
    expect(pickPrimary({ ...base, goal: 'buildTower' }).kind).toBe('build');
    expect(pickPrimary({ ...base, goal: 'buildTower', canAffordBuild: false }).disabled).toBe(true);
    expect(pickPrimary({ ...base, goal: 'endDay' }).kind).toBe('endDay');
    expect(pickPrimary({ ...base, goal: 'endDay', nearBase: false, away: true }).kind).toBe('home');
    expect(pickPrimary({ ...base, goal: 'walkToFlag', nearBase: false, away: true, lowEnergy: true }).kind).toBe('home');
    expect(pickPrimary({ ...base, alarm: 'active', nearBase: false }).kind).toBe('runHome');
    expect(pickPrimary({ ...base, goal: 'shieldUp' }).kind).toBe('shield');
    expect(pickPrimary({ ...base, buildMode: 'solarTower' }).kind).toBe('cancelBuild');
  });
});
