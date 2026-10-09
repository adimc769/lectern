import { Router } from 'express';
import { examService } from '../services/examService.js';
import type { ExamQuestionType } from '@lectern/shared';

/**
 * QuizQuestion-compatible projection (mirrors packages/ui QuizQuestion).
 * Defined locally in this route file; never import from packages/.
 */
export interface QuizProjection {
  id: string;
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
  explanation: string;
  /** Generated-from-doc exam questions carry no audio timestamp; the player hides source chips. */
  sourceStart: number;
}

const VALID_TYPES: ExamQuestionType[] = ['mcq', 'tf', 'identification'];

export const examRouter = Router({ mergeParams: true });

/**
 * Reads route params when the router is mounted under /api/documents/:id.
 * The mount param is invisible to the Express path-inferred param types, so
 * params are extracted and validated manually here.
 */
function routeParams(req: { params: unknown }): { id: string; examId: string } {
  const params = (req.params ?? {}) as { id?: unknown; examId?: unknown };
  return {
    id: typeof params.id === 'string' ? params.id : '',
    examId: typeof params.examId === 'string' ? params.examId : '',
  };
}

// POST new exam (background generation). Returns 201 { id, status } immediately.
examRouter.post('/exams', async (req, res) => {
  try {
    const documentId = routeParams(req).id;

    const document = await examService.findDocument(documentId);
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    const { count, types } = (req.body ?? {}) as { count?: unknown; types?: unknown };

    if (
      count !== undefined &&
      (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 12)
    ) {
      res.status(400).json({ error: 'count must be an integer between 1 and 12' });
      return;
    }

    if (
      types !== undefined &&
      (!Array.isArray(types) ||
        types.length === 0 ||
        types.some((t) => typeof t !== 'string' || !VALID_TYPES.includes(t as ExamQuestionType)))
    ) {
      res.status(400).json({ error: "types must be a non-empty array of 'mcq', 'tf', 'identification'" });
      return;
    }

    const created = await examService.startExam(documentId, {
      ...(count !== undefined ? { count: count as number } : {}),
      ...(types !== undefined ? { types: types as ExamQuestionType[] } : {}),
    });

    res.status(201).json(created);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to create exam', details: msg });
  }
});

// GET all exams for a document, newest-first WITHOUT questions
examRouter.get('/exams', async (req, res) => {
  try {
    const exams = await examService.listExams(routeParams(req).id);
    res.json(exams);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to retrieve exams', details: msg });
  }
});

// GET QuizQuestion-compatible MCQ projection of the latest COMPLETED exam.
// sourceStart is always -1: generated-from-doc questions have no audio
// timestamp, so the player hides source chips. [] when no completed exam.
examRouter.get('/quiz', async (req, res) => {
  try {
    const mcqs = await examService.getLatestCompletedMcq(routeParams(req).id);
    const quiz: QuizProjection[] = mcqs.map((q) => ({
      id: q.id,
      question: q.question,
      choices: q.choices as [string, string, string, string],
      answerIndex: q.answerIndex as number,
      explanation: q.explanation,
      sourceStart: -1,
    }));
    res.json(quiz);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to retrieve quiz', details: msg });
  }
});

// GET single exam WITH questions
examRouter.get('/exams/:examId', async (req, res) => {
  try {
    const { id, examId } = routeParams(req);
    const exam = await examService.getExamById(id, examId);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json(exam);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to retrieve exam details', details: msg });
  }
});

// DELETE exam (questions cascade via Prisma onDelete)
examRouter.delete('/exams/:examId', async (req, res) => {
  try {
    const { id, examId } = routeParams(req);
    const deleted = await examService.deleteExam(id, examId);
    if (!deleted) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json({ success: true, message: 'Exam deleted' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to delete exam', details: msg });
  }
});
