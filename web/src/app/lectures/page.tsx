'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Plus,
  Clock,
  Calendar,
  Layers,
  FileText,
  FileAudio,
  Bookmark,
  ArrowRight,
  Filter,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import { fetchLectures } from '../../lib/api';
import { IntakeModal } from '../../components/IntakeModal';

export default function MyLecturesPage() {
  const [lectures, setLectures] = useState<LectureDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'processing'>('all');
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
        year: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  const filteredLectures = useMemo(() => {
    return lectures.filter((lecture) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        lecture.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lecture.summary && lecture.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lecture.keyTerms &&
          lecture.keyTerms.some((kt) =>
            kt.term.toLowerCase().includes(searchQuery.toLowerCase())
          ));

      const isCompleted = lecture.status === 'COMPLETED';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'ready' && isCompleted) ||
        (statusFilter === 'processing' && !isCompleted);

      return matchesSearch && matchesStatus;
    });
  }, [lectures, searchQuery, statusFilter]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E5E5DF] dark:border-[#1E293B]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              My Lectures
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]">
              {lectures.length} {lectures.length === 1 ? 'lecture' : 'lectures'}
            </span>
          </div>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
            Your local archive of transcribed lectures, study summaries, and flashcards.
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

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic, keyword, or concept..."
            className="w-full bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            All ({lectures.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ready')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'ready'
                ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            Ready ({lectures.filter((l) => l.status === 'COMPLETED').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('processing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'processing'
                ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            In Progress ({lectures.filter((l) => l.status !== 'COMPLETED').length})
          </button>
        </div>
      </div>

      {/* Lectures List */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Loading your lecture archive...
          </p>
        </div>
      ) : filteredLectures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#334155] p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#334155] flex items-center justify-center mx-auto text-[#64748B] dark:text-[#94A3B8]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#0F172A] dark:text-white">
              {searchQuery ? 'No matching lectures' : 'No lectures yet'}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
              {searchQuery
                ? `No lectures found matching "${searchQuery}". Try a different keyword or reset filters.`
                : 'Add your first audio recording to generate an instant transcript, lecture summary, and flashcards.'}
            </p>
          </div>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="px-4 py-2 rounded-xl border border-[#E5E5DF] dark:border-[#334155] text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-[#FAF9F5] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              Reset filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add your first lecture</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLectures.map((lecture) => {
            const isCompleted = lecture.status === 'COMPLETED';
            const cardsCount = lecture.flashcards?.length || 0;
            const termsCount = lecture.keyTerms?.length || 0;
            const segmentsCount = lecture.segments?.length || 0;

            return (
              <div
                key={lecture.id}
                className="group rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-5 hover:border-[#CBD5E1] dark:hover:border-[#334155] hover:shadow-xs transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-600 dark:text-amber-400" />
                          Processing
                        </span>
                      )}

                      <span className="text-[#94A3B8]">•</span>
                      <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(lecture.duration || 0)}
                      </span>
                      <span className="text-[#94A3B8]">•</span>
                      <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(lecture.createdAt)}
                      </span>
                    </div>

                    <Link
                      href={`/lectures/${lecture.id}`}
                      className="text-base sm:text-lg font-semibold text-[#0F172A] dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1 block"
                    >
                      {lecture.title}
                    </Link>

                    {lecture.summary && (
                      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2 leading-relaxed">
                        {lecture.summary}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/lectures/${lecture.id}`}
                    className="self-start sm:self-center px-4 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#0F172A] hover:text-white dark:bg-[#19233C] dark:hover:bg-white dark:hover:text-[#0F172A] border border-[#E5E5DF] dark:border-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <span>Study workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Sub-tools Quick Action Links */}
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#F1F1EC] dark:border-[#1E293B]/70 text-xs font-medium">
                  <span className="text-[#94A3B8] mr-1 text-[11px] uppercase tracking-wider font-semibold">
                    Jump to:
                  </span>

                  <Link
                    href={`/lectures/${lecture.id}?tab=summary`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#E5E5DF] dark:hover:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] transition-colors"
                  >
                    <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span>Summary</span>
                  </Link>

                  <Link
                    href={`/lectures/${lecture.id}?tab=transcript`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#E5E5DF] dark:hover:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] transition-colors"
                  >
                    <FileAudio className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>Transcript ({segmentsCount})</span>
                  </Link>

                  <Link
                    href={`/lectures/${lecture.id}?tab=flashcards`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#E5E5DF] dark:hover:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] transition-colors"
                  >
                    <Layers className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Flashcards ({cardsCount})</span>
                  </Link>

                  <Link
                    href={`/lectures/${lecture.id}?tab=keyTerms`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#E5E5DF] dark:hover:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] transition-colors"
                  >
                    <Bookmark className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    <span>Key Terms ({termsCount})</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Intake Modal */}
      <IntakeModal isOpen={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} />
    </div>
  );
}
