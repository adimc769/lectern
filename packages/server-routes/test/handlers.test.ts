import { describe, it, expect, vi } from 'vitest';
import {
  handlePostLectures,
  handleGetLectures,
  handleGetLectureById,
  handleGetLectureProgress,
  handlePostAsk,
  runLectureProcessingJob,
  RouteError,
  type ServerContext,
} from '../src/handlers.js';
import { SqliteLectureRepository, InMemoryLectureRepository } from '../src/sqlite-repository.js';
import type { OllamaClient, WhisperClient } from '@lectern/core';

describe('Server Routes Handlers', () => {
  function createMockContext(repo = new InMemoryLectureRepository()): {
    ctx: ServerContext;
    mockOllama: { chat: ReturnType<typeof vi.fn>; embed: ReturnType<typeof vi.fn> };
    mockWhisper: { toWav: ReturnType<typeof vi.fn>; transcribe: ReturnType<typeof vi.fn> };
  } {
    const mockWhisper = {
      toWav: vi.fn().mockResolvedValue('/tmp/converted.wav'),
      transcribe: vi.fn().mockResolvedValue([
        { start: 0, end: 10, text: 'Hello world, this is a lecture on trees.' },
        { start: 10, end: 20, text: 'A tree has nodes and edges.' },
      ]),
    };

    const mockOllama = {
      embed: vi.fn().mockResolvedValue({
        embedding: [0.1, 0.2, 0.3],
        embeddings: [[0.1, 0.2, 0.3]],
      }),
      chat: vi.fn().mockImplementation(async (params: { format?: unknown; messages?: Array<{ content: string }> }) => {
        if (params.format) {
          // Key terms or flashcards
          return {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                keyTerms: [{ term: 'Tree', definition: 'A hierarchical data structure' }],
                flashcards: [{ question: 'What is a tree?', answer: 'A hierarchical data structure.' }],
              }),
            },
          };
        }
        return {
          message: {
            role: 'assistant',
            content: 'Trees are hierarchical structures [Lecture 1, 00:00].',
          },
        };
      }),
    };

    const ctx: ServerContext = {
      repository: repo,
      ollama: mockOllama as unknown as OllamaClient,
      whisper: mockWhisper as unknown as WhisperClient,
      chatModel: 'test-chat',
      embedModel: 'test-embed',
    };

    return { ctx, mockOllama, mockWhisper };
  }

  it('POST /lectures saves upload and returns lecture id', async () => {
    const { ctx } = createMockContext();
    const req = {
      file: Buffer.from('RIFF mock audio data'),
      filename: 'sample_lecture.mp3',
      title: 'Sample Lecture',
    };

    const res = await handlePostLectures(req, ctx);
    expect(res.id).toMatch(/^lecture-/);

    const progress = await handleGetLectureProgress({ id: res.id }, ctx);
    expect(progress.status).toBe('converting');
  });

  it('runs background processing job through all states: converting -> transcribing -> embedding -> summarizing -> flashcards -> done', async () => {
    const { ctx, mockWhisper, mockOllama } = createMockContext();
    const req = {
      file: Buffer.from('mock audio'),
      filename: 'trees.wav',
      title: 'Trees Lecture',
      autoStart: false,
    };


    const res = await handlePostLectures(req, ctx);
    const lectureId = res.id;

    // Run the background processing job directly to await completion
    await runLectureProcessingJob(lectureId, '/mock/path/trees.wav', ctx);

    expect(mockWhisper.toWav).toHaveBeenCalledTimes(1);
    expect(mockWhisper.transcribe).toHaveBeenCalledTimes(1);
    expect(mockOllama.embed).toHaveBeenCalled();
    expect(mockOllama.chat).toHaveBeenCalled();

    // Verify final state is done with 100%
    const progress = await handleGetLectureProgress({ id: lectureId }, ctx);
    expect(progress.status).toBe('done');
    expect(progress.percent).toBe(100);

    // Verify GET /lectures/:id
    const full = await handleGetLectureById({ id: lectureId }, ctx);
    expect(full.title).toBe('Trees Lecture');
    expect(full.status).toBe('done');
    expect(full.transcript).toHaveLength(2);
    expect(full.summary).toBeTruthy();
    expect(full.keyTerms.length).toBeGreaterThan(0);
    expect(full.flashcards.length).toBeGreaterThan(0);
  });

  it('GET /lectures returns list of lecture summaries', async () => {
    const { ctx } = createMockContext();
    await handlePostLectures(
      { file: Buffer.from('data1'), filename: 'lec1.wav', title: 'Lec 1' },
      ctx,
    );
    await handlePostLectures(
      { file: Buffer.from('data2'), filename: 'lec2.wav', title: 'Lec 2' },
      ctx,
    );

    const list = await handleGetLectures(ctx);
    expect(list.length).toBe(2);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('title');
    expect(list[0]).toHaveProperty('status');
    expect(list[0]).toHaveProperty('durationSec');
    expect(list[0]).toHaveProperty('createdAt');
  });

  it('GET /lectures/:id throws 404 for unknown lecture', async () => {
    const { ctx } = createMockContext();
    await expect(handleGetLectureById({ id: 'nonexistent' }, ctx)).rejects.toThrowError(
      RouteError,
    );
  });

  it('POST /ask queries chunks and returns answer with citations', async () => {
    const { ctx } = createMockContext();

    // Setup a lecture and chunk
    await ctx.repository.createLecture({
      id: 'lecture-1',
      title: 'Intro to Trees',
      status: 'done',
      progressPercent: 100,
      durationSec: 20,
      createdAt: new Date().toISOString(),
      transcript: [{ start: 0, end: 10, text: 'Trees have nodes and leaves.' }],
      summary: 'Summary of trees.',
      keyTerms: [],
      flashcards: [],
    });

    await ctx.repository.saveChunks([
      {
        id: 'chunk-1',
        lectureId: 'lecture-1',
        start: 0,
        end: 10,
        text: 'Trees have nodes and leaves.',
        embedding: [0.1, 0.2, 0.3],
      },
    ]);

    const res = await handlePostAsk({ question: 'What is a tree?' }, ctx);
    expect(res.answer).toContain('Trees are hierarchical structures');
    expect(res.citations.length).toBeGreaterThan(0);
    expect(res.citations[0].lectureId).toBe('lecture-1');
    expect(res.citations[0].lectureTitle).toBe('Intro to Trees');
  });

  it('records failure with readable message in repository without crashing when a step fails', async () => {
    const { ctx, mockWhisper } = createMockContext();
    mockWhisper.transcribe.mockRejectedValueOnce(new Error('Whisper server out of memory'));

    const res = await handlePostLectures(
      { file: Buffer.from('data'), filename: 'crash.wav', autoStart: false },
      ctx,
    );

    await runLectureProcessingJob(res.id, '/mock/crash.wav', ctx);

    const progress = await handleGetLectureProgress({ id: res.id }, ctx);
    expect(progress.status).toBe('failed');
    expect(progress.percent).toBe(0);
    expect(progress.error).toContain('Whisper server out of memory');
  });

  it('works with SqliteLectureRepository', async () => {
    const sqliteRepo = new SqliteLectureRepository(':memory:');
    const { ctx } = createMockContext(sqliteRepo);

    const res = await handlePostLectures(
      { file: Buffer.from('sqlite test'), filename: 'sqlite.wav', title: 'SQLite Test', autoStart: false },
      ctx,
    );

    await runLectureProcessingJob(res.id, '/mock/sqlite.wav', ctx);


    const full = await handleGetLectureById({ id: res.id }, ctx);
    expect(full.title).toBe('SQLite Test');
    expect(full.status).toBe('done');
    expect(full.transcript).toHaveLength(2);

    const all = await handleGetLectures(ctx);
    expect(all).toHaveLength(1);

    sqliteRepo.close();
  });

  it('automatically processes lecture when autoStart is enabled', async () => {
    const { ctx } = createMockContext();
    const res = await handlePostLectures(
      { file: Buffer.from('auto data'), filename: 'auto.wav', title: 'Auto Lecture' },
      ctx,
    );

    // Wait for microtasks / async job to finish
    let attempts = 0;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 20));
      const prog = await handleGetLectureProgress({ id: res.id }, ctx);
      if (prog.status === 'done' || prog.status === 'failed') break;
      attempts++;
    }

    const finalProg = await handleGetLectureProgress({ id: res.id }, ctx);
    expect(finalProg.status).toBe('done');
    expect(finalProg.percent).toBe(100);
  });
});

