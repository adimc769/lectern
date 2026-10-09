'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, X, RotateCcw, Award } from 'lucide-react';
import type { QuizQuestion } from '../types';

/**
 * LOCAL mirror of the backend ExamQuestionDTO contract.
 * packages/ui must stay dependency-free, so this is intentionally NOT
 * imported from @lectern/shared. Keep in sync with the backend contract:
 * { id, qtype, question, choices?, answerIndex?, answer?,
 *   acceptableAnswers?, explanation, pageNo?, section? }
 */
export type ExamQuestionType = 'mcq' | 'tf' | 'identification';

export interface ExamQuestionDTO {
  id: string;
  qtype: ExamQuestionType;
  question: string;
  choices?: [string, string, string, string];
  answerIndex?: number;
  answer?: string;
  acceptableAnswers?: string[];
  explanation: string;
  pageNo?: number | null;
  section?: string | null;
  /** Legacy field retained for contract compatibility; citations are omitted in UI. */
  sourceStart?: number;
}

/** Union accepted by the player. Missing qtype = legacy mcq. */
export type PlayerQuestion = QuizQuestion | ExamQuestionDTO;

export interface QuizResult {
  score: number;
  total: number;
  missedIds: string[];
  seconds: number;
}

export interface QuizPlayerProps {
  lectureId: string;
  lectureTitle: string;
  questions: PlayerQuestion[];
  onOpenSource?: (start: number) => void;
  onFinish?: (result: QuizResult) => void;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Shows one decimal only when a half-point is present (e.g. 2.5 / 4). */
function formatScore(score: number): string {
  if (Number.isInteger(score)) return String(score);
  return (Math.round(score * 10) / 10).toFixed(1);
}

function encouragingLine(score: number, total: number): string {
  if (total <= 0) return 'Quiz completed. Solid work.';
  const ratio = score / total;
  if (ratio >= 1) return 'Flawless score! Exceptional retention.';
  if (ratio >= 0.75) return 'Great performance! Nearly complete mastery.';
  if (ratio >= 0.5) return 'Good attempt. Review the tricky questions below to lock it in.';
  return 'Keep practicing — review the missed questions and try again.';
}

function isExamQuestion(q: PlayerQuestion): q is ExamQuestionDTO {
  return (q as ExamQuestionDTO).qtype !== undefined;
}

function getQuestionType(q: PlayerQuestion): ExamQuestionType {
  if (!isExamQuestion(q)) return 'mcq';
  return q.qtype;
}

function normalizeTf(value: unknown): 'true' | 'false' | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === 't' || v === '1') return 'true';
  if (v === 'false' || v === 'f' || v === '0') return 'false';
  return null;
}

function tfCorrectAnswer(q: PlayerQuestion): string {
  if (isExamQuestion(q) && typeof q.answer === 'string' && q.answer.trim().length > 0) {
    return q.answer.trim();
  }
  return '';
}

function correctAnswerText(q: PlayerQuestion): string {
  const t = getQuestionType(q);
  if (t === 'tf') return tfCorrectAnswer(q);
  if (t === 'identification') {
    return isExamQuestion(q) && typeof q.answer === 'string' ? q.answer : '';
  }
  // mcq (legacy or exam mcq)
  const choices = (q as QuizQuestion).choices ?? (q as ExamQuestionDTO).choices;
  const idx =
    typeof (q as QuizQuestion).answerIndex === 'number'
      ? (q as QuizQuestion).answerIndex
      : (q as ExamQuestionDTO).answerIndex;
  if (Array.isArray(choices) && typeof idx === 'number' && choices[idx] !== undefined) {
    return String(choices[idx]);
  }
  return '';
}

