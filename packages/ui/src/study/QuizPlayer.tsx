import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { QuizQuestion } from '../types';

export interface QuizResult {
  score: number;
  total: number;
  missedIds: string[];
  seconds: number;
}

export interface QuizPlayerProps {
  lectureId: string;
  lectureTitle: string;
  questions: QuizQuestion[];
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

function encouragingLine(score: number, total: number): string {
  if (total <= 0) return 'Circuit complete. Sharp work.';
  const ratio = score / total;
  if (ratio >= 1) return 'Flawless circuit. Sharp work.';
  if (ratio >= 0.75) return `Nice — ${score} in a row territory. Nearly flawless.`;
  if (ratio >= 0.5) return 'Solid lap. Review the tricky ones below.';
  return "Two tricky ones left. You've got this — review and retry.";
}

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
  const [score, setScore] = useState(0);
  const [missedIds, setMissedIds] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showMissedReview, setShowMissedReview] = useState(false);
  const [finalSeconds, setFinalSeconds] = useState(0);
  const startRef = useRef<number>(Date.now());
  const finishCalledRef = useRef(false);

  const handleSelect = (choiceIndex: number): void => {
    if (showResults || selected !== null) return;
    const q = questions[index];
    if (!q) return;
    if (choiceIndex < 0 || choiceIndex >= q.choices.length) return;
    setSelected(choiceIndex);
    if (choiceIndex === q.answerIndex) {
      setScore((s) => s + 1);
    } else {
      setMissedIds((ids) => [...ids, q.id]);
    }
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
    setSelected(null);
  };

  const handleRetry = (): void => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setMissedIds([]);
    setShowResults(false);
    setShowMissedReview(false);
    setFinalSeconds(0);
    startRef.current = Date.now();
    finishCalledRef.current = false;
  };

  useEffect(() => {
    if (showResults || selected !== null || total === 0) return;
    const onKey = (e: KeyboardEvent): void => {
      const n = ['1', '2', '3', '4'].indexOf(e.key);
      if (n >= 0) {
        e.preventDefault();
        handleSelect(n);
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
  const answered = selected !== null;
  const progressNow = showResults ? total : safeIndex + 1;
  const progressPct = Math.round((progressNow / total) * 100);
  const missedQuestions = questions.filter((q) => missedIds.includes(q.id));

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

          <div className="flex flex-col gap-3" role="group" aria-label="Answer choices">
            {current.choices.map((choice, choiceIndex) => {
              const isCorrect = choiceIndex === current.answerIndex;
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
            })}
          </div>

          {answered && (
            <div aria-live="polite" className="mt-5 rounded-2xl bg-[#5B3DF5]/5 p-4 dark:bg-[#9D86FF]/10">
              <p className="text-[15px] font-semibold leading-relaxed text-[#221C3A] dark:text-[#F5F1FF]">
                {selected === current.answerIndex
                  ? 'Correct — nice work.'
                  : `Not quite — the answer is “${current.choices[current.answerIndex]}”.`}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                {current.explanation}
              </p>
              <div className="mt-3">
                {onOpenSource ? (
                  <button
                    type="button"
                    onClick={() => onOpenSource(current.sourceStart)}
                    aria-label={`Open transcript at ${formatTimestamp(current.sourceStart)}`}
                    className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#5B3DF5]/40 px-4 py-2 text-[13px] font-semibold text-[#5B3DF5] motion-safe:transition-colors hover:bg-[#5B3DF5]/10 dark:border-[#9D86FF]/50 dark:text-[#9D86FF] dark:hover:bg-[#9D86FF]/10 ${FOCUS_RING}`}
                  >
                    <span aria-hidden="true">●</span>
                    From the lecture · {formatTimestamp(current.sourceStart)}
                  </button>
                ) : (
                  <span className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#5B3DF5]/40 px-4 py-2 text-[13px] font-semibold text-[#5B3DF5] dark:border-[#9D86FF]/50 dark:text-[#9D86FF]">
                    <span aria-hidden="true">●</span>
                    From the lecture · {formatTimestamp(current.sourceStart)}
                  </span>
                )}
              </div>
            </div>
          )}

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
              {score} / {total}
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
                missedQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border border-[#6B6390]/20 p-4 dark:border-[#B9B0D9]/20"
                  >
                    <p className="text-[15px] font-bold text-[#221C3A] dark:text-[#F5F1FF]">
                      {q.question}
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-[#0CA678] dark:text-[#3DDC97]">
                      Answer: {q.choices[q.answerIndex]}
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed text-[#6B6390] dark:text-[#B9B0D9]">
                      {q.explanation}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default QuizPlayer;
