import { CONFIG } from '../config.js';
import { prisma } from '../db.js';
import type { ExamDTO, ExamQuestionDTO, ExamQuestionType } from '@lectern/shared';

export const EXAM_DEFAULT_COUNT = 8;
export const EXAM_MAX_COUNT = 12;
export const EXAM_TYPES: ExamQuestionType[] = ['mcq', 'tf', 'identification'];
export const EXAM_OLLAMA_TIMEOUT_MS = 120000;

export interface ExamSourceChunk {
  text: string;
  pageNo: number;
  section: string | null;
}

export interface ExamGenerateOptions {
  count?: number;
  types?: ExamQuestionType[];
}

export interface ExamPromptMessage {
  role: string;
  content: string;
}

export interface ValidatedExamQuestion {
  qtype: ExamQuestionType;
  question: string;
  choices?: [string, string, string, string];
  answerIndex?: number;
  answer?: string;
  acceptableAnswers?: string[];
  explanation: string;
  pageNo: number | null;
  section: string | null;
}

function parseSections(sectionsJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(sectionsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

function parseStringArray(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Normalizes a question stem for dedupe: lowercase, strip punctuation,
 * collapse whitespace.
 */
export function normalizeStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best-effort parse of an Ollama JSON-format chat reply. The model is asked
 * for raw JSON, but code fences are stripped defensively before failing.
 */
function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // ignore and try fence-stripped content below
  }
  const fenced = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(fenced);
  } catch {
    // ignore and try brace extraction below
  }
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(content.slice(start, end + 1));
  }
  throw new Error('Ollama chat endpoint returned non-JSON content');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toExamQuestionDTO(row: {
  id: string;
  qtype: string;
  question: string;
  choicesJson: string;
  answerIndex: number | null;
  answer: string | null;
  acceptableJson: string;
  explanation: string;
  pageNo: number | null;
  section: string | null;
}): ExamQuestionDTO {
  const choices = parseStringArray(row.choicesJson);
  const acceptable = parseStringArray(row.acceptableJson);
  return {
    id: row.id,
    qtype: row.qtype as ExamQuestionType,
    question: row.question,
    ...(choices.length === 4 ? { choices: choices as [string, string, string, string] } : {}),
    ...(row.answerIndex !== null && row.answerIndex !== undefined
      ? { answerIndex: row.answerIndex }
      : {}),
    ...(row.answer !== null && row.answer !== undefined ? { answer: row.answer } : {}),
    ...(acceptable.length > 0 ? { acceptableAnswers: acceptable } : {}),
    explanation: row.explanation,
    pageNo: row.pageNo ?? null,
    section: row.section ?? null,
  };
}

type ExamRow = {
  id: string;
  documentId: string;
  status: string;
  total: number;
  createdAt: Date;
  updatedAt: Date;
};

function toExamDTO(
  row: ExamRow,
  questions?: Array<Parameters<typeof toExamQuestionDTO>[0]>,
): ExamDTO {
  return {
    id: row.id,
    documentId: row.documentId,
    status: row.status as ExamDTO['status'],
    total: row.total,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(questions ? { questions: questions.map(toExamQuestionDTO) } : {}),
  };
}

export class ExamService {
  /**
   * Normalizes generation options: count defaults to 8 and is capped at 12;
   * types default to all three types spread evenly.
   */
  normalizeOptions(count?: number, types?: ExamQuestionType[]): { count: number; types: ExamQuestionType[] } {
    const normalizedCount =
      typeof count === 'number' && Number.isFinite(count)
        ? Math.max(1, Math.min(EXAM_MAX_COUNT, Math.floor(count)))
        : EXAM_DEFAULT_COUNT;
    const filtered = Array.isArray(types)
      ? types.filter((t): t is ExamQuestionType => EXAM_TYPES.includes(t))
      : [];
    return {
      count: normalizedCount,
      types: filtered.length > 0 ? filtered : [...EXAM_TYPES],
    };
  }

