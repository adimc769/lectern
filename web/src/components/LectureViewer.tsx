'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Bookmark,
  CreditCard,
  FileAudio,
  ArrowLeft,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
  Cpu,
  Search,
  ExternalLink,
} from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import { TranscriptViewer } from './TranscriptViewer';
import { FlashcardDeck } from './FlashcardDeck';

export type LectureTab = 'summary' | 'keyTerms' | 'flashcards' | 'transcript';

type Props = {
  lecture: LectureDTO;
  initialTab?: LectureTab;
  targetTimestamp?: number;
  onBack?: () => void;
  className?: string;
};

export function LectureViewer({
  lecture,
  initialTab = 'summary',
  targetTimestamp,
  onBack,
  className = '',
}: Props) {
  const [activeTab, setActiveTab] = useState<LectureTab>(initialTab);
  const [termFilter, setTermFilter] = useState('');
  const [seekTime, setSeekTime] = useState<number | undefined>(targetTimestamp);

  // If targetTimestamp updates externally, switch to transcript tab and set seek time
  useEffect(() => {
    if (typeof targetTimestamp === 'number') {
      setActiveTab('transcript');
      setSeekTime(targetTimestamp);
    }
  }, [targetTimestamp]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recently processed';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently processed';
    }
  };

  const filteredKeyTerms = (lecture.keyTerms || []).filter(
    (kt) =>
      kt.term.toLowerCase().includes(termFilter.toLowerCase()) ||
      kt.definition.toLowerCase().includes(termFilter.toLowerCase())
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner & Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Lecture Library</span>
          </button>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>COMPLETED</span>
              </span>
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatDuration(lecture.duration || 0)}</span>
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{formatDate(lecture.createdAt)}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {lecture.title}
            </h1>
          </div>

          {/* Local GPU Badge */}
          <div className="flex items-center gap-2 self-start lg:self-auto px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Offline Model:</span>
            <span className="text-cyan-300 font-bold">Whisper CUDA</span>
          </div>
        </div>

        {/* Navigation Tabs (WAI-ARIA Tablist) */}
        <div
          role="tablist"
          aria-label="Lecture details sections"
          className="flex items-center gap-1 p-1 bg-slate-950/90 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar pt-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="panel-summary"
            id="tab-summary"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Summary</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'keyTerms'}
            aria-controls="panel-keyTerms"
            id="tab-keyTerms"
            onClick={() => setActiveTab('keyTerms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === 'keyTerms'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Key Terms</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'keyTerms'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {lecture.keyTerms?.length || 0}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flashcards'}
            aria-controls="panel-flashcards"
            id="tab-flashcards"
            onClick={() => setActiveTab('flashcards')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === 'flashcards'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Flashcards</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'flashcards'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {lecture.flashcards?.length || 0}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transcript'}
            aria-controls="panel-transcript"
            id="tab-transcript"
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeTab === 'transcript'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileAudio className="w-4 h-4" />
            <span>Transcript</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'transcript'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {lecture.segments?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}

      {/* 1. Summary Panel */}
      {activeTab === 'summary' && (
        <div
          role="tabpanel"
          id="panel-summary"
          aria-labelledby="tab-summary"
          className="space-y-6"
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Executive AI Synthesis</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">qwen2.5:14b</span>
            </div>

            <p className="text-base text-slate-200 leading-relaxed font-normal whitespace-pre-wrap">
              {lecture.summary || 'Summary is being generated by the local offline LLM pipeline.'}
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block">Total Runtime</span>
                <span className="text-lg font-bold font-mono text-white mt-1 block">
                  {formatDuration(lecture.duration)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block">Transcript Segments</span>
                <span className="text-lg font-bold font-mono text-cyan-300 mt-1 block">
                  {lecture.segments?.length || 0}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block">Key Terms</span>
                <span className="text-lg font-bold font-mono text-indigo-300 mt-1 block">
                  {lecture.keyTerms?.length || 0}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <span className="text-xs text-slate-400 block">Study Flashcards</span>
                <span className="text-lg font-bold font-mono text-emerald-300 mt-1 block">
                  {lecture.flashcards?.length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Key Terms Panel */}
      {activeTab === 'keyTerms' && (
        <div
          role="tabpanel"
          id="panel-keyTerms"
          aria-labelledby="tab-keyTerms"
          className="space-y-4"
        >
          {/* Search Key Terms Filter */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              placeholder="Filter key terms or concepts..."
              aria-label="Filter key terms"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredKeyTerms.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 p-6 shadow-md transition-all space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <h4 className="text-base font-bold text-white tracking-tight">
                      {item.term}
                    </h4>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mt-2.5">
                    {item.definition}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Concept ID: {item.id}</span>
                  <span className="text-indigo-400">Extracted from Transcript</span>
                </div>
              </div>
            ))}
          </div>

          {filteredKeyTerms.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-sm">
              No key terms match your filter.
            </div>
          )}
        </div>
      )}

      {/* 3. Flashcards Panel */}
      {activeTab === 'flashcards' && (
        <div
          role="tabpanel"
          id="panel-flashcards"
          aria-labelledby="tab-flashcards"
        >
          <FlashcardDeck flashcards={lecture.flashcards || []} />
        </div>
      )}

      {/* 4. Transcript Panel with Synchronized Audio Playback */}
      {activeTab === 'transcript' && (
        <div
          role="tabpanel"
          id="panel-transcript"
          aria-labelledby="tab-transcript"
        >
          <TranscriptViewer
            segments={lecture.segments || []}
            audioUrl={lecture.audioPath}
            initialTime={seekTime}
            className="min-h-[550px]"
          />
        </div>
      )}
    </div>
  );
}
