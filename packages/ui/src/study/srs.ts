/**
 * Pure Leitner-box SRS helpers for the Study Circuit.
 *
 * PURE module: no DOM, no storage, no imports. Safe for SSR and unit tests.
 */

export const MIN_BOX = 1;
export const MAX_BOX = 5;
export const MASTERED_BOX = 5;

/** Clamp any input into the valid box range 1..5 (NaN → 1). */
function clampBox(box: number): number {
  if (typeof box !== 'number' || Number.isNaN(box)) return MIN_BOX;
  if (box < MIN_BOX) return MIN_BOX;
  if (box > MAX_BOX) return MAX_BOX;
  return box;
}

/**
 * Advance or reset a card's Leitner box.
 * Known → +1 (capped at 5); still learning → back to 1.
 * Out-of-range input is clamped to 1..5 before rating.
 */
export function rate(box: number, known: boolean): number {
  const clamped = clampBox(box);
  if (!known) return MIN_BOX;
  return Math.min(MAX_BOX, clamped + 1);
}

/**
 * Sort cards due-first (ascending by box). Stable: equal boxes keep
 * their original relative order. Never mutates the input array.
 */
export function sortDueFirst<T extends { box: number }>(cards: T[]): T[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const diff = a.card.box - b.card.box;
      if (diff !== 0) return diff;
      return a.index - b.index;
    })
    .map((entry) => entry.card);
}

/**
 * Percentage (0–100) of boxes at MASTERED_BOX. Empty array → 0.
 */
export function masteryPercent(boxes: number[]): number {
  if (boxes.length === 0) return 0;
  let mastered = 0;
  for (const box of boxes) {
    if (box === MASTERED_BOX) mastered += 1;
  }
  return (mastered / boxes.length) * 100;
}
