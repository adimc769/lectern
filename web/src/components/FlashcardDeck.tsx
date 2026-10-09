'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Shuffle,
  RotateCcw,
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

      if (mastered && currentIndex < deck.length - 1) {
        setTimeout(() => {
          handleNext();
        }, 200);
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
      } else if (e.key === '1') {
        e.preventDefault();
        toggleMastery(currentCard.id, false);
      } else if (e.key === '2') {
        e.preventDefault();
        toggleMastery(currentCard.id, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCard, handleFlip, handleNext, handlePrev, toggleMastery]);

  const masteryPercent = useMemo(() => {
    if (deck.length === 0) return 0;
    return Math.round((masteredIds.size / deck.length) * 100);
  }, [masteredIds.size, deck.length]);

  if (deck.length === 0) {
    return (
      <div className={`p-10 text-center rounded-lg border border-zinc-800 bg-zinc-900/40 text-xs font-mono text-zinc-500 ${className}`}>
        No flashcards extracted for this lecture.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Flashcard Deck"
      className={`space-y-4 ${className}`}
    >
      {/* Control bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-zinc-850 bg-zinc-900/50 text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">
            Card {currentIndex + 1} / {deck.length}
          </span>
          <span className="text-zinc-600">&bull;</span>
          <span className="text-emerald-400">
            {masteredIds.size} mastered ({masteryPercent}%)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={shuffleDeck}
            aria-label="Shuffle cards"
            className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Shuffle deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={resetSession}
            aria-label="Reset deck session"
            className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Reset session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] text-zinc-500 border-l border-zinc-800 pl-2">
            Space: flip &bull; &larr; &rarr;: navigate
          </span>
        </div>
      </div>

      {/* 3D Card Stage */}
      {currentCard && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div
            tabIndex={0}
            role="button"
            aria-pressed={isFlipped}
            aria-label={`Flashcard ${currentIndex + 1}. Press Space to flip.`}
            onClick={handleFlip}
            className="perspective-1000 w-full h-72 sm:h-80 cursor-pointer outline-none focus:ring-1 focus:ring-zinc-600 rounded-xl"
          >
            <div
              className={`relative w-full h-full duration-300 transform-style-preserve-3d transition-transform ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Front Side: Question */}
              <div className="absolute inset-0 backface-hidden w-full h-full rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500 uppercase tracking-wider font-semibold">
                    QUESTION
                  </span>
                  <span className="text-zinc-600">Space to flip</span>
                </div>

                <div className="py-2 my-auto">
                  <h3 className="text-lg sm:text-xl font-medium text-zinc-100 leading-snug">
                    {currentCard.front}
                  </h3>
                </div>

                <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3 h-3 text-zinc-600" />
                    <span>Flip card</span>
                  </span>
                  <span>[Space]</span>
                </div>
              </div>

              {/* Back Side: Answer */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-xl border border-zinc-700 bg-zinc-900 p-8 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400 uppercase tracking-wider font-semibold">
                    ANSWER
                  </span>
                  <span className="text-zinc-600">Space to flip</span>
                </div>

                <div className="py-2 my-auto">
                  <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-normal">
                    {currentCard.back}
                  </p>
                </div>

                {/* Self-Rating Mastery Controls */}
                <div
                  className="pt-3 border-t border-zinc-850 flex items-center justify-between gap-3 font-mono text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => toggleMastery(currentCard.id, false)}
                    className="flex-1 py-1.5 px-3 rounded bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>1 Again</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleMastery(currentCard.id, true)}
                    className="flex-1 py-1.5 px-3 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>2 Mastered</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stepper buttons */}
          <div className="flex items-center justify-between text-xs font-mono">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 text-zinc-300 border border-zinc-800 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="text-zinc-600 text-[11px]">
              Use keyboard arrows to navigate
            </span>

            <button
              type="button"
              disabled={currentIndex === deck.length - 1}
              onClick={handleNext}
              className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 text-zinc-300 border border-zinc-800 transition-colors flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
