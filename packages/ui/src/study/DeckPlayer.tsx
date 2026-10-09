import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SourceChip } from './SourceChip';
import { StudyMascot } from './StudyMascot';
import { sortDueFirst } from './srs';
import './study.css';

export interface DeckPlayerCard {
  id: string;
  question: string;
  answer: string;
  sourceStart?: number;
}

export interface DeckPlayerSummary {
  known: number;
  learning: number;
  seconds: number;
}

export interface DeckPlayerProps {
  lectureId: string;
  lectureTitle: string;
  cards: Array<{ id: string; question: string; answer: string; sourceStart?: number }>;
  initialBoxes?: Record<string, number>;
  onRateCard?: (cardId: string, known: boolean) => void;
  onOpenSource?: (start: number) => void;
  onComplete?: (summary: { known: number; learning: number; seconds: number }) => void;
}

/** Swipe must travel this far horizontally (and dominate vertical drift) to count as a rating. */
const SWIPE_THRESHOLD_PX = 60;

/**
 * DeckPlayer — full-screen single-card Study Circuit deck.
 *
 * - 3D flip on click or Space; "Got it" (ArrowRight) / "Still learning"
 *   (ArrowLeft) chunky buttons; pointer-event swipe is enhancement only.
 * - Cards are ordered due-first via srs.sortDueFirst (initialBoxes → box,
 *   default 1). Cards rated "still learning" loop in later laps until every
 *   card is known, then onComplete fires once and an inline completion state
 *   (StudyMascot + coach microcopy) replaces the deck.
 */