type IdentMark = 'correct' | 'close' | 'missed';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] dark:focus-visible:ring-white focus-visible:ring-offset-2';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuizPlayer: React.FC<QuizPlayerProps> = ({
  lectureId,
  lectureTitle,
  questions,
  onFinish,
}) => {
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [tfSelected, setTfSelected] = useState<string | null>(null);
  const [identInput, setIdentInput] = useState('');
  const [identSubmitted, setIdentSubmitted] = useState(false);
  const [identMark, setIdentMark] = useState<IdentMark | null>(null);
  const [score, setScore] = useState(0);
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showMissedReview, setShowMissedReview] = useState(false);
  const [finalSeconds, setFinalSeconds] = useState(0);
  const startRef = useRef<number>(Date.now());
  const finishCalledRef = useRef(false);

  const resetPerQuestion = (): void => {
    setSelected(null);
    setTfSelected(null);
    setIdentInput('');
    setIdentSubmitted(false);
    setIdentMark(null);
  };

  const handleSelect = (choiceIndex: number): void => {
    if (showResults || selected !== null) return;
    const q = questions[index];
    if (!q) return;
    if (getQuestionType(q) !== 'mcq') return;
    const choices = (q as QuizQuestion).choices ?? (q as ExamQuestionDTO).choices;
    const answerIndex =
      typeof (q as QuizQuestion).answerIndex === 'number'
        ? (q as QuizQuestion).answerIndex
        : (q as ExamQuestionDTO).answerIndex;
    if (!Array.isArray(choices)) return;
    if (choiceIndex < 0 || choiceIndex >= choices.length) return;
    if (typeof answerIndex !== 'number') return;
    setSelected(choiceIndex);
    if (choiceIndex === answerIndex) {
      setScore((s) => s + 1);
    } else {
      setMissedIds((ids) => [...ids, q.id]);
    }
  };

  const handleTfSelect = (value: 'True' | 'False'): void => {
    if (showResults || tfSelected !== null) return;
    const q = questions[index];
    if (!q) return;
    if (getQuestionType(q) !== 'tf') return;
    setTfSelected(value);
    const expected = normalizeTf(tfCorrectAnswer(q));
    const picked = normalizeTf(value);
    if (expected !== null && picked !== null && expected === picked) {
      setScore((s) => s + 1);
    } else {
      setMissedIds((ids) => [...ids, q.id]);
    }
  };

  const handleIdentSubmit = (): void => {
    if (showResults || identSubmitted) return;
    const q = questions[index];
    if (!q) return;
    if (getQuestionType(q) !== 'identification') return;
    if (identInput.trim().length === 0) return;
    setIdentSubmitted(true);
  };

  const handleIdentMark = (mark: IdentMark): void => {
    if (showResults || !identSubmitted || identMark !== null) return;
    const q = questions[index];
    if (!q) return;
    setIdentMark(mark);
    if (mark === 'correct') {
      setScore((s) => s + 1);
    } else if (mark === 'close') {
      setScore((s) => s + 0.5);
      setMissedIds((ids) => [...ids, q.id]);
    } else {
      setMissedIds((ids) => [...ids, q.id]);
    }
  };

  const isAnswered = (q: PlayerQuestion | undefined): boolean => {
    if (!q) return false;
    const t = getQuestionType(q);
    if (t === 'mcq') return selected !== null;
    if (t === 'tf') return tfSelected !== null;
    return identMark !== null;
  };

  const handleNext = (): void => {
    if (index + 1 >= total) {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      setFinalSeconds(seconds);
      setShowResults(true);
      if (!finishCalledRef.current) {
        finishCalledRef.current = true;
        onFinish?.({ score, total, missedIds, seconds });
      }
      return;
    }
    setIndex((i) => i + 1);
    resetPerQuestion();
  };

  const handleRetry = (): void => {
    setIndex(0);
    resetPerQuestion();
    setScore(0);
    setMissedIds([]);
    setShowResults(false);
    setShowMissedReview(false);
    setFinalSeconds(0);
    startRef.current = Date.now();
    finishCalledRef.current = false;
  };

  useEffect(() => {
    if (showResults || total === 0) return;
    const q = questions[Math.min(index, total - 1)];
    if (!q) return;
    const t = getQuestionType(q);
    if (t === 'mcq' && selected !== null) return;
    if (t === 'tf' && tfSelected !== null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (t === 'mcq') {
        const n = ['1', '2', '3', '4'].indexOf(e.key);
        if (n >= 0) {
          e.preventDefault();
          handleSelect(n);
        }
      } else if (t === 'tf') {
        if (e.key === '1') {
          e.preventDefault();
          handleTfSelect('True');
        } else if (e.key === '2') {
          e.preventDefault();
          handleTfSelect('False');
        }
      } else if (t === 'identification') {
        if (e.key === 'Enter' && !identSubmitted) {
          e.preventDefault();
          handleIdentSubmit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (total === 0) {
    return (
      <section
        role="region"
        aria-label={`Quiz: ${lectureTitle}`}
        data-lecture-id={lectureId}
        className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-8 text-center shadow-xs"
      >
        <p className="text-base font-semibold text-[#0F172A] dark:text-white">
          No quiz questions available for this material yet.
        </p>
      </section>
    );
  }

  const safeIndex = Math.min(index, total - 1);
  const current = questions[safeIndex];
  const currentType = current ? getQuestionType(current) : 'mcq';
  const answered = isAnswered(current);
  const progressNow = showResults ? total : safeIndex + 1;
  const progressPct = Math.round((progressNow / total) * 100);
  const missedQuestions = questions.filter((q) => missedIds.includes(q.id));

  const isMcqCorrect =
    currentType === 'mcq' &&
    selected !== null &&
    selected ===
      (typeof (current as QuizQuestion).answerIndex === 'number'
        ? (current as QuizQuestion).answerIndex
        : (current as ExamQuestionDTO).answerIndex);

  const isTfCorrect =
    currentType === 'tf' &&
    normalizeTf(tfSelected) !== null &&
    normalizeTf(tfSelected) === normalizeTf(tfCorrectAnswer(current));

  return (
    <section
      role="region"
      aria-label={`Quiz: ${lectureTitle}`}
      data-lecture-id={lectureId}
      className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-8 shadow-xs space-y-6"
    >
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Question {progressNow} of {total}
          </span>
          <span className="max-w-[60%] truncate text-[#0F172A] dark:text-white">
            {lectureTitle}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={progressNow}
          className="h-2 w-full overflow-hidden rounded-full bg-[#F1F1EC] dark:bg-[#1E293B]"
        >
          <div
            className="h-full rounded-full bg-[#0F172A] dark:bg-white motion-safe:transition-[width] motion-safe:duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {!showResults && current ? (
        <div className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white leading-snug">
            {current.question}
          </h2>

          {/* MCQ Option List */}
          {currentType === 'mcq' ? (
            <div className="flex flex-col gap-3" role="group" aria-label="Answer choices">
              {((current as QuizQuestion).choices ?? (current as ExamQuestionDTO).choices ?? []).map(
                (choice, choiceIndex) => {
                  const answerIndex =
                    typeof (current as QuizQuestion).answerIndex === 'number'
                      ? (current as QuizQuestion).answerIndex
                      : (current as ExamQuestionDTO).answerIndex;
                  const isCorrect = choiceIndex === answerIndex;
                  const isPicked = choiceIndex === selected;

                  let cardStyle =
                    'border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5]/40 dark:bg-[#182238]/40 hover:bg-[#FAF9F5] dark:hover:bg-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#334155] text-[#0F172A] dark:text-white';
                  let badgeStyle =
                    'bg-[#E5E5DF] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]';

                  if (answered) {
                    if (isCorrect) {
                      cardStyle =
                        'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-semibold shadow-xs';
                      badgeStyle = 'bg-emerald-500 text-white';
                    } else if (isPicked && !isCorrect) {
                      cardStyle =
                        'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 font-semibold shadow-xs';
                      badgeStyle = 'bg-rose-500 text-white';
                    } else {
                      cardStyle =
                        'border-[#E5E5DF]/60 dark:border-[#1E293B]/60 bg-transparent opacity-45 text-[#64748B] dark:text-[#94A3B8]';
                      badgeStyle = 'bg-[#F1F1EC] dark:bg-[#1E293B] text-[#94A3B8]';
                    }
                  }

                  return (
                    <button
                      key={choiceIndex}
                      type="button"
                      onClick={() => handleSelect(choiceIndex)}
                      aria-label={`Choice ${LETTERS[choiceIndex] || choiceIndex + 1}: ${choice}`}
                      className={`flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border p-4 text-left text-sm sm:text-base transition-colors cursor-pointer ${FOCUS_RING} ${cardStyle}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${badgeStyle}`}
                      >
                        {LETTERS[choiceIndex] || choiceIndex + 1}
                      </span>
                      <span className="flex-1 leading-relaxed">{choice}</span>

                      {answered && isCorrect && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                          <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          Correct
                        </span>
                      )}
                      {answered && isPicked && !isCorrect && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                          <X aria-hidden="true" className="h-3.5 w-3.5" />
                          Wrong
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          ) : null}

          {/* True / False Option List */}
          {currentType === 'tf' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="True or false">
              {(['True', 'False'] as const).map((label, i) => {
                const expected = normalizeTf(tfCorrectAnswer(current));
                const picked = normalizeTf(tfSelected);
                const mine = normalizeTf(label);
                const isCorrectOption = expected !== null && mine === expected;
                const isPicked = tfSelected !== null && mine === picked;

                let cardStyle =
                  'border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5]/40 dark:bg-[#182238]/40 hover:bg-[#FAF9F5] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-white';

                if (answered) {
                  if (isCorrectOption) {
                    cardStyle =
                      'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-bold';
                  } else if (isPicked && !isCorrectOption) {
                    cardStyle =
                      'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 font-bold';
                  } else {
                    cardStyle =
                      'border-[#E5E5DF]/60 dark:border-[#1E293B]/60 bg-transparent opacity-45 text-[#64748B] dark:text-[#94A3B8]';
                  }
                }

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleTfSelect(label)}
                    aria-label={`Answer ${label} (press ${i + 1})`}
                    aria-pressed={tfSelected === label}
                    className={`flex min-h-[60px] items-center justify-center gap-3 rounded-xl border p-4 text-base font-bold transition-colors cursor-pointer ${FOCUS_RING} ${cardStyle}`}
                  >
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">[{i + 1}]</span>
                    <span>{label}</span>
                    {answered && isCorrectOption && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Check aria-hidden="true" className="h-4 w-4" />
                        Correct
                      </span>
                    )}
                    {answered && isPicked && !isCorrectOption && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300">
                        <X aria-hidden="true" className="h-4 w-4" />
                        Wrong
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Identification */}
          {currentType === 'identification' ? (
            <div className="space-y-4">
              {!identSubmitted ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleIdentSubmit();
                  }}
                  className="space-y-3"
                >
                  <label
                    htmlFor={`ident-input-${current.id}`}
                    className="block text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]"
                  >
                    Type your answer and press Enter:
                  </label>
                  <input
                    id={`ident-input-${current.id}`}
                    type="text"
                    value={identInput}
                    onChange={(e) => setIdentInput(e.target.value)}
                    placeholder="Type your answer…"
                    autoComplete="off"
                    className={`w-full rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] px-4 py-3 text-base font-semibold text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] ${FOCUS_RING}`}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={identInput.trim().length === 0}
                      className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                    >
                      Submit
                    </button>
                  </div>
                </form>
              ) : (
                <div aria-live="polite" className="rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#182238] p-5 space-y-3">
                  <div className="text-sm font-semibold text-[#0F172A] dark:text-white">
                    Your answer: <span className="font-normal italic">&ldquo;{identInput.trim()}&rdquo;</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    Correct key: {isExamQuestion(current) && current.answer ? current.answer : '—'}
                  </div>
                  {isExamQuestion(current) &&
                  Array.isArray(current.acceptableAnswers) &&
                  current.acceptableAnswers.length > 0 ? (
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Also accepted: {current.acceptableAnswers.join(' · ')}
                    </div>
                  ) : null}
                  {current.explanation && (
                    <p className="text-xs sm:text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed pt-1">
                      {current.explanation}
                    </p>
                  )}

                  {identMark === null ? (
                    <div className="pt-3 border-t border-[#E5E5DF] dark:border-[#1E293B] space-y-2">
                      <p className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                        Did you get this correct?
                      </p>
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleIdentMark('correct')}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Correct</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIdentMark('close')}
                          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Close (half credit)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIdentMark('missed')}
                          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Wrong</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-xs font-semibold">
                      {identMark === 'correct' ? (
                        <span className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Marked correct
                        </span>
                      ) : identMark === 'close' ? (
                        <span className="text-amber-700 dark:text-amber-300">
                          Marked close (half credit)
                        </span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-300 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> Marked wrong
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* Feedback Section (Clean Correct / Wrong Banner, No Citations) */}
          {answered && currentType !== 'identification' && (
            <div
              aria-live="polite"
              className={`rounded-xl border p-4 sm:p-5 space-y-1.5 transition-all ${
                isMcqCorrect || isTfCorrect
                  ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-rose-200 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/30'
              }`}
            >
              {isMcqCorrect || isTfCorrect ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Correct</span>
                  </div>
                  {current.explanation && (
                    <p className="text-xs sm:text-sm text-emerald-950/80 dark:text-emerald-200/90 leading-relaxed pt-0.5">
                      {current.explanation}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-sm text-rose-800 dark:text-rose-300">
                    <X className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Wrong</span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-white pt-0.5">
                    Correct answer:{' '}
                    <span className="font-bold underline decoration-rose-400 dark:decoration-rose-500">
                      {correctAnswerText(current)}
                    </span>
                  </p>
                  {current.explanation && (
                    <p className="text-xs sm:text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed pt-1">
                      {current.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Next / Complete button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleNext}
              disabled={!answered}
              aria-label={safeIndex + 1 >= total ? 'See results' : 'Next question'}
              className="px-6 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              {safeIndex + 1 >= total ? 'See results' : 'Next question →'}
            </button>
          </div>
        </div>
      ) : null}

      {/* Results View */}
      {showResults ? (
        <div className="space-y-6 text-center py-4">
          <div aria-live="polite" className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto mb-3">
              <Award className="w-6 h-6" />
            </div>
            <p className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Completed in {formatDuration(finalSeconds)}
            </p>
            <div className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
              {formatScore(score)}{' '}
              <span className="text-xl sm:text-2xl font-normal text-[#94A3B8]">/ {total}</span>
            </div>
            <p className="text-sm sm:text-base font-medium text-[#475569] dark:text-[#CBD5E1] max-w-md mx-auto pt-1">
              {encouragingLine(score, total)}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {missedQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMissedReview((v) => !v)}
                aria-expanded={showMissedReview}
                className="px-5 py-2.5 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#F4F4F0] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                {showMissedReview ? 'Hide missed review' : `Review ${missedQuestions.length} missed question${missedQuestions.length === 1 ? '' : 's'}`}
              </button>
            )}
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry quiz"
              className="px-6 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry quiz</span>
            </button>
          </div>

          {showMissedReview && (
            <div className="mt-6 text-left space-y-3 pt-6 border-t border-[#E5E5DF] dark:border-[#1E293B]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Missed questions review
              </h3>
              {missedQuestions.map((q) => {
                const t = getQuestionType(q);
                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-2"
                  >
                    <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                      {q.question}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {t === 'identification'
                        ? `Key: ${correctAnswerText(q)}`
                        : `Correct answer: ${correctAnswerText(q)}`}
                    </p>
                    {t === 'identification' &&
                    isExamQuestion(q) &&
                    Array.isArray(q.acceptableAnswers) &&
                    q.acceptableAnswers.length > 0 ? (
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        Also accepted: {q.acceptableAnswers.join(' · ')}
                      </p>
                    ) : null}
                    {q.explanation && (
                      <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default QuizPlayer;
