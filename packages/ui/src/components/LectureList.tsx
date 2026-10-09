import React, { useState } from 'react';
import {
  BookOpen,
  Clock,
  Calendar,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronRight,
  Filter,
} from 'lucide-react';
import type { LectureListItem, LectureStatus } from '../types';

export interface LectureListProps {
  lectures: LectureListItem[];
  selectedLectureId?: string | null;
  onSelectLecture: (id: string) => void;
  onNewLecture?: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export const formatDuration = (totalSec: number): string => {
  if (!totalSec || isNaN(totalSec)) return '0:00';
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
};

export const STATUS_BADGES: Record<
  LectureStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  done: {
    label: 'Ready',
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-300',
    border: 'border-emerald-700/60',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  },
  converting: {
    label: 'Converting',
    bg: 'bg-amber-950/60',
    text: 'text-amber-300',
    border: 'border-amber-700/60',
    icon: <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />,
  },
  transcribing: {
    label: 'Transcribing',
    bg: 'bg-indigo-950/60',
    text: 'text-indigo-300',
    border: 'border-indigo-700/60',
    icon: <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />,
  },
  embedding: {
    label: 'Indexing',
    bg: 'bg-blue-950/60',
    text: 'text-blue-300',
    border: 'border-blue-700/60',
    icon: <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />,
  },
  summarizing: {
    label: 'Summarizing',
    bg: 'bg-purple-950/60',
    text: 'text-purple-300',
    border: 'border-purple-700/60',
    icon: <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />,
  },
  flashcards: {
    label: 'Flashcards',
    bg: 'bg-teal-950/60',
    text: 'text-teal-300',
    border: 'border-teal-700/60',
    icon: <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />,
  },
  failed: {
    label: 'Failed',
    bg: 'bg-rose-950/60',
    text: 'text-rose-300',
    border: 'border-rose-700/60',
    icon: <AlertCircle className="w-3 h-3 text-rose-400" />,
  },
};

export const LectureList: React.FC<LectureListProps> = ({
  lectures,
  selectedLectureId,
  onSelectLecture,
  onNewLecture,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredLectures = lectures.filter((lec) => {
    const matchesSearch = lec.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
    const matchesStatus = statusFilter === 'all' || lec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Your Lectures</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {lectures.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Stored locally on your device</p>
        </div>

        {onNewLecture && (
          <button
            type="button"
            onClick={onNewLecture}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-950/50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Lecture</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lectures..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 appearance-none pr-7 cursor-pointer"
          >
            <option value="all">All</option>
            <option value="done">Ready</option>
            <option value="transcribing">Processing</option>
            <option value="failed">Failed</option>
          </select>
          <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Content list / states */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 max-h-[600px]">
        {isLoading && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading your offline lectures...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 text-center space-y-3">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-semibold rounded-lg border border-rose-700"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && filteredLectures.length === 0 && (
          <div className="p-8 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">
              {searchQuery ? 'No lectures match your search' : 'No lectures added yet'}
            </p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {searchQuery
                ? 'Try a different keyword or reset filter.'
                : 'Upload an audio file or record directly through your microphone.'}
            </p>
            {!searchQuery && onNewLecture && (
              <button
                type="button"
                onClick={onNewLecture}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Your First Lecture</span>
              </button>
            )}
          </div>
        )}

        {!isLoading &&
          !error &&
          filteredLectures.map((lec) => {
            const isSelected = lec.id === selectedLectureId;
            const badge = STATUS_BADGES[lec.status] || STATUS_BADGES.done;

            return (
              <button
                key={lec.id}
                type="button"
                onClick={() => onSelectLecture(lec.id)}
                className={`w-full text-left p-4 transition-all duration-150 flex items-center justify-between group focus:outline-none ${
                  isSelected
                    ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatDuration(lec.durationSec)}</span>
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold truncate ${
                      isSelected
                        ? 'text-indigo-200'
                        : 'text-slate-200 group-hover:text-white'
                    }`}
                  >
                    {lec.title}
                  </h3>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(lec.createdAt)}</span>
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isSelected
                      ? 'text-indigo-400 translate-x-0.5'
                      : 'text-slate-600 group-hover:text-slate-400'
                  }`}
                />
              </button>
            );
          })}
      </div>
    </div>
  );
};

export default LectureList;
