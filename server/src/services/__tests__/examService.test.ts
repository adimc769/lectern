import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { EXAM_DEFAULT_COUNT, EXAM_MAX_COUNT, examService, normalizeStem } from '../examService.js';

vi.mock('../../db.js', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
    },
    documentPage: {
      findMany: vi.fn(),
    },
    exam: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    examQuestion: {
      create: vi.fn(),
    },
  },
}));

// Mocked modules must be imported after vi.mock is hoisted.
import { examRouter } from '../../routes/examRoutes.js';
import { prisma } from '../../db.js';

const docFindUnique = () => prisma.document.findUnique as unknown as ReturnType<typeof vi.fn>;
const chunkFindMany = () => prisma.documentChunk.findMany as unknown as ReturnType<typeof vi.fn>;
const pageFindMany = () => prisma.documentPage.findMany as unknown as ReturnType<typeof vi.fn>;
const examCreate = () => prisma.exam.create as unknown as ReturnType<typeof vi.fn>;
const examUpdate = () => prisma.exam.update as unknown as ReturnType<typeof vi.fn>;
const examQuestionCreate = () => prisma.examQuestion.create as unknown as ReturnType<typeof vi.fn>;
const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

function goodMcq(overrides: Record<string, unknown> = {}) {
  return {
    qtype: 'mcq',
    question: 'Which organelle releases energy from glucose?',
    choices: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi apparatus'],
    answerIndex: 0,
    explanation: 'The passage states mitochondria release energy from glucose.',
    pageNo: 2,
    section: 'Cell Biology',
    ...overrides,
  };
}

function goodTf(overrides: Record<string, unknown> = {}) {
  return {
    qtype: 'tf',
    question: 'Mitochondria release energy from glucose.',
    answer: 'True',
    explanation: 'The passage directly states mitochondria release energy from glucose.',
    pageNo: 2,
    section: 'Cell Biology',
    ...overrides,
  };
}

function goodId(overrides: Record<string, unknown> = {}) {
  return {
    qtype: 'identification',
    question: 'Name the organelle that releases energy from glucose.',
    acceptableAnswers: ['Mitochondria', 'Mitochondrion'],
    explanation: 'The passage identifies mitochondria as the energy-releasing organelle.',
    pageNo: 2,
    section: 'Cell Biology',
    ...overrides,
  };
}

function chatResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ message: { content: JSON.stringify(payload) } }),
    text: () => Promise.resolve(''),
  };
}

