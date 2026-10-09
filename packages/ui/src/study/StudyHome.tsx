'use client';

import React from 'react';
import { Flame } from 'lucide-react';

export interface StudyHomeLecture {
  id: string;
  title: string;
  cardCount: number;
  masteredCount: number;
  quizCount: number;
}

export interface StudyHomeProps {
  lectures: StudyHomeLecture[];
  streak: number;
  totalMastered: number;
  onOpenLecture?: (id: string) => void;
  onStudyAll?: () => void;
}

function masteryPercent(cardCount: number, masteredCount: number): number {
  if (cardCount <= 0) return 0;
  const pct = Math.round((masteredCount / cardCount) * 100);
  return Math.min(100, Math.max(0, pct));
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5B3DF5] dark:focus-visible:ring-[#9D86FF] focus-visible:ring-offset-2';

export const StudyHome: React.FC<StudyHomeProps> = ({
  lectures,
  streak,
  totalMastered,
  onOpenLecture,
  onStudyAll,
}) => {
  return (
    <section
      role="region"
      aria-label="Study home"
      className="rounded-[20px] bg-[#FFF9F0] p-5 dark:bg-[#161226] sm:p-6"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <p
            aria-label={`${streak} day streak`}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#FFFFFF] px-4 py-2 text-[15px] font-semibold text-[#221C3A] shadow-[0_8px_24px_rgba(34,28,58,0.10)] dark:bg-[#221C3A] dark:text-[#F5F1FF] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          >
            <Flame aria-hidden="true" className="h-5 w-5 text-[#FFB020] dark:text-[#FFC53D]" />
            {streak} day streak
          </p>
          <p
            aria-label={`${totalMastered} cards mastered in total`}
            className="text-[15px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]"
          >
            {totalMastered} mastered
          </p>
        </div>
        <button
          type="button"
          onClick={onStudyAll}
          aria-label="Study all lectures"
          className={`min-h-[48px] rounded-2xl bg-[#5B3DF5] px-6 text-[15px] font-semibold text-[#FFFFFF] motion-safe:transition-colors hover:brightness-110 dark:bg-[#9D86FF] dark:text-[#1A1230] ${FOCUS_RING}`}
        >
          Study all
        </button>
      </div>

      {/* Lecture cards */}
      {lectures.length === 0 ? (
        <p className="mt-6 rounded-[20px] bg-[#FFFFFF] p-8 text-center text-[20px] font-semibold text-[#221C3A] shadow-[0_8px_24px_rgba(34,28,58,0.10)] dark:bg-[#221C3A] dark:text-[#F5F1FF] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
          No lectures yet — upload one to start your first circuit.
        </p>
      ) : (
        <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2">
          {lectures.map((lecture) => {
            const pct = masteryPercent(lecture.cardCount, lecture.masteredCount);
            return (
              <li
                key={lecture.id}
                className="rounded-[20px] bg-[#FFFFFF] p-5 shadow-[0_8px_24px_rgba(34,28,58,0.10)] dark:bg-[#221C3A] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              >
                <h3 className="text-[20px] font-bold leading-snug text-[#221C3A] dark:text-[#F5F1FF]">
                  {lecture.title}
                </h3>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
                      {pct}% mastered
                    </p>
                    <p className="text-[13px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
                      {lecture.cardCount} cards · {lecture.quizCount} quiz questions
                    </p>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`Mastery for ${lecture.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-[#5B3DF5]/15 dark:bg-[#9D86FF]/20"
                  >
                    <div
                      className="h-full rounded-full bg-[#5B3DF5] dark:bg-[#9D86FF]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLecture?.(lecture.id)}
                  aria-label={`Continue studying ${lecture.title}`}
                  className={`mt-4 min-h-[48px] w-full rounded-2xl border-2 border-[#5B3DF5] px-6 text-[15px] font-semibold text-[#5B3DF5] motion-safe:transition-colors hover:bg-[#5B3DF5]/10 dark:border-[#9D86FF] dark:text-[#9D86FF] dark:hover:bg-[#9D86FF]/10 ${FOCUS_RING}`}
                >
                  Continue
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default StudyHome;
