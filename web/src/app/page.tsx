'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Mic,
  BookOpen,
  Sparkles,
  Search,
  Clock,
  Calendar,
  CreditCard,
  FileAudio,
  Bookmark,
  RefreshCw,
  Plus,
  X,
  MessageSquare,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import { fetchLectures } from '../lib/api';
import { LectureViewer } from '../components/LectureViewer';
import { UploadPanel } from '../components/UploadPanel';
import { QnAChat } from '../components/QnAChat';

export default function Home() {
  const [lectures, setLectures] = useState<LectureDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);
  const [targetTimestamp, setTargetTimestamp] = useState<number | undefined>(undefined);
  const [initialLectureTab, setInitialLectureTab] = useState<'summary' | 'keyTerms' | 'flashcards' | 'transcript'>('summary');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLectures = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLectures();
      setLectures(data);
    } catch {
      // Handled by api fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLectures();
  }, [loadLectures]);

  const selectedLecture = lectures.find((l) => l.id === selectedLectureId);

  const handleUploadComplete = async (newLectureId: string) => {
    await loadLectures();
    setIsUploadOpen(false);
    setSelectedLectureId(newLectureId);
    setInitialLectureTab('summary');
  };

  const handleCitationClick = (lectureId: string, timestamp: number) => {
    setSelectedLectureId(lectureId);
    setTargetTimestamp(timestamp);
    setInitialLectureTab('transcript');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenLectureTab = (
    lectureId: string,
    tab: 'summary' | 'keyTerms' | 'flashcards' | 'transcript'
  ) => {
    setSelectedLectureId(lectureId);
    setInitialLectureTab(tab);
    setTargetTimestamp(undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Filter lectures
  const filteredLectures = lectures.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      (l.summary && l.summary.toLowerCase().includes(q))
    );
  });

  // If a specific lecture is selected, show detail view
  if (selectedLecture) {
    return (
      <LectureViewer
        lecture={selectedLecture}
        initialTab={initialLectureTab}
        targetTimestamp={targetTimestamp}
        onBack={() => {
          setSelectedLectureId(null);
          setTargetTimestamp(undefined);
        }}
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* Hero Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/70 border border-indigo-700/50 text-xs font-semibold text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Air-Gapped Local Intelligence Active</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Private, offline lecture comprehension on your GPU.
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Record classroom audio or upload recordings to generate synchronized Whisper transcripts, 
            executive topic summaries, 3D flip flashcards, and cross-lecture cited Q&A—completely off the grid.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Process New Lecture</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4 text-rose-400" />
              <span>Record Live Microphone</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Modal / Collapsible Drawer */}
      {isUploadOpen && (
        <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs uppercase tracking-wider font-bold text-indigo-400">
              Offline Intake Pipeline
            </span>
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <UploadPanel onUploadComplete={handleUploadComplete} />
        </div>
      )}

      {/* Main Grid: Library (2 Cols) + Cross-Lecture Q&A (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Lecture Library (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl font-bold text-white">Your Course Library</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-900 border border-slate-800 text-slate-400">
                {lectures.length} Total
              </span>
            </div>

            {/* Filter Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search lectures..."
                aria-label="Search lectures"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">Loading lecture library...</p>
            </div>
          ) : filteredLectures.length === 0 ? (
            /* Empty State */
            <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto text-slate-600">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No lectures found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery
                    ? 'No lectures match your search terms.'
                    : 'Process an audio file or record a live class to start studying with local offline AI.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Upload First Lecture</span>
              </button>
            </div>
          ) : (
            /* Lecture Cards List */
            <div className="space-y-4">
              {filteredLectures.map((lecture) => (
                <div
                  key={lecture.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700/80 hover:bg-slate-900/70 p-6 shadow-lg transition-all space-y-4 group"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {lecture.status}
                        </span>
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDuration(lecture.duration || 0)}</span>
                        </span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatDate(lecture.createdAt)}</span>
                        </span>
                      </div>

                      <h3
                        onClick={() => handleOpenLectureTab(lecture.id, 'summary')}
                        className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        {lecture.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenLectureTab(lecture.id, 'summary')}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold transition-all shrink-0 self-start sm:self-auto flex items-center gap-1"
                    >
                      <span>Study</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Summary Snippet */}
                  {lecture.summary && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {lecture.summary}
                    </p>
                  )}

                  {/* Card Quick Tab Buttons */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleOpenLectureTab(lecture.id, 'transcript')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-cyan-300 border border-slate-800 transition-colors"
                    >
                      <FileAudio className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Transcript ({lecture.segments?.length || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLectureTab(lecture.id, 'flashcards')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-emerald-300 border border-slate-800 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Flashcards ({lecture.flashcards?.length || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenLectureTab(lecture.id, 'keyTerms')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-indigo-300 border border-slate-800 transition-colors"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Key Terms ({lecture.keyTerms?.length || 0})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Cross-Lecture Q&A Assistant (5 cols) */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="space-y-4">
            <QnAChat onCitationClick={handleCitationClick} />
          </div>
        </div>
      </div>
    </div>
  );
}