export function DeckPlayer({
  lectureId,
  lectureTitle,
  cards,
  initialBoxes,
  onRateCard,
  onOpenSource,
  onComplete,
}: DeckPlayerProps) {
  // Due-first ordering: srs.sortDueFirst takes cards carrying a `box` field,
  // so bridge initialBoxes into that shape (unboxed cards default to box 1).
  const ordered: DeckPlayerCard[] = useMemo(() => {
    const withBox = cards.map((card) => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      sourceStart: card.sourceStart,
      box: initialBoxes?.[card.id] ?? 1,
    }));
    return sortDueFirst(withBox);
  }, [cards, initialBoxes]);

  const byId = useMemo(() => new Map(ordered.map((card) => [card.id, card])), [ordered]);
  const total = ordered.length;

  const [queue, setQueue] = useState<string[]>(() => ordered.map((card) => card.id));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [learningQueue, setLearningQueue] = useState<string[]>([]);
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [lap, setLap] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Session clock for the `seconds` field of onComplete.
  const startRef = useRef<number>(Date.now());
  const completedRef = useRef(false);
  // Pointer-gesture tracking so a swipe-rate isn't also treated as a flip tap.
  const gestureRef = useRef({ startX: 0, startY: 0, swiped: false });

  const currentId = completed ? undefined : queue[pos];
  const current = currentId !== undefined ? byId.get(currentId) : undefined;

  const rate = useCallback(
    (known: boolean) => {
      if (completed || currentId === undefined) return;
      const id = currentId;
      onRateCard?.(id, known);

      let nextKnown = knownIds;
      if (known && !knownIds.includes(id)) {
        nextKnown = [...knownIds, id];
        setKnownIds(nextKnown);
      }

      let nextLearning = learningQueue;
      if (!known && !learningQueue.includes(id) && !knownIds.includes(id)) {
        nextLearning = [...learningQueue, id];
        setLearningQueue(nextLearning);
      }

      const nextPos = pos + 1;
      if (nextPos < queue.length) {
        setPos(nextPos);
        setFlipped(false);
      } else if (nextLearning.length > 0) {
        // New lap with the cards still being learned.
        setQueue(nextLearning);
        setLearningQueue([]);
        setPos(0);
        setFlipped(false);
        setLap((value) => value + 1);
      } else {
        const seconds = Math.max(0, Math.round((Date.now() - startRef.current) / 1000));
        setElapsedSeconds(seconds);
        setCompleted(true);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.({ known: nextKnown.length, learning: 0, seconds });
        }
      }
    },
    [completed, currentId, knownIds, learningQueue, onComplete, onRateCard, pos, queue],
  );

  // Keyboard: Space flips, ArrowRight = got it, ArrowLeft = still learning.
  // Ignored while typing in inputs; Space on a button keeps native behavior.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (completed) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const isSpace = event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space';
      if (isSpace && target?.closest('button')) return;
      if (isSpace) {
        event.preventDefault();
        setFlipped((value) => !value);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        rate(true);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        rate(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [completed, rate]);

  const restart = useCallback(() => {
    setQueue(ordered.map((card) => card.id));
    setPos(0);
    setFlipped(false);
    setLearningQueue([]);
    setKnownIds([]);
    setLap(1);
    setCompleted(false);
    setElapsedSeconds(0);
    startRef.current = Date.now();
    completedRef.current = false;
  }, [ordered]);

  const handleCardClick = () => {
    if (gestureRef.current.swiped) {
      gestureRef.current.swiped = false;
      return;
    }
    setFlipped((value) => !value);
  };

  const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setFlipped((value) => !value);
    }
  };

  // Swipe (enhancement only — rating buttons below always work).
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    gestureRef.current = { startX: event.clientX, startY: event.clientY, swiped: false };
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { startX, startY } = gestureRef.current;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    gestureRef.current.swiped = false;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      gestureRef.current.swiped = true;
      rate(dx > 0);
    }
  };

  const doneCount = knownIds.length;
  const progressPct = total === 0 ? 100 : Math.min(100, Math.round((doneCount / total) * 100));

  // Empty deck: friendly state, no onComplete (nothing was studied).
  if (total === 0) {
    return (
      <section
        role="region"
        aria-label={`Study deck: ${lectureTitle}`}
        data-lecture-id={lectureId}
        className="study-screen"
      >
        <StudyMascot message="No cards in this circuit yet. Add some flashcards to start your first lap." />
      </section>
    );
  }

  if (completed) {
    return (
      <section
        role="region"
        aria-label={`Study deck complete: ${lectureTitle}`}
        data-lecture-id={lectureId}
        className="study-screen"
      >
        <div className="study-confetti" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => (
            <span
              key={index}
              className="study-confetti-piece"
              style={{
                left: `${(index * 71) % 100}%`,
                animationDelay: `${index * 70}ms`,
              }}
            />
          ))}
        </div>
        <div className="study-progress-wrap" aria-live="polite" aria-atomic="true">
          <div
            className="study-progress-track"
            role="progressbar"
            aria-label="Study progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={total}
          >
            <div className="study-progress-fill" style={{ width: '100%' }} />
          </div>
          <p className="study-progress-text">{`${total} / ${total}`}</p>
        </div>
        <StudyMascot message="Circuit complete. Sharp work." size={72} />
        <h2 className="study-complete-title">Circuit complete</h2>
        <p className="study-complete-sub">
          {`You nailed ${total} of ${total} in ${elapsedSeconds}s.`}
        </p>
        <button type="button" className="study-btn study-btn-got" onClick={restart}>
          Study again
        </button>
      </section>
    );
  }

  if (current === undefined) return null;

  const positionText = `${Math.min(doneCount + 1, total)} / ${total}`;

  return (
    <section
      role="region"
      aria-label={`Study deck: ${lectureTitle}`}
      data-lecture-id={lectureId}
      className="study-screen"
    >
      <div className="study-progress-wrap" aria-live="polite" aria-atomic="true">
        <div
          className="study-progress-track"
          role="progressbar"
          aria-label="Study progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
        >
          <div className="study-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="study-progress-text">{positionText}</p>
      </div>

      <h2 className="study-lecture-title">{lectureTitle}</h2>
      {lap > 1 && (
        <p className="study-lap-note" aria-live="polite">
          {`Lap ${lap} — ${queue.length} tricky ${queue.length === 1 ? 'one' : 'ones'} left. You've got this.`}
        </p>
      )}

      <div className="study-flip-scene study-slide-in" key={current.id}>
        <div
          className={`study-flip-inner${flipped ? ' is-flipped' : ''}`}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          aria-label={
            flipped
              ? 'Card showing answer. Activate to show question.'
              : 'Card showing question. Activate to show answer.'
          }
        >
          <div className="study-flip-face study-flip-front study-card">
            <p className="study-card-text">{current.question}</p>
            {current.sourceStart !== undefined && (
              <div className="study-chip-row" onClick={(event) => event.stopPropagation()}>
                <SourceChip start={current.sourceStart} onOpen={onOpenSource} />
              </div>
            )}
            <span className="study-hint">Tap or press Space to flip</span>
          </div>
          <div className="study-flip-face study-flip-back study-card" aria-hidden={!flipped}>
            <p className="study-card-text">{current.answer}</p>
            {current.sourceStart !== undefined && (
              <div className="study-chip-row" onClick={(event) => event.stopPropagation()}>
                <SourceChip start={current.sourceStart} onOpen={onOpenSource} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="study-actions">
        <button
          type="button"
          className="study-btn study-btn-learning"
          onClick={() => rate(false)}
          aria-label="Still learning (left arrow key)"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          <span>Still learning</span>
        </button>
        <button
          type="button"
          className="study-btn study-btn-got"
          onClick={() => rate(true)}
          aria-label="Got it (right arrow key)"
        >
          <span>Got it</span>
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default DeckPlayer;
