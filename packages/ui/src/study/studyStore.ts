/**
 * localStorage-backed persistence for the Study Circuit.
 *
 * SSR-safe: every storage access is guarded by typeof window checks and
 * try/catch. When localStorage is unavailable (SSR, privacy mode, quota
 * errors) or the stored JSON is corrupt, all functions fall back to an
 * in-memory shim (or safe defaults) and never throw.
 */

import { MAX_BOX, MIN_BOX } from './srs';

export const STORAGE_KEY = 'lectern.study.v1';

export interface LectureStats {
  mastered: number;
  total: number;
  sessions: number;
  secondsStudied: number;
}

interface StreakState {
  count: number;
  lastDay: string | null; // local calendar day as "YYYY-MM-DD"
}

interface PersistedState {
  boxes: Record<string, Record<string, number>>;
  streak: StreakState;
  stats: Record<string, LectureStats>;
}

function createDefaultState(): PersistedState {
  return { boxes: {}, streak: { count: 0, lastDay: null }, stats: {} };
}

/** In-memory fallback so SSR and tests never throw. */
let memoryFallback: PersistedState = createDefaultState();

function hasStorage(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined' &&
      window.localStorage !== null &&
      typeof window.localStorage.getItem === 'function' &&
      typeof window.localStorage.setItem === 'function'
    );
  } catch {
    return false;
  }
}

function isDayKey(value: unknown): value is string {
  return (
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

/** Validate unknown parsed JSON into a safe PersistedState (never throws). */
function sanitizeState(parsed: unknown): PersistedState {
  const fresh = createDefaultState();
  if (typeof parsed !== 'object' || parsed === null) return fresh;
  const record = parsed as Record<string, unknown>;

  // Boxes: keep only finite numbers, clamped to range.
  if (typeof record.boxes === 'object' && record.boxes !== null) {
    const boxes = record.boxes as Record<string, unknown>;
    for (const [lectureId, cards] of Object.entries(boxes)) {
      if (typeof cards !== 'object' || cards === null) continue;
      const clean: Record<string, number> = {};
      for (const [cardKey, box] of Object.entries(
        cards as Record<string, unknown>,
      )) {
        if (typeof box === 'number' && Number.isFinite(box)) {
          clean[cardKey] = Math.min(
            MAX_BOX,
            Math.max(MIN_BOX, box),
          );
        }
      }
      fresh.boxes[lectureId] = clean;
    }
  }

  // Streak: keep only sane count + valid day key.
  if (typeof record.streak === 'object' && record.streak !== null) {
    const streak = record.streak as Record<string, unknown>;
    if (
      typeof streak.count === 'number' &&
      Number.isFinite(streak.count) &&
      streak.count >= 0
    ) {
      fresh.streak.count = Math.floor(streak.count);
    }
    if (isDayKey(streak.lastDay)) {
      fresh.streak.lastDay = streak.lastDay;
    }
  }

  // Stats: keep only finite, non-negative numbers.
  if (typeof record.stats === 'object' && record.stats !== null) {
    const stats = record.stats as Record<string, unknown>;
    for (const [lectureId, entry] of Object.entries(stats)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const num = (v: unknown): number =>
        typeof v === 'number' && Number.isFinite(v) ? v : 0;
      fresh.stats[lectureId] = {
        mastered: Math.max(0, Math.floor(num(e.mastered))),
        total: Math.max(0, Math.floor(num(e.total))),
        sessions: Math.max(0, Math.floor(num(e.sessions))),
        secondsStudied: Math.max(0, num(e.secondsStudied)),
      };
    }
  }

  return fresh;
}

function loadState(): PersistedState {
  if (!hasStorage()) return memoryFallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return createDefaultState();
    return sanitizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

function saveState(state: PersistedState): void {
  // Always mirror to memory so a later storage failure keeps latest data.
  memoryFallback = state;
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / privacy-mode errors: memory mirror already updated.
  }
}

function clampBox(box: number): number {
  if (typeof box !== 'number' || Number.isNaN(box)) return MIN_BOX;
  return Math.min(MAX_BOX, Math.max(MIN_BOX, box));
}

/** Box for a card (default 1). Never throws. */
export function getBox(lectureId: string, cardKey: string): number {
  try {
    const state = loadState();
    const value = state.boxes[lectureId]?.[cardKey];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return MIN_BOX;
    }
    return clampBox(value);
  } catch {
    return MIN_BOX;
  }
}

/** Persist a card's box (clamped to 1..5). Never throws. */
export function setBox(
  lectureId: string,
  cardKey: string,
  box: number,
): void {
  try {
    const state = loadState();
    const lectureBoxes = state.boxes[lectureId] ?? {};
    state.boxes[lectureId] = {
      ...lectureBoxes,
      [cardKey]: clampBox(box),
    };
    saveState(state);
  } catch {
    // Never throw from persistence.
  }
}

/** Copy of all stored boxes for a lecture ({} when none). Never throws. */
export function getAllBoxes(lectureId: string): Record<string, number> {
  try {
    const state = loadState();
    return { ...(state.boxes[lectureId] ?? {}) };
  } catch {
    return {};
  }
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffCalendarDays(from: Date, to: Date): number {
  const startOf = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(to) - startOf(from)) / 86_400_000);
}