  /**
   * Loads DocumentChunk rows with their parent pages and picks up to `count`
   * representative chunks round-robin across pages (longest first per page)
   * for topic spread.
   */
  async selectChunks(documentId: string, count: number): Promise<ExamSourceChunk[]> {
    const limit = Math.max(1, Math.min(EXAM_MAX_COUNT, Math.floor(count) || EXAM_DEFAULT_COUNT));

    const [chunks, pages] = await Promise.all([
      prisma.documentChunk.findMany({ where: { documentId }, orderBy: { pageNo: 'asc' } }),
      prisma.documentPage.findMany({ where: { documentId } }),
    ]);

    const pageSectionFallback = new Map<number, string | null>();
    for (const page of pages) {
      if (!pageSectionFallback.has(page.pageNo)) {
        pageSectionFallback.set(page.pageNo, parseSections(page.sectionsJson)[0] ?? null);
      }
    }

    const byPage = new Map<number, typeof chunks>();
    for (const chunk of chunks) {
      const group = byPage.get(chunk.pageNo);
      if (group) {
        group.push(chunk);
      } else {
        byPage.set(chunk.pageNo, [chunk]);
      }
    }
    for (const group of byPage.values()) {
      group.sort((a, b) => b.text.length - a.text.length);
    }

    const pageNos = [...byPage.keys()].sort((a, b) => a - b);
    const picked: typeof chunks = [];
    for (let round = 0; picked.length < limit; round++) {
      let progressed = false;
      for (const pageNo of pageNos) {
        const group = byPage.get(pageNo);
        if (group && round < group.length && picked.length < limit) {
          picked.push(group[round]);
          progressed = true;
        }
      }
      if (!progressed) {
        break;
      }
    }

    return picked.map((c) => ({
      text: c.text,
      pageNo: c.pageNo,
      section: c.section ?? pageSectionFallback.get(c.pageNo) ?? null,
    }));
  }

