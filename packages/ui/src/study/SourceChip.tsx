'use client';

import { BookOpen } from 'lucide-react';

export interface SourceChipProps {
  start: number;
  lectureTitle?: string;
  onOpen?: (start: number) => void;
}

/** Format seconds as mm:ss, zero-padded to 2 digits. Guards NaN/negative. */
function formatMmSs(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * SourceChip — button chip linking a card back to its lecture moment.
 * Icon + text (never color-only). Teal/mint accent per DESIGN.md.
 */
export function SourceChip({ start, lectureTitle, onOpen }: SourceChipProps) {
  const label = formatMmSs(start);
  return (
    <button
      type="button"
      className="study-chip"
      onClick={() => onOpen?.(start)}
      aria-label={`Open transcript at ${label}`}
      title={lectureTitle ? `${lectureTitle} · ${label}` : `Open transcript at ${label}`}
    >
      <BookOpen size={14} aria-hidden="true" className="study-chip-icon" />
      <span>{`From the lecture · ${label}`}</span>
    </button>
  );
}

export default SourceChip;
