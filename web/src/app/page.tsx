'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import { fetchLectures } from '../lib/api';
import { IntakeModal } from '../components/IntakeModal';

export default function HomePage() {
  const [lectures, setLectures] = useState<LectureDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);

  useEffect(() => {
    fetchLectures()
      .then(setLectures)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

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
            {lectures.map((lecture) => (
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
