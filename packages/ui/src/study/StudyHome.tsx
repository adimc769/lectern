'use client';

import React from 'react';
import { Flame, Sparkles, BookOpen, ArrowRight, CreditCard, CheckCircle2 } from 'lucide-react';

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
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] dark:focus-visible:ring-white focus-visible:ring-offset-2';

export const StudyHome: React.FC<StudyHomeProps> = ({
  lectures,
  streak,
  totalMastered,
  onOpenLecture,
  onStudyAll,
}) => {
  const totalCards = lectures.reduce((sum, l) => sum + l.cardCount, 0);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E5E5DF] dark:border-[#1E293B]">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            Study Circuit
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#CBD5E1]">
            Active Leitner spaced repetition and practice quiz circuits across all your materials.
          </p>
        </div>

        {lectures.length > 0 && (
          <button
            type="button"
            onClick={onStudyAll}
            aria-label="Study next available circuit"
            className={`px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs ${FOCUS_RING}`}
          >
            <span>Study next circuit</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Streak card */}
        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              {streak} <span className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">day streak</span>
            </div>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] truncate">
              Daily practice consistency
            </p>
          </div>
        </div>

        {/* Mastered card */}
        <div className="rounded-2xl border border-teal-200/80 dark:border-teal-900/50 bg-teal-50/60 dark:bg-teal-950/20 p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              {totalMastered} <span className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">mastered</span>
            </div>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] truncate">
              Graduated to Box 5 mastery
            </p>
          </div>
        </div>

        {/* Active decks */}
        <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-[#FAF9F5] dark:bg-[#19233C] text-[#0F172A] dark:text-white border border-[#E5E5DF] dark:border-[#1E293B] shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              {lectures.length} <span className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">decks</span>
            </div>
            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] truncate">
              {totalCards} total cards in circulation
            </p>
          </div>
        </div>
      </div>

      {/* Lectures / Decks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Available Study Decks
          </h2>
        </div>

        {lectures.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#1E293B] p-12 text-center space-y-3 bg-[#FAF9F5] dark:bg-[#101827]">
            <div className="w-12 h-12 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
              No study decks yet
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#CBD5E1] max-w-sm mx-auto">
              Import a lecture or document to generate flashcards and practice quizzes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lectures.map((lecture) => {
              const pct = masteryPercent(lecture.cardCount, lecture.masteredCount);
              const isFullyMastered = pct === 100 && lecture.cardCount > 0;

              return (
                <div
                  key={lecture.id}
                  className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] p-6 shadow-xs hover:border-[#CBD5E1] dark:hover:border-[#334155] transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-[#0F172A] dark:text-white line-clamp-2 leading-snug">
                        {lecture.title}
                      </h3>
                      {isFullyMastered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mastered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FAF9F5] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] border border-[#E5E5DF] dark:border-[#1E293B] shrink-0 font-mono">
                          {pct}%
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                        <span>Mastery progress</span>
                        <span className="font-semibold text-[#0F172A] dark:text-white">
                          {lecture.masteredCount} / {lecture.cardCount} cards
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Mastery for ${lecture.title}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        className="h-2 w-full overflow-hidden rounded-full bg-[#F1F1EC] dark:bg-[#1E293B]"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFullyMastered
                              ? 'bg-emerald-500'
                              : 'bg-teal-600 dark:bg-teal-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta stats chips */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F5] dark:bg-[#19233C] border border-[#E5E5DF] dark:border-[#1E293B]">
                        <CreditCard className="w-3 h-3 text-slate-500" />
                        <span>{lecture.cardCount} flashcards</span>
                      </span>
                      {lecture.quizCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F5] dark:bg-[#19233C] border border-[#E5E5DF] dark:border-[#1E293B]">
                          <CheckCircle2 className="w-3 h-3 text-teal-600" />
                          <span>{lecture.quizCount} quiz questions</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action button */}
                  <button
                    type="button"
                    onClick={() => onOpenLecture?.(lecture.id)}
                    aria-label={`Open circuit for ${lecture.title}`}
                    className={`w-full py-2.5 rounded-xl bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#F4F4F0] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-white border border-[#E5E5DF] dark:border-[#1E293B] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs ${FOCUS_RING}`}
                  >
                    <span>{isFullyMastered ? 'Review circuit' : 'Continue circuit'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyHome;
