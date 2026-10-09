'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
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
  /** Present for lecture-backed questions; -1 / undefined hides the source chip. */
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

function formatTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  if (total <= 0) return 'Circuit complete. Sharp work.';
  const ratio = score / total;
  if (ratio >= 1) return 'Flawless circuit. Sharp work.';
  if (ratio >= 0.75) return `Nice — ${formatScore(score)} in a row territory. Nearly flawless.`;
  if (ratio >= 0.5) return 'Solid lap. Review the tricky ones below.';
  return "Two tricky ones left. You've got this — review and retry.";
}

function isExamQuestion(q: PlayerQuestion): q is ExamQuestionDTO {
  return (q as ExamQuestionDTO).qtype !== undefined;
}

function getQuestionType(q: PlayerQuestion): ExamQuestionType {
  if (!isExamQuestion(q)) return 'mcq';
  return q.qtype;
}

function getSourceStart(q: PlayerQuestion): number | undefined {
  const raw = (q as { sourceStart?: unknown }).sourceStart;
  return typeof raw === 'number' ? raw : undefined;
}

/** Doc-generated exam questions carry sourceStart -1 or undefined → chip hidden. */
function shouldShowSource(q: PlayerQuestion): boolean {
  const s = getSourceStart(q);
  return typeof s === 'number' && s >= 0;
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
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5B3DF5] dark:focus-visible:ring-[#9D86FF] focus-visible:ring-offset-2';

export const QuizPlayer: React.FC<QuizPlayerProps> = ({
  lectureId,
  lectureTitle,
  questions,
  onOpenSource,
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
    // Skip global keys once this question is answered (mcq/tf lock; ident locks on mark).
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
        className="rounded-[20px] bg-[#FFFFFF] p-8 text-center shadow-[0_8px_24px_rgba(34,28,58,0.10)] dark:bg-[#221C3A] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
      >
        <p className="text-[20px] font-semibold text-[#221C3A] dark:text-[#F5F1FF]">
          No quiz yet for this lecture.
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

  const renderSourceChip = (q: PlayerQuestion): React.ReactNode => {
    if (!shouldShowSource(q)) return null;
    const start = getSourceStart(q) as number;
    if (onOpenSource) {
      return (
        <button
          type="button"
          onClick={() => onOpenSource(start)}
          aria-label={`Open transcript at ${formatTimestamp(start)}`}
          className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#5B3DF5]/40 px-4 py-2 text-[13px] font-semibold text-[#5B3DF5] motion-safe:transition-colors hover:bg-[#5B3DF5]/10 dark:border-[#9D86FF]/50 dark:text-[#9D86FF] dark:hover:bg-[#9D86FF]/10 ${FOCUS_RING}`}
        >
          <span aria-hidden="true">●</span>
          From the lecture · {formatTimestamp(start)}
        </button>
      );
    }
    return (
      <span className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#5B3DF5]/40 px-4 py-2 text-[13px] font-semibold text-[#5B3DF5] dark:border-[#9D86FF]/50 dark:text-[#9D86FF]">
        <span aria-hidden="true">●</span>
        From the lecture · {formatTimestamp(start)}
      </span>
    );
  };

  return (
    <section
      role="region"
      aria-label={`Quiz: ${lectureTitle}`}
      data-lecture-id={lectureId}
      className="rounded-[20px] bg-[#FFFFFF] p-5 shadow-[0_8px_24px_rgba(34,28,58,0.10)] sm:p-8 dark:bg-[#221C3A] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
    >
      {/* Progress header */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <p
            aria-live="polite"
            className="text-[13px] font-semibold tracking-wide text-[#6B6390] dark:text-[#B9B0D9]"
          >
            Q{progressNow}/{total}
          </p>
          <p className="max-w-[60%] truncate text-[13px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
            {lectureTitle}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Quiz progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={progressNow}
          className="h-2.5 w-full overflow-hidden rounded-full bg-[#5B3DF5]/15 dark:bg-[#9D86FF]/20"
        >
          <div
            className="h-full rounded-full bg-[#5B3DF5] motion-safe:transition-[width] motion-safe:duration-200 dark:bg-[#9D86FF]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {!showResults && current ? (
        <div>
          <h2 className="mb-5 text-[26px] font-bold leading-snug text-[#221C3A] sm:text-[30px] dark:text-[#F5F1FF]">
            {current.question}
          </h2>

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
                  let style = 'border-[#5B3DF5]/30 bg-[#FFFFFF] text-[#221C3A] hover:border-[#5B3DF5] dark:border-[#9D86FF]/40 dark:bg-[#221C3A] dark:text-[#F5F1FF] dark:hover:border-[#9D86FF]';
                  if (answered && isCorrect) {
                    style =
                      'border-[#0CA678] bg-[#0CA678]/15 text-[#221C3A] dark:border-[#3DDC97] dark:bg-[#3DDC97]/15 dark:text-[#F5F1FF]';
                  } else if (answered && isPicked && !isCorrect) {
                    style =
                      'border-[#E64980] bg-[#E64980]/15 text-[#221C3A] dark:border-[#F783AC] dark:bg-[#F783AC]/15 dark:text-[#F5F1FF]';
                  } else if (answered) {
                    style =
                      'border-[#6B6390]/25 bg-[#FFFFFF] text-[#221C3A] opacity-60 dark:border-[#B9B0D9]/25 dark:bg-[#221C3A] dark:text-[#F5F1FF]';
                  }
                  return (
                    <button
                      key={choiceIndex}
                      type="button"
                      onClick={() => handleSelect(choiceIndex)}
                      aria-label={`Choice ${choiceIndex + 1}: ${choice}`}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[20px] font-semibold motion-safe:transition-colors ${FOCUS_RING} ${style}`}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5B3DF5]/10 text-[15px] font-bold text-[#5B3DF5] dark:bg-[#9D86FF]/15 dark:text-[#9D86FF]"
                      >
                        {choiceIndex + 1}
                      </span>
                      <span className="flex-1">{choice}</span>
                      {answered && isCorrect && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold text-[#0CA678] dark:text-[#3DDC97]">
                          <Check aria-hidden="true" className="h-5 w-5" />
                          Correct
                        </span>
                      )}
                      {answered && isPicked && !isCorrect && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold text-[#E64980] dark:text-[#F783AC]">
                          <X aria-hidden="true" className="h-5 w-5" />
                          Not quite
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          ) : null}

          {currentType === 'tf' ? (
            <div className="flex flex-col gap-3 sm:flex-row" role="group" aria-label="True or false">
              {(['True', 'False'] as const).map((label, i) => {
                const expected = normalizeTf(tfCorrectAnswer(current));
                const picked = normalizeTf(tfSelected);
                const mine = normalizeTf(label);
                const isCorrectOption = expected !== null && mine === expected;
                const isPicked = tfSelected !== null && mine === picked;
                let style = 'border-[#5B3DF5]/30 bg-[#FFFFFF] text-[#221C3A] hover:border-[#5B3DF5] dark:border-[#9D86FF]/40 dark:bg-[#221C3A] dark:text-[#F5F1FF] dark:hover:border-[#9D86FF]';
                if (answered && isCorrectOption) {
                  style =
                    'border-[#0CA678] bg-[#0CA678]/15 text-[#221C3A] dark:border-[#3DDC97] dark:bg-[#3DDC97]/15 dark:text-[#F5F1FF]';
                } else if (answered && isPicked && !isCorrectOption) {
                  style =
                    'border-[#E64980] bg-[#E64980]/15 text-[#221C3A] dark:border-[#F783AC] dark:bg-[#F783AC]/15 dark:text-[#F5F1FF]';
                } else if (answered) {
                  style =
                    'border-[#6B6390]/25 bg-[#FFFFFF] text-[#221C3A] opacity-60 dark:border-[#B9B0D9]/25 dark:bg-[#221C3A] dark:text-[#F5F1FF]';
                }
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleTfSelect(label)}
                    aria-label={`Answer ${label} (press ${i + 1})`}
                    aria-pressed={tfSelected === label}
                    className={`flex min-h-[64px] flex-1 items-center justify-center gap-3 rounded-2xl border-2 px-4 py-4 text-[22px] font-bold motion-safe:transition-colors ${FOCUS_RING} ${style}`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5B3DF5]/10 text-[15px] font-bold text-[#5B3DF5] dark:bg-[#9D86FF]/15 dark:text-[#9D86FF]"
                    >
                      {i + 1}
                    </span>
                    <span>{label}</span>
                    {answered && isCorrectOption && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold text-[#0CA678] dark:text-[#3DDC97]">
                        <Check aria-hidden="true" className="h-5 w-5" />
                        Correct
                      </span>
                    )}
                    {answered && isPicked && !isCorrectOption && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold text-[#E64980] dark:text-[#F783AC]">
                        <X aria-hidden="true" className="h-5 w-5" />
                        Not quite
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentType === 'identification' ? (
            <div>
              {!identSubmitted ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleIdentSubmit();
                  }}
                  className="flex flex-col gap-3"
                >
                  <label
                    htmlFor={`ident-input-${current.id}`}
                    className="text-[13px] font-semibold tracking-wide text-[#6B6390] dark:text-[#B9B0D9]"
                  >
                    Type your answer, then press Enter or Submit.
                  </label>
                  <input
                    id={`ident-input-${current.id}`}
                    type="text"
                    value={identInput}
                    onChange={(e) => setIdentInput(e.target.value)}
                    placeholder="Type your answer…"
                    autoComplete="off"
                    className={`min-h-[48px] w-full rounded-2xl border-2 border-[#5B3DF5]/30 bg-[#FFFFFF] px-4 py-3 text-[20px] font-semibold text-[#221C3A] placeholder:font-normal placeholder:text-[#6B6390]/70 dark:border-[#9D86FF]/40 dark:bg-[#221C3A] dark:text-[#F5F1FF] dark:placeholder:text-[#B9B0D9]/60 ${FOCUS_RING}`}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={identInput.trim().length === 0}
                      aria-label="Submit identification answer"
                      className={`min-h-[48px] rounded-2xl px-6 text-[15px] font-semibold motion-safe:transition-colors ${FOCUS_RING} ${
                        identInput.trim().length > 0
                          ? 'bg-[#5B3DF5] text-[#FFFFFF] hover:brightness-110 dark:bg-[#9D86FF] dark:text-[#1A1230]'
                          : 'cursor-not-allowed bg-[#5B3DF5]/20 text-[#6B6390] dark:bg-[#9D86FF]/15 dark:text-[#B9B0D9]'
                      }`}
                    >
                      Submit
                    </button>
                  </div>
                </form>
              ) : (
                <div aria-live="polite" className="rounded-2xl bg-[#5B3DF5]/5 p-4 dark:bg-[#9D86FF]/10">
                  <p className="text-[15px] font-semibold leading-relaxed text-[#221C3A] dark:text-[#F5F1FF]">
                    Your answer: “{identInput.trim()}”
                  </p>
                  <p className="mt-2 text-[15px] font-bold text-[#0CA678] dark:text-[#3DDC97]">
                    Key: {isExamQuestion(current) && current.answer ? current.answer : '—'}
                  </p>
                  {isExamQuestion(current) &&
                  Array.isArray(current.acceptableAnswers) &&
                  current.acceptableAnswers.length > 0 ? (
                    <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                      Also accepted: {current.acceptableAnswers.join(' · ')}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                    {current.explanation}
                  </p>
                  {identMark === null ? (
                    <div className="mt-3">
                      <p className="mb-2 text-[13px] font-semibold tracking-wide text-[#6B6390] dark:text-[#B9B0D9]">
                        Mark yourself honestly:
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => handleIdentMark('correct')}
                          aria-label="Mark identification as correct"
                          className={`min-h-[48px] flex-1 rounded-2xl border-2 border-[#0CA678] px-4 text-[15px] font-semibold text-[#0CA678] motion-safe:transition-colors hover:bg-[#0CA678]/10 dark:border-[#3DDC97] dark:text-[#3DDC97] dark:hover:bg-[#3DDC97]/10 ${FOCUS_RING}`}
                        >
                          Correct
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIdentMark('close')}
                          aria-label="Mark identification as close (half credit)"
                          className={`min-h-[48px] flex-1 rounded-2xl border-2 border-[#5B3DF5] px-4 text-[15px] font-semibold text-[#5B3DF5] motion-safe:transition-colors hover:bg-[#5B3DF5]/10 dark:border-[#9D86FF] dark:text-[#9D86FF] dark:hover:bg-[#9D86FF]/10 ${FOCUS_RING}`}
                        >
                          Close (half)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIdentMark('missed')}
                          aria-label="Mark identification as missed"
                          className={`min-h-[48px] flex-1 rounded-2xl border-2 border-[#E64980] px-4 text-[15px] font-semibold text-[#E64980] motion-safe:transition-colors hover:bg-[#E64980]/10 dark:border-[#F783AC] dark:text-[#F783AC] dark:hover:bg-[#F783AC]/10 ${FOCUS_RING}`}
                        >
                          Missed
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[15px] font-semibold text-[#221C3A] dark:text-[#F5F1FF]">
                      {identMark === 'correct'
                        ? 'Marked correct — nice work.'
                        : identMark === 'close'
                          ? 'Marked close — half credit. It will appear in review.'
                          : 'Marked missed — it will appear in review.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {answered && currentType !== 'identification' && (
            <div aria-live="polite" className="mt-5 rounded-2xl bg-[#5B3DF5]/5 p-4 dark:bg-[#9D86FF]/10">
              <p className="text-[15px] font-semibold leading-relaxed text-[#221C3A] dark:text-[#F5F1FF]">
                {currentType === 'mcq'
                  ? selected ===
                    (typeof (current as QuizQuestion).answerIndex === 'number'
                      ? (current as QuizQuestion).answerIndex
                      : (current as ExamQuestionDTO).answerIndex)
                    ? 'Correct — nice work.'
                    : `Not quite — the answer is “${correctAnswerText(current)}”.`
                  : normalizeTf(tfSelected) !== null &&
                      normalizeTf(tfSelected) === normalizeTf(tfCorrectAnswer(current))
                    ? 'Correct — nice work.'
                    : `Not quite — the answer is “${correctAnswerText(current)}”.`}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                {current.explanation}
              </p>
              {shouldShowSource(current) ? (
                <div className="mt-3">{renderSourceChip(current)}</div>
              ) : null}
            </div>
          )}

          {currentType === 'identification' && identSubmitted && shouldShowSource(current) ? (
            <div className="mt-3">{renderSourceChip(current)}</div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleNext}
              disabled={!answered}
              aria-label={safeIndex + 1 >= total ? 'See results' : 'Next question'}
              className={`min-h-[48px] rounded-2xl px-6 text-[15px] font-semibold motion-safe:transition-colors ${FOCUS_RING} ${
                answered
                  ? 'bg-[#5B3DF5] text-[#FFFFFF] hover:brightness-110 dark:bg-[#9D86FF] dark:text-[#1A1230]'
                  : 'cursor-not-allowed bg-[#5B3DF5]/20 text-[#6B6390] dark:bg-[#9D86FF]/15 dark:text-[#B9B0D9]'
              }`}
            >
              {safeIndex + 1 >= total ? 'See results' : 'Next'}
            </button>
          </div>
        </div>
      ) : null}

      {showResults ? (
        <div>
          <div aria-live="polite" className="py-4 text-center">
            <p className="text-[15px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
              Circuit complete · finished in {formatDuration(finalSeconds)}
            </p>
            <p className="mt-1 text-[44px] font-bold leading-tight text-[#221C3A] dark:text-[#F5F1FF]">
              {formatScore(score)} / {total}
            </p>
            <p className="mt-2 text-[20px] font-semibold text-[#221C3A] dark:text-[#F5F1FF]">
              {encouragingLine(score, total)}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setShowMissedReview((v) => !v)}
              aria-expanded={showMissedReview}
              className={`min-h-[48px] rounded-2xl border-2 border-[#5B3DF5] px-6 text-[15px] font-semibold text-[#5B3DF5] motion-safe:transition-colors hover:bg-[#5B3DF5]/10 dark:border-[#9D86FF] dark:text-[#9D86FF] dark:hover:bg-[#9D86FF]/10 ${FOCUS_RING}`}
            >
              {showMissedReview ? 'Hide missed review' : 'Review missed ones'}
            </button>
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry quiz"
              className={`min-h-[48px] rounded-2xl bg-[#5B3DF5] px-6 text-[15px] font-semibold text-[#FFFFFF] motion-safe:transition-colors hover:brightness-110 dark:bg-[#9D86FF] dark:text-[#1A1230] ${FOCUS_RING}`}
            >
              Retry
            </button>
          </div>

          {showMissedReview && (
            <div className="mt-5 flex flex-col gap-3" aria-label="Missed questions review">
              {missedQuestions.length === 0 ? (
                <p className="rounded-2xl bg-[#0CA678]/10 p-4 text-center text-[15px] font-semibold text-[#0CA678] dark:bg-[#3DDC97]/10 dark:text-[#3DDC97]">
                  Nothing missed — flawless circuit.
                </p>
              ) : (
                missedQuestions.map((q) => {
                  const t = getQuestionType(q);
                  return (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-[#6B6390]/20 p-4 dark:border-[#B9B0D9]/20"
                    >
                      <p className="text-[15px] font-bold text-[#221C3A] dark:text-[#F5F1FF]">
                        {q.question}
                      </p>
                      <p className="mt-2 text-[15px] font-semibold text-[#0CA678] dark:text-[#3DDC97]">
                        {t === 'identification'
                          ? `Key: ${correctAnswerText(q)}`
                          : `Answer: ${correctAnswerText(q)}`}
                      </p>
                      {t === 'identification' &&
                      isExamQuestion(q) &&
                      Array.isArray(q.acceptableAnswers) &&
                      q.acceptableAnswers.length > 0 ? (
                        <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                          Also accepted: {q.acceptableAnswers.join(' · ')}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                        {q.explanation}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default QuizPlayer;
