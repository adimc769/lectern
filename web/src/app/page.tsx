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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  const mostRecentLecture = lectures.length > 0 ? lectures[0] : null;
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
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
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

      {/* Judge-Mode banner (below header) */}
      <div className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] shrink-0">
            <Gavel className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
                Judge Mode — 60s demo
              </h2>
              <OfflineBadge source={source} compact />
            </div>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed max-w-xl">
              One click seeds a live lecture on the backend, then opens the full study
              workspace: summary, transcript, flashcards, and Q&amp;A.
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

      {/* Seed error toast (5s auto-dismiss) */}
      {seedError && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-2xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-amber-200 dark:border-amber-900/60 shadow-xs text-xs font-medium text-[#0F172A] dark:text-white max-w-[calc(100vw-2rem)]"
        >
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{seedError}</span>
          <button
            type="button"
            onClick={() => setSeedError(null)}
            aria-label="Dismiss notification"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#FAF9F5] dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors shrink-0 cursor-pointer"
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
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Upload audio files or record a classroom lecture with your microphone.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#F4F4F0] dark:hover:bg-[#1E293B] text-[#0F172A] dark:text-white border border-[#E5E5DF] dark:border-[#1E293B] text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-rose-500" />
              <span>Record lecture</span>
            </button>

            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Browse files</span>
            </button>
          </div>
        </div>

        {/* Technical specs & Local notice */}
        <div className="pt-3 border-t border-[#F4F4F0] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#94A3B8]">Formats:</span>
            <span>MP3, WAV, M4A, WebM, FLAC (up to 2 GB)</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#0D9488]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium text-[11px]">Processed locally on your device</span>
          </div>
        </div>
      </div>

      {/* Continue Studying Section (if lectures exist) */}
      {mostRecentLecture && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Continue studying
          </h2>

          <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
                <span className="inline-flex items-center gap-1 text-[#0D9488] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{mostRecentLecture.status}</span>
                </span>
                <span>&bull;</span>
                <span>{formatDuration(mostRecentLecture.duration || 0)}</span>
                <span>&bull;</span>
                <span>{formatDate(mostRecentLecture.createdAt)}</span>
              </div>

              <h3 className="text-base font-bold text-[#0F172A] dark:text-white truncate">
                {mostRecentLecture.title}
              </h3>

              {mostRecentLecture.summary && (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2 max-w-2xl leading-relaxed">
                  {mostRecentLecture.summary}
                </p>
              )}
            </div>

            <Link
              href={`/lectures/${mostRecentLecture.id}`}
              className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-xs"
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
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Recent lectures
          </h2>

          <Link
            href="/lectures"
            className="text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
          >
            View all lectures &rarr;
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 text-center rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] text-xs text-[#64748B]">
            Loading your lectures...
          </div>
        ) : lectures.length === 0 ? (
          /* Empty State for New User */
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#1E293B] p-12 text-center space-y-4 bg-[#FAF9F5] dark:bg-[#101827]">
            <div className="w-12 h-12 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                No lectures yet.
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
                Upload your first lecture to get a transcript, summary, key terms, and flashcards.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Upload your first lecture</span>
            </button>
          </div>
        ) : (
          /* Compact Lecture List */
          <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] divide-y divide-[#F4F4F0] dark:divide-[#1E293B] overflow-hidden shadow-xs">
            {recentLectures.map((lecture) => (
              <div
                key={lecture.id}
                className="p-4 sm:px-6 hover:bg-[#FAF9F5] dark:hover:bg-[#182238] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                    <span>{formatDuration(lecture.duration || 0)}</span>
                    <span>&bull;</span>
                    <span>{formatDate(lecture.createdAt)}</span>
                  </div>

                  <Link
                    href={`/lectures/${lecture.id}`}
                    className="text-sm font-semibold text-[#0F172A] dark:text-white hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition-colors block truncate"
                  >
                    {lecture.title}
                  </Link>
                </div>

                {/* Sub-tools Quick Jump */}
                <div className="flex items-center gap-3 shrink-0 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <Link
                    href={`/lectures/${lecture.id}?tab=summary`}
                    className="hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Summary</span>
                  </Link>

                  <span>&bull;</span>

                  <Link
                    href={`/lectures/${lecture.id}?tab=transcript`}
                    className="hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1"
                  >
                    <FileAudio className="w-3.5 h-3.5" />
                    <span>Transcript</span>
                  </Link>

                  <span>&bull;</span>

                  <Link
                    href={`/lectures/${lecture.id}?tab=flashcards`}
                    className="hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Intake Modal */}
      <IntakeModal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />
    </div>
  );
}
