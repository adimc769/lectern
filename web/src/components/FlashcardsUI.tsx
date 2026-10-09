'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Shuffle,
  RotateCcw,
  LayoutGrid,
  CreditCard,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import type { FlashcardDTO } from '@lectern/shared';

type Props = {
  flashcards: FlashcardDTO[];
  className?: string;
};

type ViewMode = 'study' | 'grid';

export function FlashcardsUI({ flashcards = [], className = '' }: Props) {
  const [deck, setDeck] = useState<FlashcardDTO[]>(flashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('study');
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [gridFlippedState, setGridFlippedState] = useState<Record<string, boolean>>({});

  // Sync deck if flashcards prop updates
  useEffect(() => {
    setDeck(flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [flashcards]);

  const currentCard = deck[currentIndex];

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const toggleMastery = useCallback(
    (cardId: string, mastered: boolean) => {
      setMasteredIds((prev) => {
        const next = new Set(prev);
        if (mastered) {
          next.add(cardId);
        } else {
          next.delete(cardId);
        }
        return next;
      });

      // Auto advance in study mode if mastered
      if (mastered && viewMode === 'study' && currentIndex < deck.length - 1) {
        setTimeout(() => {
          handleNext();
        }, 300);
      }
    },
    [viewMode, currentIndex, deck.length, handleNext]
  );

  const shuffleDeck = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const resetStudySession = () => {
    setDeck(flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredIds(new Set());
    setGridFlippedState({});
  };

  // Keyboard navigation for Study Mode
  useEffect(() => {
    if (viewMode !== 'study' || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, currentCard, handleFlip, handleNext, handlePrev]);

  const masteryPercent = useMemo(() => {
    if (deck.length === 0) return 0;
    return Math.round((masteredIds.size / deck.length) * 100);
  }, [masteredIds.size, deck.length]);

  if (deck.length === 0) {
    return (
      <div className={`p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 ${className}`}>
        <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No Flashcards Generated</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Flashcards are automatically extracted by local AI when an audio lecture is processed.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header & Mastery Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        {/* Progress Stats */}
        <div className="space-y-1.5 flex-1 max-w-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Spaced Repetition Mastery</span>
            </span>
            <span className="font-mono text-indigo-300">
              {masteredIds.size} of {deck.length} cards ({masteryPercent}%)
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={masteryPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Flashcards mastery progress"
            className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${masteryPercent}%` }}
            />
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Shuffle Button */}
          <button
            type="button"
            onClick={shuffleDeck}
            aria-label="Shuffle flashcards deck"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
            title="Shuffle cards"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={resetStudySession}
            aria-label="Reset study session progress"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
            title="Reset progress"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* View Mode Switcher */}
          <div
            role="tablist"
            aria-label="Card display mode"
            className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'study'}
              onClick={() => setViewMode('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'study'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Study Deck</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All ({deck.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Study Deck Mode (Interactive 3D Flip Card) */}
      {viewMode === 'study' && currentCard && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Card Counter & Mastery Status */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="font-mono">
              Card {currentIndex + 1} of {deck.length}
            </span>
            <div className="flex items-center gap-1.5">
              {masteredIds.has(currentCard.id) ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mastered</span>
                </span>
              ) : (
                <span className="text-slate-500">Learning</span>
              )}
            </div>
          </div>

          {/* 3D Flip Card Container */}
          <div
            tabIndex={0}
            role="button"
            aria-pressed={isFlipped}
            aria-label={`Flashcard ${currentIndex + 1}. ${
              isFlipped ? 'Answer side revealed' : 'Question side'
            }. Press Space to flip.`}
            onClick={handleFlip}
            className="perspective-1000 w-full h-80 sm:h-96 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 rounded-3xl"
          >
            <div
              className={`relative w-full h-full duration-500 transform-style-preserve-3d transition-transform ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Front of Card (Question) */}
              <div className="absolute inset-0 backface-hidden w-full h-full rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 shadow-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>QUESTION</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Click or press Space to flip</span>
                </div>

                <div className="py-4 my-auto">
                  <h4 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                    {currentCard.front}
                  </h4>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Reveal Answer</span>
                  </span>
                  <span className="font-mono text-[11px]">Spacebar</span>
                </div>
              </div>

              {/* Back of Card (Answer) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 shadow-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ANSWER</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Click to flip back</span>
                </div>

                <div className="py-4 my-auto">
                  <p className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
                    {currentCard.back}
                  </p>
                </div>

                {/* Self-Grading Mastery Buttons */}
                <div
                  className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => toggleMastery(currentCard.id, false)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>Need Review</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleMastery(currentCard.id, true)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-950/50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Mastered!</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Deck Controls (Previous / Next) */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              aria-label="Previous flashcard"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-semibold border border-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              Keyboard: &larr; / &rarr; to navigate &bull; Space to flip
            </span>

            <button
              type="button"
              disabled={currentIndex === deck.length - 1}
              onClick={handleNext}
              aria-label="Next flashcard"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: All Cards Grid Mode */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deck.map((card, idx) => {
            const isCardFlipped = !!gridFlippedState[card.id];
            const isMastered = masteredIds.has(card.id);

            return (
              <div
                key={card.id}
                onClick={() =>
                  setGridFlippedState((prev) => ({
                    ...prev,
                    [card.id]: !prev[card.id],
                  }))
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setGridFlippedState((prev) => ({
                      ...prev,
                      [card.id]: !prev[card.id],
                    }));
                  }
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[220px] ${
                  isMastered
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-500">#{idx + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isCardFlipped
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        }`}
                      >
                        {isCardFlipped ? 'ANSWER' : 'QUESTION'}
                      </span>
                      {isMastered && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-white leading-relaxed">
                    {isCardFlipped ? card.back : card.front}
                  </p>
                </div>

                <div
                  className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[11px] text-slate-500">Click card to toggle</span>
                  <button
                    type="button"
                    onClick={() => toggleMastery(card.id, !isMastered)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isMastered
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {isMastered ? 'Mastered' : 'Mark Mastered'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
