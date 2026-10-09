import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  OllamaClient,
  WhisperClient,
  chunkSegments,
  summarizeLecture,
  makeFlashcards,
  extractKeyTerms,
  answerQuestion,
} from '@lectern/core';
import type { LectureRepository } from './repository.js';
import type {
  PostLecturesRequest,
  PostLecturesResponse,
  GetLecturesResponse,
  GetLectureByIdRequest,
  GetLectureByIdResponse,
  GetLectureProgressRequest,
  GetLectureProgressResponse,
  PostAskRequest,
  PostAskResponse,
  AskCitation,
} from './types.js';

export interface ServerContext {
  repository: LectureRepository;
  ollama: OllamaClient;
  whisper: WhisperClient;
  chatModel?: string;
  embedModel?: string;
  uploadsDir?: string;
}

export class RouteError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'RouteError';
  }
}

export async function runLectureProcessingJob(
  id: string,
  filePath: string,
  ctx: ServerContext,
): Promise<void> {
  try {
    // 1. Converting
    await ctx.repository.updateProgress(id, 'converting', 10);
    const wavPath = await ctx.whisper.toWav(filePath);

    // 2. Transcribing
    await ctx.repository.updateProgress(id, 'transcribing', 30);
    const segments = await ctx.whisper.transcribe(wavPath);
    const durationSec = segments.length > 0 ? segments[segments.length - 1].end : 0;
    await ctx.repository.updateLecture(id, { transcript: segments, durationSec });

    // 3. Embedding
    await ctx.repository.updateProgress(id, 'embedding', 60);
    const chunks = chunkSegments(segments, { lectureId: id });
    const embedModel = ctx.embedModel ?? 'nomic-embed-text:latest';

    for (const chunk of chunks) {
      const embedRes = await ctx.ollama.embed({
        model: embedModel,
        input: chunk.text,
      });
      chunk.embedding = embedRes.embedding;
    }
    await ctx.repository.saveChunks(chunks);

    // 4. Summarizing
    await ctx.repository.updateProgress(id, 'summarizing', 80);
    const summary = await summarizeLecture(chunks, {
      ollama: ctx.ollama,
      chatModel: ctx.chatModel ?? 'qwen2.5:7b',
    });
    await ctx.repository.updateLecture(id, { summary });

    // 5. Flashcards & Key Terms
    await ctx.repository.updateProgress(id, 'flashcards', 90);
    const flashcards = await makeFlashcards(chunks, {
      ollama: ctx.ollama,
      chatModel: ctx.chatModel ?? 'qwen2.5:7b',
    });
    const keyTerms = await extractKeyTerms(chunks, {
      ollama: ctx.ollama,
      chatModel: ctx.chatModel ?? 'qwen2.5:7b',
    });
    await ctx.repository.updateLecture(id, { flashcards, keyTerms });

    // 6. Done
    await ctx.repository.updateProgress(id, 'done', 100);
  } catch (err) {
    const readableMessage =
      err instanceof Error ? err.message : `Unknown processing error: ${String(err)}`;
    try {
      await ctx.repository.updateProgress(id, 'failed', 0, readableMessage);
    } catch {
      // Safe catch to ensure processing never crashes server
    }
  }
}

export async function handlePostLectures(
  req: PostLecturesRequest,
  ctx: ServerContext,
): Promise<PostLecturesResponse> {
  if (!req.file || req.file.length === 0) {
    throw new RouteError(400, 'No file uploaded.');
  }

  const id = `lecture-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanFilename = path.basename(req.filename || 'uploaded_lecture.wav');
  const title = req.title?.trim() || path.parse(cleanFilename).name || 'Untitled Lecture';

  const uploadsDir = ctx.uploadsDir ?? path.join(os.tmpdir(), 'lectern_uploads');
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const storedFilePath = path.join(uploadsDir, `${id}_${cleanFilename}`);
  await fs.promises.writeFile(storedFilePath, Buffer.from(req.file));

  await ctx.repository.createLecture({
    id,
    title,
    status: 'converting',
    progressPercent: 0,
    durationSec: 0,
    createdAt: new Date().toISOString(),
    transcript: [],
    summary: '',
    keyTerms: [],
    flashcards: [],
    audioFilePath: storedFilePath,
  });

  // Launch background job asynchronously if autoStart is not false
  if (req.autoStart !== false) {
    queueMicrotask(() => {
      void runLectureProcessingJob(id, storedFilePath, ctx);
    });
  }

  return { id };
}


export async function handleGetLectures(
  ctx: ServerContext,
): Promise<GetLecturesResponse> {
  const lectures = await ctx.repository.listLectures();
  return lectures.map((l) => ({
    id: l.id,
    title: l.title,
    status: l.status,
    durationSec: l.durationSec,
    createdAt: l.createdAt,
  }));
}

export async function handleGetLectureById(
  req: GetLectureByIdRequest,
  ctx: ServerContext,
): Promise<GetLectureByIdResponse> {
  const lecture = await ctx.repository.getLecture(req.id);
  if (!lecture) {
    throw new RouteError(404, `Lecture not found: ${req.id}`);
  }

  return {
    id: lecture.id,
    title: lecture.title,
    status: lecture.status,
    transcript: lecture.transcript,
    summary: lecture.summary,
    keyTerms: lecture.keyTerms,
    flashcards: lecture.flashcards,
  };
}

export async function handleGetLectureProgress(
  req: GetLectureProgressRequest,
  ctx: ServerContext,
): Promise<GetLectureProgressResponse> {
  const lecture = await ctx.repository.getLecture(req.id);
  if (!lecture) {
    throw new RouteError(404, `Lecture not found: ${req.id}`);
  }

  return {
    status: lecture.status,
    percent: lecture.progressPercent,
    ...(lecture.errorMessage ? { error: lecture.errorMessage } : {}),
  };
}

export async function handlePostAsk(
  req: PostAskRequest,
  ctx: ServerContext,
): Promise<PostAskResponse> {
  const question = req.question?.trim();
  if (!question) {
    throw new RouteError(400, 'Question must not be empty.');
  }

  const allChunks = await ctx.repository.getAllChunks();

  const answerResult = await answerQuestion(question, allChunks, {
    ollama: ctx.ollama,
    chatModel: ctx.chatModel ?? 'qwen2.5:7b',
    embedModel: ctx.embedModel ?? 'nomic-embed-text:latest',
  });

  const titlesCache = new Map<string, string>();
  const citations: AskCitation[] = [];

  for (const c of answerResult.citations) {
    let lectureTitle = titlesCache.get(c.lectureId);
    if (!lectureTitle) {
      const lecture = await ctx.repository.getLecture(c.lectureId);
      lectureTitle = lecture ? lecture.title : c.lectureTitle || c.lectureId;
      titlesCache.set(c.lectureId, lectureTitle);
    }
    citations.push({
      lectureId: c.lectureId,
      lectureTitle,
      start: c.start,
    });
  }

  return {
    answer: answerResult.answer,
    citations,
  };
}
