'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Mic,
  BookOpen,
  Clock,
  Calendar,
  ArrowRight,
  Plus,
  ShieldCheck,
  FileText,
  CreditCard,
  Bookmark,
  FileAudio,
  CheckCircle2,
  Gavel,
  Loader2,
  X,
} from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import type { DataSource } from '../lib/api';
import {
  fetchLecturesWithSource,
  fetchLecture,
  seedDemoLecture,
  notifyBackendFallback,
  getFallbackLectures,
} from '../lib/api';
import { IntakeModal } from '../components/IntakeModal';
import { OfflineBadge } from '../components/OfflineBadge';

export default function HomePage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<LectureDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [source, setSource] = useState<DataSource>('live');
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [lectureCounts, setLectureCounts] = useState<
    Record<string, { cards: number; terms: number; segments: number }>
  >({});
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLecturesWithSource()
      .then((result) => {
        if (cancelled) return;
        setLectures(result.data);
        setSource(result.source);
        if (result.source === 'fallback') {
          notifyBackendFallback();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLectures(getFallbackLectures());
        setSource('fallback');
        notifyBackendFallback();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!seedError) return;
    const timer = setTimeout(() => setSeedError(null), 5000);
    return () => clearTimeout(timer);
  }, [seedError]);

  useEffect(() => {
    if (lectures.length === 0) return;
    let cancelled = false;
    setCountsLoading(true);
    Promise.all(
      lectures.map(async (lecture) => {
        try {
          const detail = await fetchLecture(lecture.id);
          return [
            lecture.id,
            {
              cards: detail.flashcards?.length ?? 0,
              terms: detail.keyTerms?.length ?? 0,
              segments: detail.segments?.length ?? 0,
            },
          ] as const;
        } catch {
          return [
            lecture.id,
            {
              cards: lecture.flashcards?.length ?? 0,
              terms: lecture.keyTerms?.length ?? 0,
              segments: lecture.segments?.length ?? 0,
            },
          ] as const;
        }
      })
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Record<string, { cards: number; terms: number; segments: number }> = {};
        for (const [id, counts] of entries) {
          next[id] = counts;
        }
        setLectureCounts(next);
      })
      .finally(() => {
        if (!cancelled) setCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lectures]);

  const handleSeedDemo = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    setSeedError(null);
    try {
      const { id } = await seedDemoLecture();
      router.push(`/lectures/${id}`);
    } catch {
      const fallback = getFallbackLectures()[0];
      notifyBackendFallback();
      if (fallback) {
        setSeedError('Backend unreachable — opened seeded demo data instead.');
        router.push(`/lectures/${fallback.id}`);
      } else {
        setSeedError('Backend unreachable and no seeded demo data is available.');
      }
    } finally {
      setIsSeeding(false);
    }
  };

  const formatAudioLength = (seconds: number): string => {
    const total = Math.round(seconds);
    if (total < 60) return `${total}s`;
    if (total < 3600) return `${Math.round(total / 60)} min`;
    const hours = Math.floor(total / 3600);
    const mins = Math.round((total - hours * 3600) / 60);
    if (mins === 60) return `${hours + 1}h`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const getProcessingMs = (lecture: LectureDTO): number | null => {
    const start = new Date(lecture.createdAt).getTime();
    const end = new Date(lecture.updatedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const diff = end - start;
    if (diff <= 0) return null;
    return diff;
  };

  const formatProcessingTime = (ms: number): string => {
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds} s`;
    if (totalSeconds < 3600) return `${Math.round(totalSeconds / 60)} min`;
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.round((totalSeconds - hours * 3600) / 60);
    if (mins === 60) return `${hours + 1}h`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const mostRecentLecture = lectures.length > 0 ? lectures[0] : null;
  const mostRecentProcessingMs = mostRecentLecture
    ? getProcessingMs(mostRecentLecture)
    : null;
  const recentLectures = mostRecentLecture
    ? lectures.filter((lecture) => lecture.id !== mostRecentLecture.id)
    : lectures;

  return (
    <div className="space-y-8">
      {/* Header: Greeting & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E5E5DF] dark:border-[#1E293B]">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            Ready to study?
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#CBD5E1]">
            Select a lecture below or add a new recording to generate notes and flashcards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsIntakeOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add lecture</span>
        </button>
      </div>

      {/* Seed error toast (5s auto-dismiss) */}
      {seedError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-2xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-amber-200 dark:border-amber-900/60 shadow-xs text-sm font-medium text-[#0F172A] dark:text-white max-w-[calc(100vw-2rem)]"
        >
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{seedError}</span>
          <button
            type="button"
            onClick={() => setSeedError(null)}
            aria-label="Dismiss notification"
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#FAF9F5] dark:text-[#CBD5E1] dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Intake Quick Area */}
      <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#0F172A] dark:text-white">
              Add new lecture
            </h2>
            <p className="text-sm text-[#475569] dark:text-[#CBD5E1]">
              Upload audio files or record a classroom lecture with your microphone.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#F4F4F0] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-white border border-[#E5E5DF] dark:border-[#1E293B] text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-rose-500" />
              <span>Record lecture</span>
            </button>

            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Browse files</span>
            </button>
          </div>
        </div>

        {/* Technical specs & Local notice */}
        <div className="pt-3 border-t border-[#F4F4F0] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-[#475569] dark:text-[#CBD5E1]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#475569] dark:text-[#CBD5E1]">Formats:</span>
            <span>MP3, WAV, M4A, WebM, FLAC (up to 2 GB)</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#0D9488]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-sm">Processed locally on your device</span>
          </div>
        </div>
      </div>

      {/* Try a sample lecture banner (below Add card) */}
      <div className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] shrink-0">
            <Gavel className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                Try a sample lecture
              </h2>
              <OfflineBadge source={source} compact />
            </div>
            <p className="text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed max-w-xl">
              One click loads a short real lecture so you can explore the full workspace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSeedDemo}
          disabled={isSeeding}
          className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 disabled:opacity-60 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait shrink-0 shadow-xs"
        >
          {isSeeding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Seeding live demo…</span>
            </>
          ) : (
            <>
              <Gavel className="w-4 h-4" />
              <span>Load live demo lecture</span>
            </>
          )}
        </button>
      </div>

      {/* Continue Studying Section (if lectures exist) */}
      {mostRecentLecture && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1]">
            Continue studying
          </h2>

          <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#475569] dark:text-[#CBD5E1]">
                <span className="inline-flex items-center gap-1 text-[#0D9488] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{mostRecentLecture.status}</span>
                </span>
                <span>&bull;</span>
                <span>Audio {formatAudioLength(mostRecentLecture.duration || 0)}</span>
                {mostRecentProcessingMs !== null && (
                  <>
                    <span>&bull;</span>
                    <span>Processed in {formatProcessingTime(mostRecentProcessingMs)}</span>
                  </>
                )}
              </div>

              <h3 className="text-base font-bold text-[#0F172A] dark:text-white truncate">
                {mostRecentLecture.title}
              </h3>

              {mostRecentLecture.summary && (
                <p className="text-sm text-[#475569] dark:text-[#CBD5E1] line-clamp-2 max-w-2xl leading-relaxed">
                  {mostRecentLecture.summary}
                </p>
              )}
            </div>

            <Link
              href={`/lectures/${mostRecentLecture.id}`}
              className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
            >
              <span>Continue studying</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Recent Lectures Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#475569] dark:text-[#CBD5E1]">
            Recent lectures
          </h2>

          <Link
            href="/lectures"
            className="text-sm font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
          >
            View all lectures &rarr;
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 text-center rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] text-sm text-[#475569] dark:text-[#CBD5E1]">
            Loading your lectures...
          </div>
        ) : lectures.length === 0 ? (
          /* Empty State for New User */
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#1E293B] p-12 text-center space-y-4 bg-[#FAF9F5] dark:bg-[#101827]">
            <div className="w-12 h-12 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                No lectures yet.
              </h3>
              <p className="text-sm text-[#475569] dark:text-[#CBD5E1] max-w-sm mx-auto">
                Upload your first lecture to get a transcript, summary, key terms, and flashcards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Upload your first lecture</span>
            </button>
          </div>
        ) : (
          /* Compact Lecture List */
          <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] divide-y divide-[#F4F4F0] dark:divide-[#1E293B] overflow-hidden shadow-xs">
            {recentLectures.map((lecture) => {
              const counts = lectureCounts[lecture.id];
              return (
                <Link
                  key={lecture.id}
                  href={`/lectures/${lecture.id}`}
                  className="p-4 sm:px-6 hover:bg-[#FAF9F5] dark:hover:bg-[#182238] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#475569] dark:text-[#CBD5E1]">
                      <span>Audio {formatAudioLength(lecture.duration || 0)}</span>
                      {getProcessingMs(lecture) !== null && (
                        <>
                          <span>&bull;</span>
                          <span>
                            Processed in{' '}
                            {formatProcessingTime(getProcessingMs(lecture) as number)}
                          </span>
                        </>
                      )}
                    </div>

                    <span className="text-sm font-semibold text-[#0F172A] dark:text-white hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition-colors block truncate">
                      {lecture.title}
                    </span>
                  </div>

                  {/* Count chips (static, no nested links) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {countsLoading && !counts ? (
                      <span
                        className="text-sm text-[#475569] dark:text-[#CBD5E1]"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    ) : (
                      counts && (
                        <>
                          {counts.cards > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#1E293B] text-[#475569] dark:text-[#CBD5E1]">
                              <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {counts.cards} {counts.cards === 1 ? 'card' : 'cards'}
                              </span>
                            </span>
                          )}
                          {counts.terms > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#1E293B] text-[#475569] dark:text-[#CBD5E1]">
                              <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {counts.terms} {counts.terms === 1 ? 'term' : 'terms'}
                              </span>
                            </span>
                          )}
                          {counts.segments > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#1E293B] text-[#475569] dark:text-[#CBD5E1]">
                              <FileAudio className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>
                                {counts.segments}{' '}
                                {counts.segments === 1 ? 'segment' : 'segments'}
                              </span>
                            </span>
                          )}
                        </>
                      )
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Intake Modal */}
      <IntakeModal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />
    </div>
  );
}
