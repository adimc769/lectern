'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Calendar,
  FileText,
  FileAudio,
  Layers,
  Bookmark,
  MessageSquare,
  Copy,
  Check,
  Search,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Download,
  ChevronDown,
  Printer,
} from 'lucide-react';
import type { LectureDTO, TranscriptSegmentDTO, FlashcardDTO, KeyTermDTO } from '@lectern/shared';
import { fetchProgress, fetchLecture } from '../lib/api';

export type WorkspaceTab = 'summary' | 'transcript' | 'flashcards' | 'keyTerms';

type Props = {
  initialLecture: LectureDTO;
  initialTab?: WorkspaceTab;
  initialTimestamp?: number;
};

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'lecture';
}

function formatMmSs(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function buildLectureMarkdown(lecture: LectureDTO): string {
  const lines: string[] = [];
  lines.push(`# ${lecture.title}`);
  lines.push('');

  if (lecture.summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(lecture.summary);
    lines.push('');
  }

  if (lecture.keyTerms && lecture.keyTerms.length > 0) {
    lines.push('## Key Terms');
    lines.push('');
    for (const kt of lecture.keyTerms) {
      lines.push(`- **${kt.term}**: ${kt.definition}`);
    }
    lines.push('');
  }

  if (lecture.flashcards && lecture.flashcards.length > 0) {
    lines.push('## Flashcards');
    lines.push('');
    lecture.flashcards.forEach((fc, i) => {
      lines.push(`### Card ${i + 1}: ${fc.front}`);
      lines.push('');
      lines.push(fc.back);
      lines.push('');
    });
  }

  if (lecture.segments && lecture.segments.length > 0) {
    lines.push('## Transcript');
    lines.push('');
    for (const seg of lecture.segments) {
      lines.push(`[${formatMmSs(seg.startTime)}] ${seg.text}`);
    }
    lines.push('');
  }

  lines.push(`_Exported from Lectern (100% local) — ${new Date().toLocaleString()}_`);
  return lines.join('\n');
}

function buildAnkiTsv(lecture: LectureDTO): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim();
  return (lecture.flashcards || [])
    .map((fc) => `${clean(fc.front)}\t${clean(fc.back)}`)
    .join('\n');
}

function downloadBlobFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LectureWorkspace({
  initialLecture,
  initialTab = 'summary',
  initialTimestamp,
}: Props) {
  const router = useRouter();
  const [lecture, setLecture] = useState<LectureDTO>(initialLecture);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);

  // Audio Playback State (lifted for all tabs)
  const [currentTime, setCurrentTime] = useState(initialTimestamp || 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioDuration, setAudioDuration] = useState(lecture.duration || 180);
  const [useSpeechFallback, setUseSpeechFallback] = useState(!lecture.audioPath);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUttRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Summary State
  const [isSummaryCopied, setIsSummaryCopied] = useState(false);

  // Export Dropdown State (client-side only)
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExportOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExportOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportOpen]);

  const handleExportMarkdown = () => {
    downloadBlobFile(
      `${slugifyTitle(lecture.title)}.md`,
      'text/markdown;charset=utf-8',
      buildLectureMarkdown(lecture)
    );
    setIsExportOpen(false);
  };

  const handleExportAnki = () => {
    downloadBlobFile(
      `${slugifyTitle(lecture.title)}.tsv`,
      'text/tab-separated-values;charset=utf-8',
      buildAnkiTsv(lecture)
    );
    setIsExportOpen(false);
  };

  const handleExportPrint = () => {
    setIsExportOpen(false);
    window.print();
  };

  // Transcript State
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const activeTranscriptRef = useRef<HTMLDivElement | null>(null);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  // Flashcards State
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffledCards, setShuffledCards] = useState<FlashcardDTO[]>(lecture.flashcards || []);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // Key Terms State
  const [termSearch, setTermSearch] = useState('');
  const [copiedTermId, setCopiedTermId] = useState<string | null>(null);

  // Processing Stepper State (if lecture is not completed)
  const [progressStage, setProgressStage] = useState(lecture.status);
  const [progressPercent, setProgressPercent] = useState(
    lecture.status === 'COMPLETED' ? 100 : 25
  );
  const [progressMsg, setProgressMsg] = useState('Processing lecture locally...');

  // Keep cards in sync
  useEffect(() => {
    setShuffledCards(lecture.flashcards || []);
  }, [lecture.flashcards]);

  // Jump to timestamp if provided via props
  useEffect(() => {
    if (typeof initialTimestamp === 'number' && initialTimestamp > 0) {
      setActiveTab('transcript');
      seekAudio(initialTimestamp);
    }
  }, [initialTimestamp]);

  // Polling pipeline if not ready
  useEffect(() => {
    if (lecture.status === 'COMPLETED') return;

    let timer: NodeJS.Timeout;
    const poll = async () => {
      try {
        const prog = await fetchProgress(lecture.id);
        setProgressPercent(prog.progressPercent);
        setProgressMsg(prog.message);

        if (prog.stage === 'COMPLETED') {
          // Re-fetch lecture data
          const updated = await fetchLecture(lecture.id);
          setLecture(updated);
          setProgressStage('COMPLETED');
          return;
        }
      } catch {
        // Continue polling
      }
      timer = setTimeout(poll, 1200);
    };

    poll();
    return () => clearTimeout(timer);
  }, [lecture.id, lecture.status]);

  // Audio Duration Sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setUseSpeechFallback(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Format Helpers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  // Audio Playback Controls
  const togglePlay = useCallback(() => {
    if (useSpeechFallback) {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const seg = (lecture.segments || []).find(
          (s) => currentTime >= s.startTime && currentTime <= s.endTime
        ) || lecture.segments?.[0];

        if (seg) {
          const textToSpeak = seg.text;
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.rate = playbackRate;
          utterance.onend = () => setIsPlaying(false);
          utterance.onerror = () => setIsPlaying(false);
          speechUttRef.current = utterance;
          window.speechSynthesis.speak(utterance);
          setIsPlaying(true);
        }
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setUseSpeechFallback(true));
    }
  }, [useSpeechFallback, isPlaying, lecture.segments, currentTime, playbackRate]);

  const seekAudio = useCallback((time: number) => {
    const boundedTime = Math.max(0, Math.min(time, audioDuration));
    setCurrentTime(boundedTime);
    if (audioRef.current) {
      audioRef.current.currentTime = boundedTime;
    }
  }, [audioDuration]);

  const handleSkip = useCallback((seconds: number) => {
    seekAudio(currentTime + seconds);
  }, [currentTime, seekAudio]);

  const handleRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const handleVolumeChange = useCallback((val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = volume || 1;
      }
    } else {
      setIsMuted(true);
      if (audioRef.current) {
        audioRef.current.muted = true;
      }
    }
  }, [isMuted, volume]);

  // Active Segment Index for transcript
  const activeSegmentIndex = useMemo(() => {
    return (lecture.segments || []).findIndex(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );
  }, [lecture.segments, currentTime]);

  // Auto-scroll transcript to active line
  useEffect(() => {
    if (autoScroll && activeTranscriptRef.current && transcriptListRef.current) {
      activeTranscriptRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSegmentIndex, autoScroll]);

  // Filtered Segments for search
  const filteredSegments = useMemo(() => {
    const list = lecture.segments || [];
    if (!transcriptSearch.trim()) return list;
    const query = transcriptSearch.toLowerCase();
    return list.filter((s) => s.text.toLowerCase().includes(query));
  }, [lecture.segments, transcriptSearch]);

  // Copy Summary
  const handleCopySummary = () => {
    if (!lecture.summary) return;
    navigator.clipboard.writeText(lecture.summary);
    setIsSummaryCopied(true);
    setTimeout(() => setIsSummaryCopied(false), 2000);
  };

  // Flashcards keyboard shortcuts
  useEffect(() => {
    if (activeTab !== 'flashcards' || shuffledCards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (cardIndex < shuffledCards.length - 1) {
          setCardIndex((i) => i + 1);
          setIsFlipped(false);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (cardIndex > 0) {
          setCardIndex((i) => i - 1);
          setIsFlipped(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, cardIndex, shuffledCards.length]);

  const currentCard = shuffledCards[cardIndex];

  const handleShuffleDeck = () => {
    const shuffled = [...shuffledCards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
    setCardIndex(0);
    setIsFlipped(false);
  };

  const handleToggleMastery = (cardId: string) => {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Filtered Key Terms
  const filteredTerms = useMemo(() => {
    const list = lecture.keyTerms || [];
    if (!termSearch.trim()) return list;
    const q = termSearch.toLowerCase();
    return list.filter(
      (kt) => kt.term.toLowerCase().includes(q) || kt.definition.toLowerCase().includes(q)
    );
  }, [lecture.keyTerms, termSearch]);

  const handleCopyTerm = (term: KeyTermDTO) => {
    navigator.clipboard.writeText(`${term.term}: ${term.definition}`);
    setCopiedTermId(term.id);
    setTimeout(() => setCopiedTermId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-28">
      {/* Hidden audio element */}
      {lecture.audioPath && (
        <audio
          ref={audioRef}
          src={lecture.audioPath}
          preload="metadata"
          className="hidden"
        />
      )}

      {/* Top Breadcrumb & Metadata Header */}
      <div className="space-y-4 pb-6 border-b border-[#E5E5DF] dark:border-[#1E293B]">
        <div className="flex items-center justify-between">
          <Link
            href="/lectures"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to My Lectures</span>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {/* Primary: Study Circuit (study-first over reading tabs) */}
            <Link
              href={`/study/${lecture.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Start studying</span>
              <span className="sm:hidden">Study</span>
            </Link>

            {/* Quiz jump: opens the study session on the quiz tab */}
            <Link
              href={`/study/${lecture.id}?tab=quiz`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F5] hover:bg-[#E5E5DF] dark:bg-[#19233C] dark:hover:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              <span className="hidden sm:inline">Quiz</span>
              <span className="sm:hidden">Quiz</span>
            </Link>

            {/* Quick Cross-Lecture Q&A jump button */}
            <Link
              href={`/ask?lectureId=${lecture.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF9F5] hover:bg-[#E5E5DF] dark:bg-[#19233C] dark:hover:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Ask question about lecture</span>
              <span className="sm:hidden">Ask</span>
            </Link>

            {/* Export dropdown (client-side only, from LectureDTO prop) */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsExportOpen((o) => !o)}
                aria-expanded={isExportOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isExportOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isExportOpen && (
                <div
                  role="menu"
                  aria-label="Export lecture"
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] shadow-xs p-1.5 z-40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportMarkdown}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#FAF9F5] dark:hover:bg-[#19233C] text-left transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-xs font-semibold text-[#0F172A] dark:text-white">
                        Markdown (.md)
                      </span>
                      <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Summary, key terms, cards, transcript
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportAnki}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#FAF9F5] dark:hover:bg-[#19233C] text-left transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-xs font-semibold text-[#0F172A] dark:text-white">
                        Anki TSV (front⇥back)
                      </span>
                      <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Import-ready spaced-repetition deck
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportPrint}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-[#FAF9F5] dark:hover:bg-[#19233C] text-left transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="block text-xs font-semibold text-[#0F172A] dark:text-white">
                        Print / PDF
                      </span>
                      <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Open the browser print dialog
                      </span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {lecture.status === 'COMPLETED' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
                Ready · Offline processing complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                Processing on local GPU...
              </span>
            )}

            <span className="text-[#94A3B8]">•</span>
            <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(lecture.duration || 0)}
            </span>
            <span className="text-[#94A3B8]">•</span>
            <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(lecture.createdAt)}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
            {lecture.title}
          </h1>
        </div>

        {/* 4 Study Tabs Navigation */}
        <div
          role="tablist"
          aria-label="Lecture Study Tools"
          className="flex items-center gap-1 overflow-x-auto pt-2 border-b border-[#E5E5DF] dark:border-[#1E293B] no-scrollbar text-xs font-semibold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'summary'}
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'summary'
                ? 'border-[#0F172A] text-[#0F172A] dark:border-white dark:text-white'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Summary</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'transcript'}
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'transcript'
                ? 'border-[#0F172A] text-[#0F172A] dark:border-white dark:text-white'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <FileAudio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Transcript</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FAF9F5] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]">
              {lecture.segments?.length || 0}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flashcards'}
            onClick={() => setActiveTab('flashcards')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'flashcards'
                ? 'border-[#0F172A] text-[#0F172A] dark:border-white dark:text-white'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Flashcards</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FAF9F5] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]">
              {lecture.flashcards?.length || 0}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'keyTerms'}
            onClick={() => setActiveTab('keyTerms')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'keyTerms'
                ? 'border-[#0F172A] text-[#0F172A] dark:border-white dark:text-white'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <Bookmark className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Key Terms</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FAF9F5] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]">
              {lecture.keyTerms?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Processing State: Horizontal 5-Step Stepper */}
      {lecture.status !== 'COMPLETED' && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
              <div>
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                  Local Processing Pipeline
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {progressMsg}
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
              {progressPercent}%
            </span>
          </div>

          {/* Stepper Bar */}
          <div className="w-full bg-[#E5E5DF] dark:bg-[#1E293B] rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-medium">
            <div className={`p-2 rounded-lg border ${progressPercent >= 15 ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold' : 'text-[#94A3B8] border-transparent'}`}>
              1. Audio Prep
            </div>
            <div className={`p-2 rounded-lg border ${progressPercent >= 45 ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold' : 'text-[#94A3B8] border-transparent'}`}>
              2. Whisper CUDA
            </div>
            <div className={`p-2 rounded-lg border ${progressPercent >= 75 ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold' : 'text-[#94A3B8] border-transparent'}`}>
              3. Vector Index
            </div>
            <div className={`p-2 rounded-lg border ${progressPercent >= 90 ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-bold' : 'text-[#94A3B8] border-transparent'}`}>
              4. Summarization
            </div>
            <div className={`p-2 rounded-lg border ${progressPercent >= 100 ? 'bg-teal-100/70 border-teal-300 text-teal-950 font-bold' : 'text-[#94A3B8] border-transparent'}`}>
              5. Ready
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Summary Panel */}
      {activeTab === 'summary' && (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F1EC] dark:border-[#1E293B]">
              <div className="space-y-0.5">
                <h2 className="text-base font-semibold text-[#0F172A] dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Executive Study Summary</span>
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Synthesized offline using local LLM inference over full lecture transcript.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3.5 py-1.5 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] hover:bg-[#F4F4F0] dark:bg-[#19233C] dark:hover:bg-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isSummaryCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-teal-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy summary</span>
                  </>
                )}
              </button>
            </div>

            <div className="prose dark:prose-invert max-w-none text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-4 whitespace-pre-wrap">
              {lecture.summary ||
                'Summary generation in progress. Transcribing on-device speech segments...'}
            </div>

            {/* Quick jump suggestions */}
            <div className="pt-6 border-t border-[#F1F1EC] dark:border-[#1E293B] flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                Next study steps:
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('transcript')}
                className="px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#E5E5DF] dark:hover:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-white transition-colors"
              >
                Read full transcript
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('flashcards')}
                className="px-3 py-1 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] hover:bg-[#E5E5DF] dark:hover:bg-[#1E293B] text-xs font-medium text-[#0F172A] dark:text-white transition-colors"
              >
                Practice with {lecture.flashcards?.length || 0} flashcards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Transcript Panel */}
      {activeTab === 'transcript' && (
        <div className="space-y-4">
          {/* Transcript Search & Options Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search transcript text..."
                className="w-full bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8]"
              />
              {transcriptSearch && (
                <button
                  type="button"
                  onClick={() => setTranscriptSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <label className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#0F172A] focus:ring-0"
                />
                <span>Follow audio playback</span>
              </label>

              <span className="text-xs text-[#94A3B8]">
                {filteredSegments.length} of {lecture.segments?.length || 0} lines
              </span>
            </div>
          </div>

          {/* Transcript Scrolling List */}
          <div
            ref={transcriptListRef}
            className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-4 sm:p-6 max-h-[550px] overflow-y-auto space-y-2 shadow-xs"
          >
            {filteredSegments.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                No transcript segments match &ldquo;{transcriptSearch}&rdquo;.
              </div>
            ) : (
              filteredSegments.map((segment) => {
                const isActive =
                  currentTime >= segment.startTime && currentTime <= segment.endTime;

                return (
                  <div
                    key={segment.id}
                    ref={isActive ? activeTranscriptRef : null}
                    onClick={() => {
                      seekAudio(segment.startTime);
                      if (!isPlaying) togglePlay();
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        seekAudio(segment.startTime);
                        if (!isPlaying) togglePlay();
                      }
                    }}
                    className={`p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3.5 text-left ${
                      isActive
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-xs'
                        : 'hover:bg-[#FAF9F5] dark:hover:bg-[#19233C] border border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        seekAudio(segment.startTime);
                        if (!isPlaying) togglePlay();
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-semibold shrink-0 select-none transition-colors ${
                        isActive
                          ? 'bg-amber-200/80 text-amber-950 dark:bg-amber-900 dark:text-amber-200'
                          : 'bg-[#FAF9F5] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E5DF] dark:border-[#334155]'
                      }`}
                    >
                      {formatTime(segment.startTime)}
                    </button>

                    <p
                      className={`text-xs sm:text-sm leading-relaxed flex-1 select-text ${
                        isActive
                          ? 'text-[#0F172A] dark:text-amber-100 font-medium'
                          : 'text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      {segment.text}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Flashcards Panel */}
      {activeTab === 'flashcards' && (
        <div className="space-y-6 max-w-2xl mx-auto">
          {shuffledCards.length === 0 ? (
            <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] p-12 text-center text-xs text-[#94A3B8]">
              No flashcards extracted for this lecture yet.
            </div>
          ) : (
            <>
              {/* Deck header & progress */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-[#0F172A] dark:text-white">
                    Card {cardIndex + 1} of {shuffledCards.length}
                  </span>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Mastered: {masteredIds.size} / {shuffledCards.length}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShuffleDeck}
                    className="p-2 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors"
                    title="Shuffle cards"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCardIndex(0);
                      setIsFlipped(false);
                      setMasteredIds(new Set());
                    }}
                    className="px-3 py-1.5 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Mastery Bar */}
              <div className="w-full bg-[#E5E5DF] dark:bg-[#1E293B] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${(masteredIds.size / shuffledCards.length) * 100}%`,
                  }}
                />
              </div>

              {/* The Flip Card */}
              <div
                onClick={() => setIsFlipped((f) => !f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setIsFlipped((f) => !f);
                  }
                }}
                className={`relative min-h-[260px] sm:min-h-[300px] rounded-3xl border transition-all cursor-pointer p-8 sm:p-10 flex flex-col justify-between shadow-xs select-none ${
                  isFlipped
                    ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/60'
                    : 'bg-[#FFFFFF] dark:bg-[#131B2E] border-[#E5E5DF] dark:border-[#1E293B] hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <span>{isFlipped ? 'Answer' : 'Question'}</span>
                  <span>Click or Space to flip</span>
                </div>

                <div className="my-auto py-6 text-center">
                  <p
                    className={`text-base sm:text-lg font-medium leading-relaxed ${
                      isFlipped
                        ? 'text-teal-950 dark:text-teal-100'
                        : 'text-[#0F172A] dark:text-white'
                    }`}
                  >
                    {isFlipped ? currentCard.back : currentCard.front}
                  </p>
                </div>

                <div className="flex items-center justify-center text-xs text-[#94A3B8]">
                  {isFlipped ? 'Tap to view question' : 'Tap to reveal answer'}
                </div>
              </div>

              {/* Card Controls & Mastery rating */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={cardIndex === 0}
                  onClick={() => {
                    setCardIndex((i) => i - 1);
                    setIsFlipped(false);
                  }}
                  className="p-2.5 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] disabled:opacity-40 text-[#0F172A] dark:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleMastery(currentCard.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border ${
                      masteredIds.has(currentCard.id)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-[#FFFFFF] dark:bg-[#131B2E] border-[#E5E5DF] dark:border-[#1E293B] text-[#0F172A] dark:text-white hover:border-teal-500'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {masteredIds.has(currentCard.id) ? 'Mastered' : 'Mark as known'}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={cardIndex === shuffledCards.length - 1}
                  onClick={() => {
                    setCardIndex((i) => i + 1);
                    setIsFlipped(false);
                  }}
                  className="p-2.5 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] disabled:opacity-40 text-[#0F172A] dark:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 4: Key Terms Glossary */}
      {activeTab === 'keyTerms' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={termSearch}
              onChange={(e) => setTermSearch(e.target.value)}
              placeholder="Search concepts and definitions..."
              className="w-full bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] rounded-xl pl-10 pr-4 py-2 text-xs text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTerms.map((term) => (
              <div
                key={term.id}
                className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-5 space-y-2 shadow-xs hover:border-[#CBD5E1] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white">
                    {term.term}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopyTerm(term)}
                    className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors p-1"
                    title="Copy definition"
                  >
                    {copiedTermId === term.id ? (
                      <Check className="w-3.5 h-3.5 text-teal-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  {term.definition}
                </p>
              </div>
            ))}
          </div>

          {filteredTerms.length === 0 && (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              No key terms found matching &ldquo;{termSearch}&rdquo;.
            </div>
          )}
        </div>
      )}

      {/* Docked Persistent Audio Bar (Active across all tabs) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#FFFFFF]/95 dark:bg-[#0B1120]/95 backdrop-blur-md border-t border-[#E5E5DF] dark:border-[#1E293B] px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto space-y-2">
          {/* Scrubber row */}
          <div className="flex items-center gap-3 text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={audioDuration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => seekAudio(parseFloat(e.target.value))}
              aria-label="Seek audio"
              className="flex-1 h-1.5 bg-[#E2E8F0] dark:bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#0F172A] dark:accent-white"
            />
            <span className="w-10">{formatTime(audioDuration)}</span>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSkip(-10)}
                aria-label="Rewind 10 seconds"
                className="p-1.5 rounded-lg border border-[#E5E5DF] dark:border-[#1E293B] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="px-4 py-1.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0F172A] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSkip(10)}
                aria-label="Forward 10 seconds"
                className="p-1.5 rounded-lg border border-[#E5E5DF] dark:border-[#1E293B] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Currently playing snippet / title on desktop */}
            <div className="hidden md:flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm truncate">
              <span className="font-semibold text-[#0F172A] dark:text-white truncate">
                {lecture.title}
              </span>
              {useSpeechFallback && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#334155]">
                  Speech synth
                </span>
              )}
            </div>

            {/* Speed & Volume */}
            <div className="flex items-center gap-3">
              {/* Speed buttons */}
              <div className="flex items-center gap-0.5 bg-[#FAF9F5] dark:bg-[#19233C] border border-[#E5E5DF] dark:border-[#1E293B] rounded-lg p-0.5 text-[10px] font-semibold">
                {[0.8, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleRateChange(rate)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      playbackRate === rate
                        ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                        : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              {/* Volume */}
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className="text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  aria-label="Volume"
                  className="w-16 h-1 bg-[#E2E8F0] dark:bg-[#1E293B] rounded appearance-none cursor-pointer accent-[#0F172A] dark:accent-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
