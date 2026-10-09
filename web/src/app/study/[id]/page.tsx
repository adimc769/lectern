'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import type { QuizQuestion } from '../../../../../packages/ui/src/types';
import type { PlayerQuestion } from '../../../../../packages/ui/src/study/QuizPlayer';
import { fetchLecture, getFallbackLecture } from '../../../lib/api';
import {
  fetchDocument,
  getExams,
  getExam,
  generateExam,
  getDocQuiz,
  type DocumentDTO,
} from '../../../lib/documents';
import { buildFallbackQuiz } from '../../../lib/quizFallback';
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

type ExamUiStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'empty';

function formatExamScore(score: number): string {
  if (Number.isInteger(score)) return String(score);
  return (Math.round(score * 10) / 10).toFixed(1);
}

export default function StudySessionPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Opening your study circuit...</p>
        </div>
      }
    >
      <StudySessionContent />
    </Suspense>
  );
}

function StudySessionContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [lecture, setLecture] = useState<LectureDTO | null>(null);
  const [quiz, setQuiz] = useState<PlayerQuestion[]>([]);
  const [tab, setTab] = useState<'deck' | 'quiz'>(searchParams.get('tab') === 'quiz' ? 'quiz' : 'deck');
  const [done, setDone] = useState<{ headline: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentDTO | null>(null);
  const [examStatus, setExamStatus] = useState<ExamUiStatus>('idle');
  const [examMessage, setExamMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [examNonce, setExamNonce] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      // 1. Lecture baseline (existing behavior preserved).
      let lectureDetail: LectureDTO | null = null;
      let lectureQuestions: QuizQuestion[] = [];
      try {
        const [detail, questions] = await Promise.all([fetchLecture(id), fetchQuiz(id)]);
        lectureDetail = detail;
        lectureQuestions = questions;
      } catch {
        const fallback = getFallbackLecture(id);
        if (fallback) {
          lectureDetail = fallback;
          lectureQuestions = buildFallbackQuiz(fallback);
        }
      }
      if (cancelled) return;
      if (lectureDetail) {
        setLecture(lectureDetail);
        setError(null);
      }

      // 2. Document exam flow (best-effort; degrades gracefully when missing).
      let doc: DocumentDTO | null = null;
      try {
        doc = await fetchDocument(id);
      } catch {
        doc = null;
      }
      if (cancelled) return;
      setDocument(doc);

      if (!doc) {
        // Lecture-only mode: keep the existing quiz/fallback behavior byte-identical.
        setExamStatus('idle');
        setExamMessage(null);
        if (lectureDetail) {
          setQuiz(lectureQuestions.length > 0 ? lectureQuestions : buildFallbackQuiz(lectureDetail));
        } else {
          setError((prev) => prev ?? 'Could not load study session.');
        }
        return;
      }

      // Document mode: try latest exam WITH questions, else compat quiz, else fallback.
      setExamStatus('loading');
      setExamMessage(null);
      setGenerateError(null);

      try {
        const exams = await getExams(doc.id);
        if (cancelled) return;
        if (exams.length > 0) {
          const latest = exams[exams.length - 1];
          try {
            const detail = await getExam(doc.id, latest.id);
            if (cancelled) return;
            const status = String(detail.status ?? latest.status ?? '').toUpperCase();
            const qs = Array.isArray(detail.questions) ? detail.questions : [];
            if (qs.length > 0) {
              // Exam questions hide the lecture source chip (sourceStart -1).
              setQuiz(qs.map((q) => ({ ...q, sourceStart: -1 }) as PlayerQuestion));
              setExamStatus('ready');
              setExamMessage(null);
              return;
            }
            if (status === 'PROCESSING' || status === 'PENDING' || status === 'GENERATING') {
              setQuiz([]);
              setExamStatus('generating');
              setExamMessage('Your exam is still generating on this device. Use Refresh to check again — no auto-reload.');
              return;
            }
            // FAILED or COMPLETED with no questions: fall through to compat.
          } catch {
            // Exam detail unreachable: fall through to compat honestly.
          }
        }
      } catch {
        // Exam list unreachable (backend still building): fall through to compat.
      }

      if (cancelled) return;
      try {
        const compat = await getDocQuiz(doc.id);
        if (cancelled) return;
        if (compat.length > 0) {
          setQuiz(compat as unknown as PlayerQuestion[]);
          // No exam yet, but compat exists — still offer generation.
          setExamStatus('empty');
          return;
        }
      } catch {
        // Compat quiz unreachable: fall through to lecture fallback honestly.
      }

      if (cancelled) return;
      if (lectureDetail && lectureQuestions.length > 0) {
        setQuiz(lectureQuestions);
      } else if (lectureDetail) {
        setQuiz(buildFallbackQuiz(lectureDetail));
      } else {
        setQuiz([]);
      }
      setExamStatus('empty');
    })();
    return () => {
      cancelled = true;
    };
  }, [id, examNonce]);

  const handleGenerateExam = async (): Promise<void> => {
    if (!document || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      await generateExam(document.id, 8);
      setExamStatus('generating');
      setExamMessage('Exam generation started on this device. Use Refresh to check again — no auto-reload.');
      setExamNonce((n) => n + 1);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Exam generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (error || (!lecture && !document && error)) {
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

  if (!lecture && !document) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Opening your study circuit...</p>
      </div>
    );
  }

  if (done) {
    const doneTitle = lecture?.title ?? document?.title ?? 'Study session';
    const doneId = lecture?.id ?? document?.id ?? id;
    const masteredCount = (lecture?.flashcards ?? []).filter(
      (c) => (getAllBoxes(doneId)[c.id] ?? 1) >= MASTERED_BOX
    ).length;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <StudyMascot message="Circuit complete. Sharp work." />
        <CompletionScreen
          title={doneTitle}
          scoreText={done.headline}
          secondsStudied={done.seconds}
          streak={getStreak()}
          totalMastered={masteredCount}
          onStudyAgain={() => setDone(null)}
          onAsk={() => router.push(`/ask?lectureId=${encodeURIComponent(doneId)}`)}
        />
      </div>
    );
  }

  const sessionTitle = lecture?.title ?? document?.title ?? 'Study session';
  const sessionId = lecture?.id ?? document?.id ?? id;
  const cards = (lecture?.flashcards ?? []).map((c) => ({
    id: c.id,
    question: c.front,
    answer: c.back,
  }));
  const pageCount = typeof document?.pageCount === 'number' ? document.pageCount : 0;
  const canGenerateExam = examStatus === 'empty' && document !== null && pageCount >= 1;
  const showGeneratingPanel = examStatus === 'generating' || examStatus === 'loading';

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

      <h1 className="text-xl font-bold text-[#0F172A] dark:text-white tracking-tight">{sessionTitle}</h1>

      {tab === 'deck' ? (
        <DeckPlayer
          lectureId={sessionId}
          lectureTitle={sessionTitle}
          cards={cards}
          initialBoxes={getAllBoxes(sessionId)}
          onRateCard={(cardId, known) => setBox(sessionId, cardId, rate(getBox(sessionId, cardId), known))}
          onOpenSource={(t) => router.push(`/lectures/${encodeURIComponent(sessionId)}?tab=transcript&t=${t}`)}
          onComplete={(s) => {
            recordSession(sessionId, s.known, s.known + s.learning, s.seconds);
            recordStudyDay();
            setDone({ headline: `${s.known} / ${s.known + s.learning} cleared`, seconds: s.seconds });
          }}
        />
      ) : showGeneratingPanel && quiz.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-[20px] bg-[#FFFFFF] p-8 text-center shadow-[0_8px_24px_rgba(34,28,58,0.10)] dark:bg-[#221C3A]"
        >
          <p className="text-[20px] font-semibold text-[#221C3A] dark:text-[#F5F1FF]">
            {examStatus === 'loading' ? 'Checking for your exam…' : 'Your exam is generating'}
          </p>
          <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
            {examMessage ?? 'Local generation is running on this device. No auto-reload — check back manually.'}
          </p>
          {examStatus === 'generating' ? (
            <button
              type="button"
              onClick={() => setExamNonce((n) => n + 1)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#0F172A] px-6 text-sm font-semibold text-white dark:bg-white dark:text-[#0F172A]"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Refresh</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {canGenerateExam ? (
            <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-4 space-y-2">
              <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
                No exam yet for this document
              </p>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Generate a grounded 8-question exam from {pageCount} {pageCount === 1 ? 'page' : 'pages'} — true/false, identification, and multiple choice. Runs locally on your device.
              </p>
              {generateError ? (
                <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                  {generateError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleGenerateExam}
                disabled={isGenerating}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[#0F172A] px-6 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-[#0F172A]"
              >
                {isGenerating ? 'Starting…' : 'Generate exam'}
              </button>
            </div>
          ) : null}
          <QuizPlayer
            lectureId={sessionId}
            lectureTitle={sessionTitle}
            questions={quiz}
            onOpenSource={(t) => router.push(`/lectures/${encodeURIComponent(sessionId)}?tab=transcript&t=${t}`)}
            onFinish={(r) => {
              recordSession(sessionId, r.score, r.total, r.seconds);
              recordStudyDay();
              setDone({ headline: `${formatExamScore(r.score)} / ${r.total} correct`, seconds: r.seconds });
            }}
          />
        </div>
      )}
    </div>
  );
}
