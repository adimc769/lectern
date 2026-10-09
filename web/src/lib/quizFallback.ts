import type { LectureDTO } from '@lectern/shared';
import type { QuizQuestion } from '../../../packages/ui/src/types';

/**
 * Local fallback quiz builder. Used ONLY when the backend has no quiz for a
 * lecture yet (GET /lectures/:id/quiz → [] or 404). Derives multiple-choice
 * questions from the lecture's own flashcards: the card front is the question,
 * its back is the correct answer, and backs of sibling cards are distractors.
 * Real backend quizzes always take precedence — this never overrides them.
 */
export function buildFallbackQuiz(lecture: LectureDTO): QuizQuestion[] {
  const cards = lecture.flashcards ?? [];
  if (cards.length < 4) return [];

  return cards.map((card, i) => {
    const distractors = cards
      .filter((_, j) => j !== i)
      .map((c) => c.back)
      .filter((back) => back !== card.back);
    const unique = [...new Set(distractors)].slice(0, 3);
    if (unique.length < 3) return null;

    const choices = shuffle([card.back, ...unique]);
    return {
      id: `fb-${lecture.id}-${i}`,
      question: card.front,
      choices: choices as QuizQuestion['choices'],
      answerIndex: choices.indexOf(card.back),
      explanation: 'From this lecture’s flashcards — flip the card if unsure.',
      sourceStart: 0,
    } satisfies QuizQuestion;
  }).filter((q): q is QuizQuestion => q !== null);
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