describe('ExamService validation', () => {
  it('accepts a good MCQ question', () => {
    const valid = examService.validate({ questions: [goodMcq()] });
    expect(valid).toHaveLength(1);
    expect(valid[0].qtype).toBe('mcq');
    expect(valid[0].choices).toEqual([
      'Mitochondria',
      'Nucleus',
      'Ribosome',
      'Golgi apparatus',
    ]);
    expect(valid[0].answerIndex).toBe(0);
    expect(valid[0].pageNo).toBe(2);
    expect(valid[0].section).toBe('Cell Biology');
  });

  it('accepts a good true/false question and maps the answer field', () => {
    const valid = examService.validate({ questions: [goodTf()] });
    expect(valid).toHaveLength(1);
    expect(valid[0].qtype).toBe('tf');
    expect(valid[0].answer).toBe('True');
    expect(valid[0].choices).toBeUndefined();
  });

  it('accepts a good identification question with acceptable answers', () => {
    const valid = examService.validate({ questions: [goodId()] });
    expect(valid).toHaveLength(1);
    expect(valid[0].qtype).toBe('identification');
    expect(valid[0].acceptableAnswers).toEqual(['Mitochondria', 'Mitochondrion']);
  });

  it('rejects an MCQ with only 3 choices', () => {
    const valid = examService.validate({
      questions: [goodMcq({ choices: ['Mitochondria', 'Nucleus', 'Ribosome'] })],
    });
    expect(valid).toHaveLength(0);
  });

  it('rejects an MCQ with duplicate choices', () => {
    const valid = examService.validate({
      questions: [
        goodMcq({ choices: ['Mitochondria', 'Nucleus', 'Mitochondria', 'Golgi apparatus'] }),
      ],
    });
    expect(valid).toHaveLength(0);
  });

  it('rejects an MCQ with an out-of-range answerIndex', () => {
    expect(examService.validate({ questions: [goodMcq({ answerIndex: 4 })] })).toHaveLength(0);
    expect(examService.validate({ questions: [goodMcq({ answerIndex: -1 })] })).toHaveLength(0);
    expect(examService.validate({ questions: [goodMcq({ answerIndex: 1.5 })] })).toHaveLength(0);
  });

  it('rejects questions with an empty explanation', () => {
    expect(examService.validate({ questions: [goodMcq({ explanation: '   ' })] })).toHaveLength(0);
    expect(examService.validate({ questions: [goodTf({ explanation: '' })] })).toHaveLength(0);
    expect(examService.validate({ questions: [goodId({ explanation: '' })] })).toHaveLength(0);
  });

  it('rejects identification questions with empty acceptableAnswers', () => {
    expect(examService.validate({ questions: [goodId({ acceptableAnswers: [] })] })).toHaveLength(
      0,
    );
    expect(
      examService.validate({ questions: [goodId({ acceptableAnswers: ['  ', ''] })] }),
    ).toHaveLength(0);
  });

  it('rejects true/false answers outside True|False', () => {
    expect(examService.validate({ questions: [goodTf({ answer: 'Yes' })] })).toHaveLength(0);
    expect(examService.validate({ questions: [goodTf({ answer: 'true' })] })).toHaveLength(0);
  });

  it('drops repeated stems via normalized dedupe', () => {
    expect(normalizeStem('What is X?!')).toBe(normalizeStem('  what   is x. '));
    const valid = examService.validate({
      questions: [
        goodMcq({ question: 'Which organelle releases energy?' }),
        goodMcq({ question: '  WHICH organelle releases energy?! ' }),
      ],
    });
    expect(valid).toHaveLength(1);
  });

  it('returns [] when the response has no questions array', () => {
    expect(examService.validate({})).toEqual([]);
    expect(examService.validate({ questions: 'nope' })).toEqual([]);
    expect(examService.validate(null)).toEqual([]);
  });
});