function parseDayKey(dayKey: string): Date | null {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

/**
 * Current consecutive-day study streak. Returns 0 when never studied or
 * when the last study day is more than one day before `now`. Never throws.
 */
export function getStreak(now: Date = new Date()): number {
  try {
    const state = loadState();
    const { count, lastDay } = state.streak;
    if (lastDay == null) return 0;
    if (lastDay === toDayKey(now)) return count;
    const lastDate = parseDayKey(lastDay);
    if (lastDate === null) return 0;
    const diff = diffCalendarDays(lastDate, now);
    if (!Number.isFinite(diff)) return 0;
    if (diff === 1) return count; // studied yesterday: streak still alive
    if (diff < 0) return count; // clock skew: don't destroy the streak
    return 0; // gap > 1 day: streak broken
  } catch {
    return 0;
  }
}

/**
 * Record a study day. Same calendar day twice → isNewDay false.
 * Consecutive day → streak + 1. Gap → streak resets to 1.
 * Never throws.
 */
export function recordStudyDay(
  now: Date = new Date(),
): { streak: number; isNewDay: boolean } {
  try {
    const state = loadState();
    const todayKey = toDayKey(now);
    const { count, lastDay } = state.streak;

    if (lastDay === todayKey) {
      return { streak: count, isNewDay: false };
    }
    if (lastDay == null) {
      state.streak = { count: 1, lastDay: todayKey };
      saveState(state);
      return { streak: 1, isNewDay: true };
    }

    const lastDate = parseDayKey(lastDay);
    if (lastDate === null) {
      state.streak = { count: 1, lastDay: todayKey };
      saveState(state);
      return { streak: 1, isNewDay: true };
    }

    const diff = diffCalendarDays(lastDate, now);
    if (!Number.isFinite(diff) || diff < 0) {
      // Invalid or backwards clock: leave the streak untouched.
      return { streak: count, isNewDay: false };
    }
    if (diff === 1) {
      const next = count + 1;
      state.streak = { count: next, lastDay: todayKey };
      saveState(state);
      return { streak: next, isNewDay: true };
    }
    // Gap of 2+ days (or same-day key mismatch): start over.
    state.streak = { count: 1, lastDay: todayKey };
    saveState(state);
    return { streak: 1, isNewDay: true };
  } catch {
    return { streak: 0, isNewDay: false };
  }
}

/**
 * Record one study session: mastered/total snapshot the latest session,
 * sessions increments, seconds accumulate. Never throws.
 */
export function recordSession(
  lectureId: string,
  masteredCount: number,
  totalCount: number,
  seconds: number,
): void {
  try {
    const nonNegativeInt = (v: number): number =>
      Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    const nonNegative = (v: number): number =>
      Number.isFinite(v) ? Math.max(0, v) : 0;
    const state = loadState();
    const prev = state.stats[lectureId];
    state.stats[lectureId] = {
      mastered: nonNegativeInt(masteredCount),
      total: nonNegativeInt(totalCount),
      sessions: (prev?.sessions ?? 0) + 1,
      secondsStudied: (prev?.secondsStudied ?? 0) + nonNegative(seconds),
    };
    saveState(state);
  } catch {
    // Never throw from persistence.
  }
}

/** Latest stats for a lecture, or null when nothing recorded. Never throws. */
export function getLectureStats(
  lectureId: string,
): LectureStats | null {
  try {
    const state = loadState();
    const entry = state.stats[lectureId];
    if (!entry) return null;
    return { ...entry };
  } catch {
    return null;
  }
}
