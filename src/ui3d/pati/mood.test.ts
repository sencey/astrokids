import { describe, expect, it } from 'vitest';
import { patiMood } from './mood';

describe('patiMood', () => {
  it('defaults to happy', () => {
    expect(patiMood({})).toBe('happy');
  });
  it('alarm and super briefing are surprised, beating everything else', () => {
    expect(patiMood({ alarm: true })).toBe('surprised');
    expect(patiMood({ superBriefing: true, storm: true, lifeLow: true })).toBe('surprised');
  });
  it('storm, ongoing alert and shield day are determined', () => {
    expect(patiMood({ storm: true })).toBe('determined');
    expect(patiMood({ alertOngoing: true, tip: true })).toBe('determined');
    expect(patiMood({ shieldDay: true, lifeLow: true })).toBe('determined');
  });
  it('resupply, early return, low life and empty dark battery are sad', () => {
    expect(patiMood({ resupply: true })).toBe('sad');
    expect(patiMood({ earlyReturn: true })).toBe('sad');
    expect(patiMood({ lifeLow: true, live: true })).toBe('sad');
    expect(patiMood({ batteryEmptyDark: true })).toBe('sad');
  });
  it('tips and live mode wink', () => {
    expect(patiMood({ tip: true })).toBe('wink');
    expect(patiMood({ live: true })).toBe('wink');
  });
});
