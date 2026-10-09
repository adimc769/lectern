'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Bookmark,
  CreditCard,
  FileAudio,
  ArrowLeft,
  Clock,
  Calendar,
  Search,
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

  const filteredKeyTerms = (lecture.keyTerms || []).filter(
    (kt) =>
      kt.term.toLowerCase().includes(termFilter.toLowerCase()) ||
      kt.definition.toLowerCase().includes(termFilter.toLowerCase())
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header bar */}
      <div className="space-y-4 pb-4 border-b border-zinc-850">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors font-mono cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>&larr; Back to Library</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <span className="text-emerald-400">COMPLETED</span>
              <span>&bull;</span>
              <span>{formatDuration(lecture.duration || 0)}</span>
              <span>&bull;</span>
              <span>{formatDate(lecture.createdAt)}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
              {lecture.title}
            </h1>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Lecture views"
          className="flex items-center gap-1 border-b border-zinc-850 pt-2 font-mono text-xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="panel-summary"
            id="tab-summary"
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'summary'
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'keyTerms'}
            aria-controls="panel-keyTerms"
            id="tab-keyTerms"
            onClick={() => setActiveTab('keyTerms')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'keyTerms'
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Key Terms ({lecture._count?.keyTerms ?? lecture.keyTerms?.length ?? 0})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flashcards'}
            aria-controls="panel-flashcards"
            id="tab-flashcards"
            onClick={() => setActiveTab('flashcards')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'flashcards'
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Flashcards ({lecture._count?.flashcards ?? lecture.flashcards?.length ?? 0})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transcript'}
            aria-controls="panel-transcript"
            id="tab-transcript"
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'transcript'
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Transcript ({lecture._count?.segments ?? lecture.segments?.length ?? 0})</span>
          </button>
        </div>
      </div>

      {/* 1. Summary Panel */}
      {activeTab === 'summary' && (
        <div
          role="tabpanel"
          id="panel-summary"
          aria-labelledby="tab-summary"
          className="space-y-6 max-w-4xl"
        >
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 font-mono uppercase tracking-wider">
              Lecture Synthesis
            </h2>
            <div className="text-sm text-zinc-200 leading-relaxed font-normal whitespace-pre-wrap">
              {lecture.summary || 'Summary unavailable.'}
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
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              placeholder="Filter key concepts..."
              aria-label="Filter terms"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 pl-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredKeyTerms.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1.5"
              >
                <div className="font-semibold text-xs text-zinc-100 font-mono">
                  {item.term}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {item.definition}
                </p>
              </div>
            ))}
          </div>

          {filteredKeyTerms.length === 0 && (
            <div className="py-8 text-center text-zinc-500 text-xs font-mono">
              No matching terms found.
            </div>
          )}
        </div>
      )}

      {/* 3. Flashcards Panel */}
      {activeTab === 'flashcards' && (
        <div role="tabpanel" id="panel-flashcards" aria-labelledby="tab-flashcards">
          <FlashcardDeck flashcards={lecture.flashcards || []} />
        </div>
      )}

      {/* 4. Transcript Panel */}
      {activeTab === 'transcript' && (
        <div role="tabpanel" id="panel-transcript" aria-labelledby="tab-transcript">
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
