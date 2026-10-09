import React, { useState, useEffect } from 'react';
import {
  FileText,
  Bookmark,
  Layers,
  FileCode,
  ArrowLeft,
  Share2,
  Check,
  RotateCw,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  Search,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import type { LectureDetail } from '../types';
import { Transcript } from './Transcript';
import { formatDuration, formatDate, STATUS_BADGES } from './LectureList';

export interface LecturePageProps {
  lecture: LectureDetail;
  onBack?: () => void;
  onAskAboutLecture?: (lectureTitle: string) => void;
  className?: string;
  initialTab?: 'summary' | 'keyTerms' | 'flashcards' | 'transcript';
  initialSeekTo?: number;
}

export const LecturePage: React.FC<LecturePageProps> = ({
  lecture,
  onBack,
  onAskAboutLecture,
  className = '',
  initialTab = 'summary',
  initialSeekTo,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'keyTerms' | 'flashcards' | 'transcript'>(
    initialSeekTo !== undefined ? 'transcript' : initialTab
  );

  // If initialSeekTo is provided, switch to transcript tab automatically
  useEffect(() => {
    if (initialSeekTo !== undefined) {
      setActiveTab('transcript');
    }
  }, [initialSeekTo]);

  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Set<number>>(new Set());
  const [flashcardViewMode, setFlashcardViewMode] = useState<'study' | 'grid'>('study');
  const [flashcardDeck, setFlashcardDeck] = useState(lecture.flashcards || []);

  // Update deck if lecture changes
  useEffect(() => {
    setFlashcardDeck(lecture.flashcards || []);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setMasteredCards(new Set());
  }, [lecture]);

  // Key terms search state
  const [keyTermSearch, setKeyTermSearch] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Keyboard navigation for flashcards in study mode
  useEffect(() => {
    if (activeTab !== 'flashcards' || flashcardViewMode !== 'study') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, flashcardViewMode, currentCardIndex, flashcardDeck.length]);

  const handleNextCard = () => {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % Math.max(1, flashcardDeck.length));
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + flashcardDeck.length) % Math.max(1, flashcardDeck.length));
  };

  const handleShuffleCards = () => {
    setIsFlipped(false);
    const shuffled = [...flashcardDeck].sort(() => Math.random() - 0.5);
    setFlashcardDeck(shuffled);
    setCurrentCardIndex(0);
  };

  const toggleMastered = (idx: number) => {
    setMasteredCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(lecture.summary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const filteredKeyTerms = (lecture.keyTerms || []).filter(
    (kt) =>
      kt.term.toLowerCase().includes(keyTermSearch.toLowerCase().trim()) ||
      kt.definition.toLowerCase().includes(keyTermSearch.toLowerCase().trim())
  );

  const badge = STATUS_BADGES[lecture.status] || STATUS_BADGES.done;
  const currentCard = flashcardDeck[currentCardIndex];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Back to all lectures"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {badge.icon}
                  <span>{badge.label}</span>
                </span>

                {lecture.durationSec ? (
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formatDuration(lecture.durationSec)}</span>
                  </span>
                ) : null}

                {lecture.createdAt ? (
                  <span className="text-xs text-slate-500">
                    · {formatDate(lecture.createdAt)}
                  </span>
                ) : null}
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {lecture.title}
              </h1>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {onAskAboutLecture && (
              <button
                type="button"
                onClick={() => onAskAboutLecture(lecture.title)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ask AI Assistant</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Lecture study views" className="flex items-center gap-2 pt-4 overflow-x-auto no-scrollbar">
          {[
            {
              id: 'summary',
              label: 'Summary',
              icon: <FileText className="w-4 h-4" />,
              count: null,
            },
            {
              id: 'keyTerms',
              label: 'Key Terms',
              icon: <Bookmark className="w-4 h-4" />,
              count: lecture.keyTerms?.length ?? 0,
            },
            {
              id: 'flashcards',
              label: 'Flashcards',
              icon: <Layers className="w-4 h-4" />,
              count: lecture.flashcards?.length ?? 0,
            },
            {
              id: 'transcript',
              label: 'Transcript',
              icon: <FileCode className="w-4 h-4" />,
              count: lecture.transcript?.length ?? 0,
            },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() =>
                  setActiveTab(
                    tab.id as 'summary' | 'keyTerms' | 'flashcards' | 'transcript'
                  )
                }
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/60'
                    : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Summary */}
      {activeTab === 'summary' && (
        <div
          role="tabpanel"
          id="panel-summary"
          aria-labelledby="tab-summary"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Executive Summary</h2>
            </div>
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              {copiedSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Copy Notes</span>
                </>
              )}
            </button>
          </div>

          <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed text-sm sm:text-base space-y-4">
            <p className="whitespace-pre-line font-normal">{lecture.summary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 uppercase font-mono text-[10px]">Processing Source</div>
              <div className="text-slate-200 font-medium mt-1">Local Whisper & LLM</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 uppercase font-mono text-[10px]">Reading Time</div>
              <div className="text-slate-200 font-medium mt-1">
                ~{Math.ceil(lecture.summary.split(/\s+/).length / 200)} min read
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-slate-500 uppercase font-mono text-[10px]">Device Privacy</div>
              <div className="text-emerald-400 font-medium mt-1">100% Offline Secured</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Key Terms */}
      {activeTab === 'keyTerms' && (
        <div
          role="tabpanel"
          id="panel-keyTerms"
          aria-labelledby="tab-keyTerms"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Key Terms & Definitions</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300">
                {lecture.keyTerms?.length ?? 0}
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyTermSearch}
                onChange={(e) => setKeyTermSearch(e.target.value)}
                placeholder="Search key terms..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {filteredKeyTerms.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No key terms found matching &quot;{keyTermSearch}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredKeyTerms.map((kt, i) => (
                <div
                  key={`${kt.term}-${i}`}
                  className="p-5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-indigo-500/50 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 text-base group-hover:text-indigo-200">
                      {kt.term}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                      Term #{i + 1}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed font-normal">
                    {kt.definition}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Flashcards (Flip cards) */}
      {activeTab === 'flashcards' && (
        <div
          role="tabpanel"
          id="panel-flashcards"
          aria-labelledby="tab-flashcards"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
        >
          {/* Top toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">Interactive Study Deck</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Master core lecture concepts. Click any card to flip.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShuffleCards}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                title="Shuffle deck"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>

              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFlashcardViewMode('study')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    flashcardViewMode === 'study'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Deck Mode
                </button>
                <button
                  type="button"
                  onClick={() => setFlashcardViewMode('grid')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    flashcardViewMode === 'grid'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Grid View
                </button>
              </div>
            </div>
          </div>

          {flashcardDeck.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No flashcards available for this lecture.
            </div>
          ) : flashcardViewMode === 'study' && currentCard ? (
            /* Study Deck Mode (Single 3D Flip Card Focus) */
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Progress counter & mastery */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">
                  Card {currentCardIndex + 1} of {flashcardDeck.length}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">
                    {masteredCards.size} / {flashcardDeck.length} mastered
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleMastered(currentCardIndex)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      masteredCards.has(currentCardIndex)
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{masteredCards.has(currentCardIndex) ? 'Mastered' : 'Mark Mastered'}</span>
                  </button>
                </div>
              </div>

              {/* 3D Flip Card Container */}
              <div
                className="perspective-1000 w-full min-h-[300px] cursor-pointer select-none"
                onClick={() => setIsFlipped((prev) => !prev)}
              >
                <div
                  className={`relative w-full min-h-[300px] rounded-2xl p-8 border transition-transform duration-500 transform-style-preserve-3d shadow-2xl flex flex-col justify-between ${
                    isFlipped ? 'rotate-y-180 bg-indigo-950/40 border-indigo-500/70' : 'bg-slate-950 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  {!isFlipped ? (
                    /* Front: Question */
                    <div className="flex flex-col justify-between h-full space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-2.5 py-1 rounded-md border border-indigo-800/60">
                          Question
                        </span>
                        <span className="text-[11px] text-slate-500">Click or Space to reveal</span>
                      </div>

                      <div className="py-6 my-auto text-center">
                        <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                          {currentCard.question}
                        </h3>
                      </div>

                      <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Click card or press Space to flip answer</span>
                      </div>
                    </div>
                  ) : (
                    /* Back: Answer */
                    <div className="rotate-y-180 flex flex-col justify-between h-full space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-800/60">
                          Answer
                        </span>
                        <span className="text-[11px] text-indigo-300">Click to flip back</span>
                      </div>

                      <div className="py-6 my-auto text-center">
                        <p className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
                          {currentCard.answer}
                        </p>
                      </div>

                      <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                        <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                        <span>Click card to see question</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Deck Navigation Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handlePrevCard}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md transition-all"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Flip Card</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextCard}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Grid View Mode */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {flashcardDeck.map((card, idx) => (
                <GridFlashcardItem
                  key={`${card.question}-${idx}`}
                  card={card}
                  index={idx}
                  isMastered={masteredCards.has(idx)}
                  onToggleMastered={() => toggleMastered(idx)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Transcript */}
      {activeTab === 'transcript' && (
        <div role="tabpanel" id="panel-transcript" aria-labelledby="tab-transcript">
          <Transcript
            segments={lecture.transcript || []}
            lectureTitle={lecture.title}
            audioUrl={lecture.audioUrl}
            initialSeekTo={initialSeekTo}
          />
        </div>
      )}
    </div>
  );
};

// Sub-component for individual card flip in Grid View
const GridFlashcardItem: React.FC<{
  card: { question: string; answer: string };
  index: number;
  isMastered: boolean;
  onToggleMastered: () => void;
}> = ({ card, index, isMastered, onToggleMastered }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="perspective-1000 min-h-[220px] cursor-pointer"
      onClick={() => setFlipped((prev) => !prev)}
    >
      <div
        className={`relative w-full min-h-[220px] rounded-xl p-5 border transition-transform duration-500 transform-style-preserve-3d shadow-lg flex flex-col justify-between ${
          flipped
            ? 'rotate-y-180 bg-indigo-950/40 border-indigo-500/70'
            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
        }`}
      >
        {!flipped ? (
          <div className="flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded">
                Question #{index + 1}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMastered();
                }}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  isMastered
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                {isMastered ? '✓ Mastered' : 'Mark Mastered'}
              </button>
            </div>
            <h4 className="text-base font-bold text-white my-auto">{card.question}</h4>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <RotateCw className="w-3 h-3 text-indigo-400" />
              <span>Click to view answer</span>
            </div>
          </div>
        ) : (
          <div className="rotate-y-180 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
                Answer #{index + 1}
              </span>
              <span className="text-[10px] text-indigo-300">Click to flip back</span>
            </div>
            <p className="text-sm text-slate-200 my-auto leading-relaxed">{card.answer}</p>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
              <span>Click to view question</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LecturePage;