describe('ExamService options and prompts', () => {
  it('defaults count to 8 and caps at 12 with all three types', () => {
    expect(examService.normalizeOptions()).toEqual({
      count: EXAM_DEFAULT_COUNT,
      types: ['mcq', 'tf', 'identification'],
    });
    expect(examService.normalizeOptions(100).count).toBe(EXAM_MAX_COUNT);
    expect(examService.normalizeOptions(0).count).toBe(1);
    expect(examService.normalizeOptions(5, ['mcq'])).toEqual({ count: 5, types: ['mcq'] });
    expect(examService.normalizeOptions(5, [])).toEqual({
      count: 5,
      types: ['mcq', 'tf', 'identification'],
    });
  });

  it('builds a grounded prompt with passages and the json shape', () => {
    const messages = examService.buildPrompt(
      [
        { text: 'Mitochondria release energy.', pageNo: 1, section: 'Intro' },
        { text: 'Nuclei store DNA.', pageNo: 2, section: null },
      ],
      ['mcq', 'tf', 'identification'],
      6,
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toMatch(/ONLY from the provided passages/);
    expect(messages[1].content).toContain('[Passage 1]');
    expect(messages[1].content).toContain('[Passage 2]');
    expect(messages[1].content).toContain('"questions"');
  });
});

describe('ExamService generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('selects chunks round-robin across pages, longest first per page', async () => {
    chunkFindMany().mockResolvedValue([
      { text: 'short one', pageNo: 1, section: 'A' },
      { text: 'a much longer chunk on page one with more words', pageNo: 1, section: 'A' },
      { text: 'only chunk on page two', pageNo: 2, section: 'B' },
    ]);
    pageFindMany().mockResolvedValue([]);

    const picked = await examService.selectChunks('doc-1', 2);

    expect(picked).toHaveLength(2);
    expect(picked[0].pageNo).toBe(1);
    expect(picked[0].text).toBe('a much longer chunk on page one with more words');
    expect(picked[1].pageNo).toBe(2);
  });

  it('retries the Ollama call once when zero valid questions remain', async () => {
    chunkFindMany().mockResolvedValue([{ text: 'Mitochondria release energy.', pageNo: 1, section: 'Intro' }]);
    pageFindMany().mockResolvedValue([]);
    fetchMock()
      .mockResolvedValueOnce(chatResponse({ questions: [goodMcq({ choices: ['A', 'B'] })] }))
      .mockResolvedValueOnce(chatResponse({ questions: [goodMcq()] }));

    const questions = await examService.generateQuestions('doc-1', 1, ['mcq']);

    expect(questions).toHaveLength(1);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock().mock.calls[0][1] as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(firstBody.format).toBe('json');
    expect(firstBody.stream).toBe(false);
  });

  it('returns [] after the retry also yields nothing valid', async () => {
    chunkFindMany().mockResolvedValue([{ text: 'Some content here.', pageNo: 1, section: null }]);
    pageFindMany().mockResolvedValue([]);
    fetchMock().mockResolvedValue(chatResponse({ questions: [{ qtype: 'mcq' }] }));

    const questions = await examService.generateQuestions('doc-1', 1, ['mcq']);

    expect(questions).toEqual([]);
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it('persists the exam as COMPLETED with the saved count on success', async () => {
    docFindUnique().mockResolvedValue({ id: 'doc-1' });
    chunkFindMany().mockResolvedValue([{ text: 'Mitochondria release energy.', pageNo: 1, section: 'Intro' }]);
    pageFindMany().mockResolvedValue([]);
    fetchMock().mockResolvedValue(chatResponse({ questions: [goodMcq(), goodTf()] }));
    examQuestionCreate().mockResolvedValue({});
    examUpdate().mockResolvedValue({});

    await examService.runExamJob('exam-1', 'doc-1', 2, ['mcq', 'tf']);

    expect(examQuestionCreate()).toHaveBeenCalledTimes(2);
    expect(examUpdate()).toHaveBeenCalledWith({
      where: { id: 'exam-1' },
      data: { status: 'COMPLETED', total: 2 },
    });
  });

  it('marks the exam FAILED when generation throws', async () => {
    docFindUnique().mockResolvedValue(null);
    examUpdate().mockResolvedValue({});

    await examService.runExamJob('exam-1', 'missing-doc', 8, ['mcq', 'tf', 'identification']);

    expect(examUpdate()).toHaveBeenCalledWith({
      where: { id: 'exam-1' },
      data: { status: 'FAILED', error: 'Document not found' },
    });
  });
});

