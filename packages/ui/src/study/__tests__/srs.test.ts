import { describe, expect, it } from 'vitest';

import {
  MASTERED_BOX,
  MAX_BOX,
  MIN_BOX,
  masteryPercent,
  rate,
  sortDueFirst,
} from '../srs';

describe('srs constants', () => {
  it('exposes the 1..5 box range with 5 as mastered', () => {
    expect(MIN_BOX).toBe(1);
    expect(MAX_BOX).toBe(5);
    expect(MASTERED_BOX).toBe(5);
  });
});

describe('rate', () => {
  it('moves a known card up one box', () => {
    expect(rate(1, true)).toBe(2);
    expect(rate(2, true)).toBe(3);
    expect(rate(4, true)).toBe(5);
  });

  it('caps a known card at MAX_BOX', () => {
    expect(rate(5, true)).toBe(5);
  });

  it('resets a still-learning card to box 1', () => {
    expect(rate(1, false)).toBe(1);
    expect(rate(3, false)).toBe(1);
    expect(rate(5, false)).toBe(1);
  });

  it('clamps out-of-range input to 1..5 before rating', () => {
    expect(rate(0, true)).toBe(2); // clamped to 1, then +1
    expect(rate(-10, true)).toBe(2);
    expect(rate(99, true)).toBe(5); // clamped to 5, stays capped
    expect(rate(99, false)).toBe(1);
    expect(rate(0, false)).toBe(1);
  });

  it('treats NaN as box 1 and clamps infinities to the range ends', () => {
    expect(rate(NaN, true)).toBe(2);
    expect(rate(NaN, false)).toBe(1);
    expect(rate(Infinity, true)).toBe(5);
    expect(rate(Infinity, false)).toBe(1);
    expect(rate(-Infinity, true)).toBe(2);
  });
});

describe('sortDueFirst', () => {
  it('sorts ascending by box (due first)', () => {
    const cards = [{ box: 3 }, { box: 1 }, { box: 5 }, { box: 2 }];
    expect(sortDueFirst(cards).map((c) => c.box)).toEqual([1, 2, 3, 5]);
  });

  it('is stable: equal boxes keep their original order', () => {
    const cards = [
      { box: 2, id: 'a' },
      { box: 1, id: 'b' },
      { box: 2, id: 'c' },
      { box: 1, id: 'd' },
    ];
    expect(sortDueFirst(cards).map((c) => c.id)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });

  it('never mutates the input and returns a new array', () => {
    const cards = [{ box: 3 }, { box: 1 }, { box: 2 }];
    const snapshot = cards.map((c) => ({ ...c }));
    const sorted = sortDueFirst(cards);
    expect(sorted).not.toBe(cards);
    expect(cards).toEqual(snapshot);
  });

  it('handles an empty array', () => {
    expect(sortDueFirst([])).toEqual([]);
  });
});

describe('masteryPercent', () => {
  it('returns 0 for an empty array', () => {
    expect(masteryPercent([])).toBe(0);
  });

  it('returns 0 when nothing is mastered', () => {
    expect(masteryPercent([1, 2, 3, 4])).toBe(0);
  });

  it('returns 100 when everything is mastered', () => {
    expect(masteryPercent([5, 5, 5])).toBe(100);
  });

  it('computes the mastered share', () => {
    expect(masteryPercent([5, 1, 1, 1])).toBe(25);
    expect(masteryPercent([5, 5, 1, 1])).toBe(50);
  });
});
