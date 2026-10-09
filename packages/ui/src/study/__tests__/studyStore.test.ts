import { beforeEach, describe, expect, it } from 'vitest';

import {
  STORAGE_KEY,
  getAllBoxes,
  getBox,
  getLectureStats,
  getStreak,
  recordSession,
  recordStudyDay,
  setBox,
} from '../studyStore';

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // Storage unavailable: tests below use the in-memory shim.
  }
});

describe('box persistence', () => {
  it('defaults an unknown card to box 1', () => {
    expect(getBox('lec-1', 'card-a')).toBe(1);
  });

  it('round-trips set/get', () => {
    setBox('lec-1', 'card-a', 3);
    expect(getBox('lec-1', 'card-a')).toBe(3);
    setBox('lec-1', 'card-a', 5);
    expect(getBox('lec-1', 'card-a')).toBe(5);
  });

  it('clamps out-of-range boxes on write', () => {
    setBox('lec-1', 'low', 0);
    expect(getBox('lec-1', 'low')).toBe(1);
    setBox('lec-1', 'high', 99);
    expect(getBox('lec-1', 'high')).toBe(5);
  });

  it('keeps boxes namespaced per lecture', () => {
    setBox('lec-1', 'card-a', 4);
    expect(getBox('lec-2', 'card-a')).toBe(1);
    expect(getAllBoxes('lec-1')).toEqual({ 'card-a': 4 });
    expect(getAllBoxes('lec-2')).toEqual({});
  });

  it('returns a copy from getAllBoxes so callers cannot corrupt state', () => {
    setBox('lec-1', 'card-a', 2);
    const boxes = getAllBoxes('lec-1');
    boxes['card-a'] = 5;
    expect(getBox('lec-1', 'card-a')).toBe(2);
  });
});

describe('corrupt storage', () => {
  it('never throws and falls back to defaults on corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{{not-valid-json!!!');

    // Reads must not throw and must return defaults.
    expect(() => getBox('lec-1', 'card-a')).not.toThrow();
    expect(() => getAllBoxes('lec-1')).not.toThrow();
    expect(() => getStreak()).not.toThrow();
    expect(() => getLectureStats('lec-1')).not.toThrow();

    expect(getBox('lec-1', 'card-a')).toBe(1);
    expect(getAllBoxes('lec-1')).toEqual({});
    expect(getStreak()).toBe(0);
    expect(getLectureStats('lec-1')).toBeNull();

    // Writes must not throw either (and self-heal the corrupt entry).
    expect(() => recordStudyDay()).not.toThrow();
    expect(() =>
      recordSession('lec-1', 1, 2, 30),
    ).not.toThrow();
  });

  it('self-heals: writes after corruption succeed', () => {
    window.localStorage.setItem(STORAGE_KEY, 'corrupt');
    setBox('lec-1', 'card-a', 3);
    expect(getBox('lec-1', 'card-a')).toBe(3);
  });
});

describe('study streak (via injected `now`, no Date mocking)', () => {
  // NOTE: month index is 0-based, so 9 === October.
  const day1 = new Date(2026, 9, 5, 12, 0, 0);
  const day1Later = new Date(2026, 9, 5, 20, 30, 0);
  const day2 = new Date(2026, 9, 6, 9, 0, 0);
  const day3 = new Date(2026, 9, 7, 9, 0, 0);
  const afterGap = new Date(2026, 9, 12, 9, 0, 0);

  it('starts at 0 with no history', () => {
    expect(getStreak(day1)).toBe(0);
  });

  it('first study day starts a streak of 1 and is a new day', () => {
    expect(recordStudyDay(day1)).toEqual({ streak: 1, isNewDay: true });
    expect(getStreak(day1Later)).toBe(1);
  });

  it('studying twice on the same day is not a new day', () => {
    expect(recordStudyDay(day1)).toEqual({ streak: 1, isNewDay: true });
    expect(recordStudyDay(day1Later)).toEqual({
      streak: 1,
      isNewDay: false,
    });
    expect(getStreak(day1Later)).toBe(1);
  });

  it('consecutive calendar days increment the streak', () => {
    expect(recordStudyDay(day1)).toEqual({ streak: 1, isNewDay: true });
    expect(recordStudyDay(day2)).toEqual({ streak: 2, isNewDay: true });
    expect(recordStudyDay(day3)).toEqual({ streak: 3, isNewDay: true });
    expect(getStreak(day3)).toBe(3);
  });

  it('a broken streak (2+ day gap) resets to 1', () => {
    expect(recordStudyDay(day1)).toEqual({ streak: 1, isNewDay: true });
    expect(recordStudyDay(day2)).toEqual({ streak: 2, isNewDay: true });
    expect(recordStudyDay(afterGap)).toEqual({
      streak: 1,
      isNewDay: true,
    });
    expect(getStreak(afterGap)).toBe(1);
  });

  it('getStreak reports 0 once a streak has lapsed without new study', () => {
    recordStudyDay(day1);
    expect(getStreak(afterGap)).toBe(0);
  });
});

describe('lecture session stats', () => {
  it('returns null before any session is recorded', () => {
    expect(getLectureStats('lec-1')).toBeNull();
  });

  it('records sessions with incrementing counts and accumulated time', () => {
    recordSession('lec-1', 3, 10, 120);
    expect(getLectureStats('lec-1')).toEqual({
      mastered: 3,
      total: 10,
      sessions: 1,
      secondsStudied: 120,
    });

    recordSession('lec-1', 7, 10, 60);
    expect(getLectureStats('lec-1')).toEqual({
      mastered: 7,
      total: 10,
      sessions: 2,
      secondsStudied: 180,
    });
  });

  it('tracks lectures independently', () => {
    recordSession('lec-1', 2, 5, 30);
    expect(getLectureStats('lec-2')).toBeNull();
    expect(getLectureStats('lec-1')?.sessions).toBe(1);
  });

  it('returns a copy so callers cannot corrupt state', () => {
    recordSession('lec-1', 2, 5, 30);
    const stats = getLectureStats('lec-1');
    if (stats) stats.sessions = 999;
    expect(getLectureStats('lec-1')?.sessions).toBe(1);
  });
});

describe('storage-unavailable shim', () => {
  it('falls back to memory when localStorage is missing (SSR-like)', () => {
    const w = window as unknown as Record<string, unknown>;
    const original = w['localStorage'];
    try {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      expect(() => setBox('lec-mem', 'card-1', 3)).not.toThrow();
      expect(getBox('lec-mem', 'card-1')).toBe(3);
      expect(getAllBoxes('lec-mem')).toEqual({ 'card-1': 3 });
      expect(() => recordStudyDay(new Date(2026, 9, 5))).not.toThrow();
      expect(() =>
        recordSession('lec-mem', 1, 2, 10),
      ).not.toThrow();
      expect(getLectureStats('lec-mem')?.sessions).toBe(1);
    } finally {
      Object.defineProperty(window, 'localStorage', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });
});
