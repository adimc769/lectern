'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import type { QuizQuestion } from '../../../../../packages/ui/src/types';
import { fetchLecture, getFallbackLecture } from '../../../lib/api';
import { DeckPlayer } from '../../../../../packages/ui/src/study/DeckPlayer';
import { QuizPlayer } from '../../../../../packages/ui/src/study/QuizPlayer';
import { CompletionScreen } from '../../../../../packages/ui/src/study/CompletionScreen';
import { StudyMascot } from '../../../../../packages/ui/src/study/StudyMascot';
import { rate, MASTERED_BOX } from '../../../../../packages/ui/src/study/srs';
import {
  getAllBoxes,
  getBox,
  setBox,
  getStreak,
  recordStudyDay,
  recordSession,
} from '../../../../../packages/ui/src/study/studyStore';

async function fetchQuiz(id: string): Promise<QuizQuestion[]> {
  try {
    const res = await fetch(`/api/lectures/${encodeURIComponent(id)}/quiz`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function StudySessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [lecture, setLecture] = useState<LectureDTO | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);
  const [tab, setTab] = useState<'deck' | 'quiz'>('deck');
  const [done, setDone] = useState<{ headline: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [detail, questions] = await Promise.all([fetchLecture(id), fetchQuiz(id)]);
        if (!cancelled) {
          setLecture(detail);
          setQuiz(questions);
        }
      } catch (err) {
        if (!cancelled) {
          const fallback = getFallbackLecture(id);
          if (fallback) {
            setLecture(fallback);
            setQuiz([]);
          } else {
            setError(err instanceof Error ? err.message : 'Could not load study session.');
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error || (!lecture && error)) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Study session not found</h2>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{error}</p>
        <Link
          href="/study"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A] text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Study Circuit</span>
        </Link>
      </div>
    );
  }

  if (!lecture) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Opening your study circuit...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <StudyMascot message="Circuit complete. Sharp work." />
        <CompletionScreen
          title={lecture.title}
          scoreText={done.headline}
          secondsStudied={done.seconds}
          streak={getStreak()}
          totalMastered={(lecture.flashcards ?? []).filter((c) => (getAllBoxes(lecture.id)[c.id] ?? 1) >= MASTERED_BOX).length}
          onStudyAgain={() => setDone(null)}
          onAsk={() => router.push(`/ask?lectureId=${encodeURIComponent(lecture.id)}`)}
        />
      </div>
    );
  }

  const cards = (lecture.flashcards ?? []).map((c) => ({
    id: c.id,
    question: c.front,
    answer: c.back,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/study"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All circuits</span>
        </Link>
        <div className="flex items-center bg-[#FFFFFF] dark:bg-[#131B2E] p-1 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B]" role="tablist" aria-label="Study mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'deck'}
            onClick={() => setTab('deck')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'deck'
                ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            Flashcards ({cards.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'quiz'}
            onClick={() => setTab('quiz')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'quiz'
                ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                : 'text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            Quiz ({quiz.length})
          </button>
        </div>
      </div>

      <h1 className="text-xl font-bold text-[#0F172A] dark:text-white tracking-tight">{lecture.title}</h1>

      {tab === 'deck' ? (
        <DeckPlayer
          lectureId={lecture.id}
          lectureTitle={lecture.title}
          cards={cards}
          initialBoxes={getAllBoxes(lecture.id)}
          onRateCard={(cardId, known) => setBox(lecture.id, cardId, rate(getBox(lecture.id, cardId), known))}
          onOpenSource={(t) => router.push(`/lectures/${encodeURIComponent(lecture.id)}?tab=transcript&t=${t}`)}
          onComplete={(s) => {
            recordSession(lecture.id, s.known, s.known + s.learning, s.seconds);
            recordStudyDay();
            setDone({ headline: `${s.known} / ${s.known + s.learning} cleared`, seconds: s.seconds });
          }}
        />
      ) : (
        <QuizPlayer
          lectureId={lecture.id}
          lectureTitle={lecture.title}
          questions={quiz}
          onOpenSource={(t) => router.push(`/lectures/${encodeURIComponent(lecture.id)}?tab=transcript&t=${t}`)}
          onFinish={(r) => {
            recordSession(lecture.id, r.score, r.total, r.seconds);
            recordStudyDay();
            setDone({ headline: `${r.score} / ${r.total} correct`, seconds: r.seconds });
          }}
        />
      )}
    </div>
  );
}