  /**
   * Builds the grounded generation prompt. System rules force passage-only
   * questions with exactly-one-correct MCQs, non-trivial T/F, 1-3-answer
   * identification, per-question explanations with source refs, no duplicate
   * stems, and no outside facts. Requests `format: 'json'` shape
   * {questions:[{qtype,question,choices?,answerIndex?,answer?,acceptableAnswers?,explanation,pageNo?,section?}]}.
   */
  buildPrompt(
    chunks: ExamSourceChunk[],
    types: ExamQuestionType[],
    count: number,
  ): ExamPromptMessage[] {
    const passages = chunks
      .map((c, idx) => {
        const label = c.section ? `Page ${c.pageNo}, ${c.section}` : `Page ${c.pageNo}`;
        return `[Passage ${idx + 1}] (${label}):\n${c.text}`;
      })
      .join('\n\n');

    const system = [
      'You are an offline academic assistant writing grounded practice-exam questions from course documents.',
      'Rules:',
      '1. Every question must be answerable ONLY from the provided passages. Never use outside facts.',
      '2. Multiple-choice (mcq) questions have exactly one correct answer: 4 distinct, plausible distractors drawn from the same material.',
      '3. True/false (tf) questions must never be trivially negated restatements of a passage sentence.',
      '4. Identification questions have 1-3 acceptable answers.',
      '5. Every question carries a one-line explanation that quotes or paraphrases its passage, plus a sourceRef { pageNo, section } pointing at that passage.',
      '6. Never repeat a question stem; every question must be unique.',
    ].join('\n');

    const user = [
      `Write exactly ${count} exam questions using a balanced mix of these types: ${types.join(', ')}.`,
      '',
      'Passages:',
      passages,
      '',
      'Respond with a single JSON object shaped exactly like {"questions":[{"qtype","question","choices","answerIndex","answer","acceptableAnswers","explanation","pageNo","section"}]} where:',
      '- qtype is one of "mcq", "tf", "identification".',
      '- mcq carries choices (array of exactly 4 distinct strings) and answerIndex (0-3).',
      '- tf carries answer ("True" or "False") and no choices.',
      '- identification carries acceptableAnswers (array of 1-3 strings).',
      '- every item carries explanation (one line quoting or paraphrasing its passage), pageNo (passage page number), and section (passage section or null).',
      'Explanations are generated WITH each question in this same response, never afterwards.',
    ].join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  /**
   * Validates raw Ollama output. Drops invalid items (logging the count):
   * mcq needs 4 distinct choices + answerIndex 0..3, tf needs answer
   * 'True'|'False', identification needs >= 1 acceptable answer, all need
   * non-empty question + explanation. Dedupes by normalized stem.
   */
  validate(parsed: unknown): ValidatedExamQuestion[] {
    if (!isRecord(parsed) || !Array.isArray(parsed.questions)) {
      console.warn('[ExamService] validation dropped all items: response has no questions array');
      return [];
    }

    const valid: ValidatedExamQuestion[] = [];
    const seenStems = new Set<string>();
    let dropped = 0;

    for (const item of parsed.questions) {
      if (!isRecord(item)) {
        dropped++;
        continue;
      }

      const qtype = item.qtype;
      if (qtype !== 'mcq' && qtype !== 'tf' && qtype !== 'identification') {
        dropped++;
        continue;
      }

      const question = asNonEmptyString(item.question);
      const explanation = asNonEmptyString(item.explanation);
      if (!question || !explanation) {
        dropped++;
        continue;
      }

      const stem = normalizeStem(question);
      if (seenStems.has(stem)) {
        dropped++;
        continue;
      }

      if (qtype === 'mcq') {
        const rawChoices = Array.isArray(item.choices) ? item.choices : null;
        const choices = rawChoices
          ? rawChoices.map((c) => (typeof c === 'string' ? c.trim() : '')).filter((c) => c.length > 0)
          : [];
        const distinct = new Set(choices.map((c) => c.toLowerCase()));
        if (
          choices.length !== 4 ||
          distinct.size !== 4 ||
          !Number.isInteger(item.answerIndex) ||
          (item.answerIndex as number) < 0 ||
          (item.answerIndex as number) > 3
        ) {
          dropped++;
          continue;
        }
        seenStems.add(stem);
        valid.push({
          qtype,
          question,
          choices: choices as [string, string, string, string],
          answerIndex: item.answerIndex as number,
          explanation,
          pageNo: Number.isInteger(item.pageNo) && (item.pageNo as number) >= 1 ? (item.pageNo as number) : null,
          section: asNonEmptyString(item.section),
        });
        continue;
      }

      if (qtype === 'tf') {
        const answer = typeof item.answer === 'string' ? item.answer.trim() : null;
        if (answer !== 'True' && answer !== 'False') {
          dropped++;
          continue;
        }
        seenStems.add(stem);
        valid.push({
          qtype,
          question,
          answer,
          explanation,
          pageNo: Number.isInteger(item.pageNo) && (item.pageNo as number) >= 1 ? (item.pageNo as number) : null,
          section: asNonEmptyString(item.section),
        });
        continue;
      }

      const rawAcceptable = Array.isArray(item.acceptableAnswers) ? item.acceptableAnswers : [];
      const acceptableAnswers = rawAcceptable
        .map((a) => (typeof a === 'string' ? a.trim() : ''))
        .filter((a) => a.length > 0);
      if (acceptableAnswers.length < 1) {
        dropped++;
        continue;
      }
      seenStems.add(stem);
      valid.push({
        qtype,
        question,
        answer: acceptableAnswers[0],
        acceptableAnswers,
        explanation,
        pageNo: Number.isInteger(item.pageNo) && (item.pageNo as number) >= 1 ? (item.pageNo as number) : null,
        section: asNonEmptyString(item.section),
      });
    }

    if (dropped > 0) {
      console.warn(`[ExamService] validation dropped ${dropped} invalid question(s)`);
    }
    return valid;
  }

  /**
   * Calls Ollama chat with JSON format for exam generation.
   */
  private async callOllamaChat(messages: ExamPromptMessage[]): Promise<unknown> {
    const res = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.OLLAMA_LLM_MODEL,
        messages,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(EXAM_OLLAMA_TIMEOUT_MS),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama chat error (${res.status}): ${errText}`);
    }

    interface OllamaChatResponse {
      message?: { content?: string };
    }
    const data = (await res.json()) as OllamaChatResponse;
    const content = data.message?.content?.trim() ?? '';
    if (!content) {
      throw new Error('Ollama chat endpoint returned empty content');
    }
    return parseJsonContent(content);
  }

  /**
   * Generates validated exam questions from a document's chunks. Retries the
   * Ollama call ONCE when zero valid questions remain after validation.
   */
  async generateQuestions(
    documentId: string,
    count?: number,
    types?: ExamQuestionType[],
  ): Promise<ValidatedExamQuestion[]> {
    const { count: normalizedCount, types: normalizedTypes } = this.normalizeOptions(count, types);
    const chunks = await this.selectChunks(documentId, normalizedCount);
    if (chunks.length === 0) {
      throw new Error('No document chunks available for exam generation');
    }

    const messages = this.buildPrompt(chunks, normalizedTypes, normalizedCount);
    let valid = this.validate(await this.callOllamaChat(messages));
    if (valid.length === 0) {
      console.warn(`[ExamService] no valid questions for document ${documentId}; retrying Ollama call once`);
      valid = this.validate(await this.callOllamaChat(messages));
    }
    return valid;
  }

  /**
   * Runs the background exam job: generates questions, then persists the Exam
   * + questions on success (status COMPLETED, total = saved count) or marks
   * FAILED with the error on failure. Never throws unhandled errors.
   */
  async runExamJob(examId: string, documentId: string, count: number, types: ExamQuestionType[]): Promise<void> {
    try {
      const document = await prisma.document.findUnique({ where: { id: documentId } });
      if (!document) {
        throw new Error('Document not found');
      }

      const questions = await this.generateQuestions(documentId, count, types);

      for (const q of questions) {
        await prisma.examQuestion.create({
          data: {
            examId,
            qtype: q.qtype,
            question: q.question,
            choicesJson: JSON.stringify(q.choices ?? []),
            ...(q.answerIndex !== undefined ? { answerIndex: q.answerIndex } : {}),
            ...(q.answer !== undefined ? { answer: q.answer } : {}),
            acceptableJson: JSON.stringify(q.acceptableAnswers ?? []),
            explanation: q.explanation,
            ...(q.pageNo !== null ? { pageNo: q.pageNo } : {}),
            ...(q.section !== null ? { section: q.section } : {}),
          },
        });
      }

      await prisma.exam.update({
        where: { id: examId },
        data: { status: 'COMPLETED', total: questions.length },
      });
      console.log(`[ExamService] Exam ${examId} completed with ${questions.length} questions`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ExamService] Exam ${examId} failed:`, errorMsg);

      await prisma.exam
        .update({
          where: { id: examId },
          data: { status: 'FAILED', error: errorMsg },
        })
        .catch(() => {});
    }
  }

  /**
   * Creates an Exam row and starts generation asynchronously in the
   * background (mirrors documentPipeline.startPipeline).
   */
  async startExam(documentId: string, options: ExamGenerateOptions = {}): Promise<{ id: string; status: string }> {
    const { count, types } = this.normalizeOptions(options.count, options.types);
    const exam = await prisma.exam.create({
      data: { documentId, status: 'PROCESSING', total: 0 },
    });
    queueMicrotask(() => {
      void this.runExamJob(exam.id, documentId, count, types);
    });
    return { id: exam.id, status: exam.status };
  }

  /**
   * Finds a document by id (used for 404 handling in routes).
   */
  async findDocument(documentId: string) {
    return prisma.document.findUnique({ where: { id: documentId } });
  }

  /**
   * Lists exams newest-first WITHOUT questions (total included).
   */
  async listExams(documentId: string): Promise<ExamDTO[]> {
    const rows = await prisma.exam.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toExamDTO(r));
  }

  /**
   * Returns a single exam WITH questions, scoped to its document.
   * Returns null when missing or owned by another document.
   */
  async getExamById(documentId: string, examId: string): Promise<ExamDTO | null> {
    const row = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });
    if (!row || row.documentId !== documentId) {
      return null;
    }
    return toExamDTO(row, row.questions);
  }

  /**
   * Returns validated MCQ questions of the latest COMPLETED exam for the
   * quiz projection. Empty when no completed exam exists.
   */
  async getLatestCompletedMcq(documentId: string): Promise<ExamQuestionDTO[]> {
    const latest = await prisma.exam.findFirst({
      where: { documentId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: { questions: true },
    });
    if (!latest) {
      return [];
    }
    return latest.questions
      .filter((q) => q.qtype === 'mcq')
      .map(toExamQuestionDTO)
      .filter((q) => q.choices && q.answerIndex !== undefined);
  }

  /**
   * Deletes an exam (questions cascade). Returns false when missing or
   * owned by another document.
   */
  async deleteExam(documentId: string, examId: string): Promise<boolean> {
    const row = await prisma.exam.findUnique({ where: { id: examId } });
    if (!row || row.documentId !== documentId) {
      return false;
    }
    await prisma.exam.delete({ where: { id: examId } });
    return true;
  }
}

export const examService = new ExamService();
