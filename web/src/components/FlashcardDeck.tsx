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
  CreditCard,
  HelpCircle,
  Lightbulb,
  Keyboard,
  Layers,
} from 'lucide-react';
import type { FlashcardDTO } from '@lectern/shared';

type Props = {
  flashcards: FlashcardDTO[];
  className?: string;
};

export function FlashcardDeck({ flashcards = [], className = '' }: Props) {
  const [deck, setDeck] = useState<FlashcardDTO[]>(flashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());

  // Keep deck synced with incoming props
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

      // Auto-advance to next card if marked mastered
      if (mastered && currentIndex < deck.length - 1) {
        setTimeout(() => {
          handleNext();
        }, 300);
      }
    },
    [currentIndex, deck.length, handleNext]
  );

  const shuffleDeck = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const resetSession = () => {
    setDeck(flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredIds(new Set());
  };

  // Keyboard navigation: Space to flip, Arrow keys to switch
  useEffect(() => {
    if (!currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [currentCard, handleFlip, handleNext, handlePrev]);

  const masteryPercent = useMemo(() => {
    if (deck.length === 0) return 0;
    return Math.round((masteredIds.size / deck.length) * 100);
  }, [masteredIds.size, deck.length]);

  if (deck.length === 0) {
    return (
      <div className={`p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 ${className}`}>
        <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h4 className="text-base font-semibold text-slate-300">No Flashcards Available</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Flashcards are automatically synthesized from the lecture transcript by local AI models.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Interactive Flashcard Study Deck"
      className={`space-y-6 ${className}`}
    >
      {/* Deck Controls & Mastery Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        {/* Spaced Repetition Mastery */}
        <div className="space-y-1.5 flex-1 max-w-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Study Progress</span>
            </span>
            <span className="font-mono text-indigo-300">
              {masteredIds.size} of {deck.length} Mastered ({masteryPercent}%)
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={masteryPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Deck mastery progress"
            className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${masteryPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={shuffleDeck}
            aria-label="Shuffle card deck"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
            title="Shuffle cards"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={resetSession}
            aria-label="Reset deck session"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
            title="Reset progress"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono">
            <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Space: Flip &bull; &larr; &rarr;: Navigate</span>
          </div>
        </div>
      </div>

      {/* Main Flashcard Stage */}
      {currentCard && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Card Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="font-mono font-semibold text-slate-300">
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
            aria-label={`Flashcard ${currentIndex + 1} of ${deck.length}. ${
              isFlipped ? 'Answer side displayed' : 'Question side displayed'
            }. Press Space to flip.`}
            onClick={handleFlip}
            className="perspective-1000 w-full h-80 sm:h-96 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 rounded-3xl"
          >
            <div
              className={`relative w-full h-full duration-500 transform-style-preserve-3d transition-transform ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Front Side: Question */}
              <div className="absolute inset-0 backface-hidden w-full h-full rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 shadow-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                    <span>QUESTION</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Press Space to flip</span>
                </div>

                <div className="py-4 my-auto">
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                    {currentCard.front}
                  </h3>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Click or tap to reveal answer</span>
                  </span>
                  <span className="font-mono text-[11px]">Spacebar</span>
                </div>
              </div>

              {/* Back Side: Answer */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-10 shadow-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ANSWER</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Click to flip back</span>
                </div>

                <div className="py-4 my-auto">
                  <p className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
                    {currentCard.back}
                  </p>
                </div>

                {/* Self-Rating Mastery Controls */}
                <div
                  className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => toggleMastery(currentCard.id, false)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-800 hover:border-rose-800/60 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>Need Review</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleMastery(currentCard.id, true)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-600/50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-950/50 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Mastered!</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              aria-label="Previous card in deck"
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white text-xs font-semibold border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
              Use &larr; / &rarr; keys or buttons
            </span>

            <button
              type="button"
              disabled={currentIndex === deck.length - 1}
              onClick={handleNext}
              aria-label="Next card in deck"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
