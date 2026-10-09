import React from 'react';

export interface CompletionScreenProps {
  title: string;
  scoreText: string;
  secondsStudied: number;
  streak: number;
  totalMastered: number;
  onStudyAgain?: () => void;
  onAsk?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5B3DF5] dark:focus-visible:ring-[#9D86FF] focus-visible:ring-offset-2';

export const CompletionScreen: React.FC<CompletionScreenProps> = ({
  title,
  scoreText,
  secondsStudied,
  streak,
  totalMastered,
  onStudyAgain,
  onAsk,
}) => {
  return (
    <section
      role="region"
      aria-label={`Study complete: ${title}`}
      className="rounded-[20px] bg-[#FFFFFF] p-8 text-center shadow-[0_8px_24px_rgba(34,28,58,0.10)] dark:bg-[#221C3A] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
    >
      <p className="text-[13px] font-semibold uppercase tracking-widest text-[#6B6390] dark:text-[#B9B0D9]">
        Circuit complete
      </p>
      <h2 className="mt-1 text-[26px] font-bold leading-snug text-[#221C3A] dark:text-[#F5F1FF]">
        {title}
      </h2>

      <div aria-live="polite" className="mt-4">
        <p className="text-[44px] font-bold leading-tight text-[#5B3DF5] dark:text-[#9D86FF]">
          {scoreText}
        </p>
        <p className="mt-1 text-[15px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
          Sharp work — every lap counts.
        </p>
      </div>

      <dl className="mx-auto mt-6 flex max-w-md flex-col gap-3 text-left">
        <div className="flex items-center justify-between rounded-2xl bg-[#5B3DF5]/5 px-4 py-3 dark:bg-[#9D86FF]/10">
          <dt className="text-[13px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
            Time studied
          </dt>
          <dd className="text-[20px] font-bold tabular-nums text-[#221C3A] dark:text-[#F5F1FF]">
            {formatDuration(secondsStudied)}
          </dd>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-[#5B3DF5]/5 px-4 py-3 dark:bg-[#9D86FF]/10">
          <dt className="text-[13px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
            Day streak
          </dt>
          <dd className="text-[20px] font-bold tabular-nums text-[#221C3A] dark:text-[#F5F1FF]">
            {streak}
          </dd>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-[#5B3DF5]/5 px-4 py-3 dark:bg-[#9D86FF]/10">
          <dt className="text-[13px] font-semibold text-[#6B6390] dark:text-[#B9B0D9]">
            Total mastered
          </dt>
          <dd className="text-[20px] font-bold tabular-nums text-[#221C3A] dark:text-[#F5F1FF]">
            {totalMastered}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onStudyAgain}
          aria-label="Study again"
          className={`min-h-[48px] rounded-2xl bg-[#5B3DF5] px-6 text-[15px] font-semibold text-[#FFFFFF] motion-safe:transition-colors hover:brightness-110 dark:bg-[#9D86FF] dark:text-[#1A1230] ${FOCUS_RING}`}
        >
          Study again
        </button>
        <button
          type="button"
          onClick={onAsk}
          aria-label="Ask about this lecture"
          className={`min-h-[48px] rounded-2xl border-2 border-[#5B3DF5] px-6 text-[15px] font-semibold text-[#5B3DF5] motion-safe:transition-colors hover:bg-[#5B3DF5]/10 dark:border-[#9D86FF] dark:text-[#9D86FF] dark:hover:bg-[#9D86FF]/10 ${FOCUS_RING}`}
        >
          Ask about this lecture
        </button>
      </div>
    </section>
  );
};

export default CompletionScreen;