describe('Exam routes', () => {
  let server: import('node:http').Server;
  let baseUrl: string;

  const findDocument = () => examService.findDocument as unknown as ReturnType<typeof vi.fn>;
  const startExam = () => examService.startExam as unknown as ReturnType<typeof vi.fn>;
  const listExams = () => examService.listExams as unknown as ReturnType<typeof vi.fn>;
  const getExamById = () => examService.getExamById as unknown as ReturnType<typeof vi.fn>;
  const getLatestCompletedMcq = () =>
    examService.getLatestCompletedMcq as unknown as ReturnType<typeof vi.fn>;
  const deleteExam = () => examService.deleteExam as unknown as ReturnType<typeof vi.fn>;

  function examRow(overrides: Record<string, unknown> = {}) {
    const now = new Date('2026-01-01T00:00:00.000Z');
    return {
      id: 'exam-1',
      documentId: 'doc-1',
      status: 'COMPLETED',
      total: 2,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...overrides,
    };
  }

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/documents/:id', examRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    // The generation suite stubs global fetch for Ollama; route tests need
    // the real fetch to talk to the ephemeral express server.
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.spyOn(examService, 'findDocument');
    vi.spyOn(examService, 'startExam');
    vi.spyOn(examService, 'listExams');
    vi.spyOn(examService, 'getExamById');
    vi.spyOn(examService, 'getLatestCompletedMcq');
    vi.spyOn(examService, 'deleteExam');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when creating an exam for an unknown document', async () => {
    findDocument().mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/documents/missing/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 8 }),
    });

    expect(res.status).toBe(404);
    expect(startExam()).not.toHaveBeenCalled();
  });

  it('returns 400 for a bad count', async () => {
    findDocument().mockResolvedValue({ id: 'doc-1' });

    for (const count of [0, 13, 2.5, 'eight']) {
      const res = await fetch(`${baseUrl}/api/documents/doc-1/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      expect(res.status).toBe(400);
    }
    expect(startExam()).not.toHaveBeenCalled();
  });

  it('returns 400 for bad types', async () => {
    findDocument().mockResolvedValue({ id: 'doc-1' });

    for (const types of [[], ['essay'], 'mcq', [123]]) {
      const res = await fetch(`${baseUrl}/api/documents/doc-1/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types }),
      });
      expect(res.status).toBe(400);
    }
    expect(startExam()).not.toHaveBeenCalled();
  });

  it('creates an exam with 201 { id, status }', async () => {
    findDocument().mockResolvedValue({ id: 'doc-1' });
    startExam().mockResolvedValue({ id: 'exam-1', status: 'PROCESSING' });

    const res = await fetch(`${baseUrl}/api/documents/doc-1/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 6, types: ['mcq', 'tf'] }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: 'exam-1', status: 'PROCESSING' });
    expect(startExam()).toHaveBeenCalledWith('doc-1', { count: 6, types: ['mcq', 'tf'] });
  });

  it('lists exams newest-first without questions', async () => {
    listExams().mockResolvedValue([examRow(), examRow({ id: 'exam-2' })]);

    const res = await fetch(`${baseUrl}/api/documents/doc-1/exams`);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty('questions');
    expect(body[0].total).toBe(2);
  });

  it('returns 404 for a missing exam', async () => {
    getExamById().mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/documents/doc-1/exams/nope`);
    expect(res.status).toBe(404);
  });

  it('returns a single exam with questions', async () => {
    getExamById().mockResolvedValue({
      ...examRow(),
      questions: [
        {
          id: 'q-1',
          qtype: 'mcq',
          question: 'Which organelle releases energy?',
          choices: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi'],
          answerIndex: 0,
          explanation: 'From the passage.',
          pageNo: 1,
          section: 'Intro',
        },
      ],
    });

    const res = await fetch(`${baseUrl}/api/documents/doc-1/exams/exam-1`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.questions).toHaveLength(1);
  });

  it('projects the latest completed exam as quiz questions with sourceStart -1', async () => {
    getLatestCompletedMcq().mockResolvedValue([
      {
        id: 'q-1',
        qtype: 'mcq',
        question: 'Which organelle releases energy?',
        choices: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi apparatus'],
        answerIndex: 2,
        explanation: 'The passage states it.',
        pageNo: 3,
        section: 'Cells',
      },
    ]);

    const res = await fetch(`${baseUrl}/api/documents/doc-1/quiz`);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(res.status).toBe(200);
    expect(body).toEqual([
      {
        id: 'q-1',
        question: 'Which organelle releases energy?',
        choices: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi apparatus'],
        answerIndex: 2,
        explanation: 'The passage states it.',
        sourceStart: -1,
      },
    ]);
  });

  it('returns [] from quiz when no completed exam exists', async () => {
    getLatestCompletedMcq().mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/api/documents/doc-1/quiz`);
    const body = (await res.json()) as Array<unknown>;

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('deletes an exam and returns 404 when missing', async () => {
    deleteExam().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const okRes = await fetch(`${baseUrl}/api/documents/doc-1/exams/exam-1`, {
      method: 'DELETE',
    });
    const okBody = (await okRes.json()) as Record<string, unknown>;
    expect(okRes.status).toBe(200);
    expect(okBody.success).toBe(true);

    const missingRes = await fetch(`${baseUrl}/api/documents/doc-1/exams/nope`, {
      method: 'DELETE',
    });
    expect(missingRes.status).toBe(404);
  });
});
