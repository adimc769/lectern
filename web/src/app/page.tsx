'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Mic,
  BookOpen,
  Search,
  Clock,
  Calendar,
  CreditCard,
  FileAudio,
  Bookmark,
  RefreshCw,
  Plus,
  X,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import { fetchLectures } from '../lib/api';
import { LectureViewer } from '../components/LectureViewer';
import { AudioRecorder } from '../components/AudioRecorder';
import { AudioUploader } from '../components/AudioUploader';
import { QnAChat } from '../components/QnAChat';

export default function Home() {
  const [lectures, setLectures] = useState<LectureDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);
  const [targetTimestamp, setTargetTimestamp] = useState<number | undefined>(undefined);
  const [initialLectureTab, setInitialLectureTab] = useState<'summary' | 'keyTerms' | 'flashcards' | 'transcript'>('summary');
  const [activeIntakeMode, setActiveIntakeMode] = useState<'none' | 'upload' | 'record'>('none');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLectures = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLectures();
      setLectures(data);
    } catch {
      // Handled by API fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLectures();
  }, [loadLectures]);

  const selectedLecture = lectures.find((l) => l.id === selectedLectureId);

  const handleIntakeComplete = async (newLectureId: string) => {
    await loadLectures();
    setActiveIntakeMode('none');
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const filteredLectures = lectures.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      (l.summary && l.summary.toLowerCase().includes(q))
    );
  });

  // Detailed view for a single lecture
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
    <div className="space-y-6">
      {/* Workspace Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-850">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Lecture Library</h1>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
            {lectures.length} files
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lectures..."
              aria-label="Filter lecture library"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setActiveIntakeMode(activeIntakeMode === 'record' ? 'none' : 'record')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeIntakeMode === 'record'
                ? 'bg-rose-950/50 text-rose-300 border-rose-800'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-850 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span>Record</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveIntakeMode(activeIntakeMode === 'upload' ? 'none' : 'upload')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeIntakeMode === 'upload'
                ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800'
                : 'bg-zinc-100 text-zinc-950 border-zinc-200 hover:bg-white font-semibold'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>
      </div>

      {/* Collapsible Intake Panels (Clean & Focused) */}
      {activeIntakeMode !== 'none' && (
        <div className="relative border border-zinc-800 rounded-lg bg-zinc-900/40 p-1">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-850">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
              {activeIntakeMode === 'record' ? 'Microphone Intake' : 'File Intake'}
            </span>
            <button
              type="button"
              onClick={() => setActiveIntakeMode('none')}
              className="text-zinc-500 hover:text-zinc-300 p-1 transition-colors"
              aria-label="Close intake panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4">
            {activeIntakeMode === 'record' && (
              <AudioRecorder onUploadSuccess={handleIntakeComplete} />
            )}
            {activeIntakeMode === 'upload' && (
              <AudioUploader onUploadSuccess={handleIntakeComplete} />
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Layout: Library (8 Cols) + Q&A Assistant (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Lectures List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {isLoading ? (
            <div className="p-12 text-center rounded-lg border border-zinc-850 bg-zinc-900/20 text-zinc-400 font-mono text-xs">
              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-zinc-500" />
              Loading course library...
            </div>
          ) : filteredLectures.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-800 p-12 text-center space-y-3">
              <p className="text-xs font-mono text-zinc-400">No lectures found.</p>
              <button
                type="button"
                onClick={() => setActiveIntakeMode('upload')}
                className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-mono transition-colors"
              >
                + Ingest Audio File
              </button>
            </div>
          ) : (
            filteredLectures.map((lecture) => (
              <div
                key={lecture.id}
                className="rounded-lg border border-zinc-850 bg-zinc-900/40 hover:border-zinc-750 hover:bg-zinc-900/70 p-4 transition-colors space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                      <span className="text-zinc-400">{formatDuration(lecture.duration || 0)}</span>
                      <span>&bull;</span>
                      <span>{formatDate(lecture.createdAt)}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-400/90 font-medium">indexed</span>
                    </div>

                    <h2
                      onClick={() => handleOpenLectureTab(lecture.id, 'summary')}
                      className="text-sm font-semibold text-zinc-100 hover:text-white cursor-pointer transition-colors leading-snug"
                    >
                      {lecture.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenLectureTab(lecture.id, 'summary')}
                    className="px-2.5 py-1 rounded text-xs font-medium text-zinc-300 hover:text-white bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>

                {/* Summary Excerpt */}
                {lecture.summary && (
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {lecture.summary}
                  </p>
                )}

                {/* Sub-tools bar */}
                <div className="pt-2 border-t border-zinc-850/80 flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <button
                    type="button"
                    onClick={() => handleOpenLectureTab(lecture.id, 'transcript')}
                    className="hover:text-zinc-200 transition-colors flex items-center gap-1"
                  >
                    <FileAudio className="w-3 h-3 text-zinc-500" />
                    <span>Transcript ({lecture.segments?.length || 0})</span>
                  </button>

                  <span className="text-zinc-600">&bull;</span>

                  <button
                    type="button"
                    onClick={() => handleOpenLectureTab(lecture.id, 'flashcards')}
                    className="hover:text-zinc-200 transition-colors flex items-center gap-1"
                  >
                    <CreditCard className="w-3 h-3 text-zinc-500" />
                    <span>Cards ({lecture.flashcards?.length || 0})</span>
                  </button>

                  <span className="text-zinc-600">&bull;</span>

                  <button
                    type="button"
                    onClick={() => handleOpenLectureTab(lecture.id, 'keyTerms')}
                    className="hover:text-zinc-200 transition-colors flex items-center gap-1"
                  >
                    <Bookmark className="w-3 h-3 text-zinc-500" />
                    <span>Terms ({lecture.keyTerms?.length || 0})</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Grounded Q&A Assistant (5 cols) */}
        <div className="lg:col-span-5 sticky top-20">
          <QnAChat onCitationClick={handleCitationClick} />
        </div>
      </div>
    </div>
  );
}
