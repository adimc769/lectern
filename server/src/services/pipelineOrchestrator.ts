import path from 'path';
import { CONFIG } from '../config.js';
import { prisma } from '../db.js';
import { audioService } from './audioService.js';
import { whisperService } from './whisperService.js';
import { chunkingService } from './chunkingService.js';
import { embeddingService } from './embeddingService.js';
import type { JobProgressDTO, PipelineStage, ChunkDTO } from '@lectern/shared';

export class PipelineOrchestrator {
  private progressMap = new Map<string, JobProgressDTO>();

  /**
   * Returns current progress for a given lecture.
   */
  async getProgress(lectureId: string): Promise<JobProgressDTO> {
    const memory = this.progressMap.get(lectureId);
    if (memory) {
      return memory;
    }

    const lecture = await prisma.lecture.findUnique({ where: { id: lectureId } });
    if (!lecture) {
      return {
        lectureId,
        stage: 'IDLE',
        progressPercent: 0,
        message: 'Lecture not found',
      };
    }

    if (lecture.status === 'COMPLETED') {
      return {
        lectureId,
        stage: 'COMPLETED',
        progressPercent: 100,
        message: 'Lecture processing completed successfully',
      };
    }

    if (lecture.status === 'FAILED') {
      return {
        lectureId,
        stage: 'FAILED',
        progressPercent: 0,
        message: 'Processing failed',
      };
    }

    return {
      lectureId,
      stage: 'PROCESSING' as PipelineStage,
      progressPercent: 50,
      message: 'Processing in progress',
    };
  }

  private updateProgress(
    lectureId: string,
    stage: PipelineStage,
    progressPercent: number,
    message: string,
    error?: string,
  ): void {
    const dto: JobProgressDTO = {
      lectureId,
      stage,
      progressPercent,
      message,
      ...(error ? { error } : {}),
    };
    this.progressMap.set(lectureId, dto);
  }

  /**
   * Map-reduce summarization with Ollama.
   */
  private async summarizeLectureWithOllama(chunks: ChunkDTO[]): Promise<string> {
    if (chunks.length === 0) return '';

    const model = CONFIG.OLLAMA_LLM_MODEL;
    const url = `${CONFIG.OLLAMA_BASE_URL}/api/chat`;

    // Group chunks into ~1500-word sections
    const sections: string[] = [];
    let currentWords = 0;
    let currentTexts: string[] = [];

    for (const c of chunks) {
      const words = c.text.trim().split(/\s+/).filter(Boolean).length;
      currentTexts.push(c.text);
      currentWords += words;

      if (currentWords >= 1500) {
        sections.push(currentTexts.join('\n\n'));
        currentTexts = [];
        currentWords = 0;
      }
    }
    if (currentTexts.length > 0) {
      sections.push(currentTexts.join('\n\n'));
    }

    if (sections.length === 1) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert lecture summarizer. Provide a dense, accurate summary of the lecture excerpt. Capture all key technical concepts, core definitions, and main takeaways.',
            },
            {
              role: 'user',
              content: `Please summarize this lecture excerpt:\n\n${sections[0]}`,
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        throw new Error(`Ollama summary error (${res.status})`);
      }

      interface ChatRes {
        message: { content: string };
      }
      const data = (await res.json()) as ChatRes;
      return data.message.content.trim();
    }

    // Map step: summarize each section
    const sectionSummaries: string[] = [];
    for (const [idx, sec] of sections.entries()) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `Summarize section ${idx + 1} of the lecture accurately and concisely.`,
            },
            {
              role: 'user',
              content: sec,
            },
          ],
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (res.ok) {
        interface ChatRes {
          message: { content: string };
        }
        const data = (await res.json()) as ChatRes;
        sectionSummaries.push(data.message.content.trim());
      }
    }

    // Reduce step: combine section summaries
    const combinedInput = sectionSummaries
      .map((s, idx) => `Section ${idx + 1}:\n${s}`)
      .join('\n\n');

    const reduceRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Synthesize these lecture section summaries into a single cohesive, high-quality overall summary with main topics, mechanisms, and key takeaways.',
          },
          {
            role: 'user',
            content: `Synthesize these lecture section summaries:\n\n${combinedInput}`,
          },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!reduceRes.ok) {
      return sectionSummaries.join('\n\n');
    }

    interface ChatRes {
      message: { content: string };
    }
    const data = (await reduceRes.json()) as ChatRes;
    return data.message.content.trim();
  }

  /**
   * Extracts flashcards and key terms using Ollama structured JSON.
   */
  private async extractStudyAids(
    chunks: ChunkDTO[],
    lectureId: string,
  ): Promise<void> {
    if (chunks.length === 0) return;

    const fullText = chunks.map((c) => c.text).join('\n\n');
    const model = CONFIG.OLLAMA_LLM_MODEL;
    const url = `${CONFIG.OLLAMA_BASE_URL}/api/chat`;

    // 1. Flashcards
    try {
      const flashcardsRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Create up to 12 study flashcards from the lecture. Return a JSON object with a "flashcards" array containing { "front": "question", "back": "answer" }. Answers must be strictly under 25 words.',
            },
            { role: 'user', content: fullText },
          ],
          format: 'json',
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (flashcardsRes.ok) {
        interface FlashcardJson {
          flashcards?: Array<{ front?: string; back?: string; question?: string; answer?: string }>;
        }
        const data = (await flashcardsRes.json()) as { message: { content: string } };
        const parsed = JSON.parse(data.message.content) as FlashcardJson;
        const list = parsed.flashcards || [];

        await prisma.flashcard.deleteMany({ where: { lectureId } });
        for (const item of list.slice(0, 12)) {
          const front = (item.front || item.question || '').trim();
          const back = (item.back || item.answer || '').trim();
          if (front && back) {
            await prisma.flashcard.create({
              data: { lectureId, front, back },
            });
          }
        }
      }
    } catch {
      // Continue even if flashcard extraction fails
    }

    // 2. Key Terms
    try {
      const termsRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'Extract key technical terms and concepts with clear definitions. Return a JSON object with a "keyTerms" array containing { "term": "...", "definition": "..." }.',
            },
            { role: 'user', content: fullText },
          ],
          format: 'json',
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (termsRes.ok) {
        interface KeyTermsJson {
          keyTerms?: Array<{ term?: string; definition?: string }>;
        }
        const data = (await termsRes.json()) as { message: { content: string } };
        const parsed = JSON.parse(data.message.content) as KeyTermsJson;
        const list = parsed.keyTerms || [];

        await prisma.keyTerm.deleteMany({ where: { lectureId } });
        for (const item of list.slice(0, 15)) {
          const term = (item.term || '').trim();
          const definition = (item.definition || '').trim();
          if (term && definition) {
            await prisma.keyTerm.create({
              data: { lectureId, term, definition },
            });
          }
        }
      }
    } catch {
      // Continue
    }
  }

  /**
   * Coordinates the full background pipeline. Never throws unhandled errors.
   */
  async runPipeline(lectureId: string, inputAudioPath: string): Promise<void> {
    try {
      await prisma.lecture.update({
        where: { id: lectureId },
        data: { status: 'PROCESSING' },
      });

      // Stage 1: Converting Audio
      this.updateProgress(lectureId, 'CONVERTING_AUDIO', 15, 'Converting audio to 16kHz mono WAV');
      const wavPath = await audioService.convertToWav(inputAudioPath);

      // Stage 2: Transcribing
      this.updateProgress(lectureId, 'TRANSCRIBING', 35, 'Running whisper-cli on GPU');
      const segments = await whisperService.transcribe(wavPath, lectureId);

      const duration = segments.length > 0 ? segments[segments.length - 1].endTime : 0;
      await prisma.lecture.update({
        where: { id: lectureId },
        data: { duration },
      });

      // Stage 3: Chunking
      this.updateProgress(lectureId, 'CHUNKING', 55, 'Chunking transcript with overlap');
      const chunks = chunkingService.chunkSegments(segments, lectureId);

      // Stage 4: Generating Embeddings
      this.updateProgress(lectureId, 'GENERATING_EMBEDDINGS', 75, 'Generating nomic-embed-text embeddings');
      await embeddingService.generateAndSaveEmbeddings(chunks, lectureId);

      // Stage 5: Summarizing
      this.updateProgress(lectureId, 'SUMMARIZING', 85, 'Running map-reduce summarization with Ollama');
      let summary = '';
      try {
        summary = await this.summarizeLectureWithOllama(chunks);
        await prisma.lecture.update({
          where: { id: lectureId },
          data: { summary },
        });
      } catch (sumErr) {
        console.warn(`[Pipeline] Summarization warning for ${lectureId}:`, sumErr);
      }

      // Stage 6: Extracting Study Aids (Flashcards + Key Terms)
      this.updateProgress(lectureId, 'EXTRACTING_CARDS', 95, 'Extracting flashcards and key terms');
      await this.extractStudyAids(chunks, lectureId);

      // Stage 7: Completed
      await prisma.lecture.update({
        where: { id: lectureId },
        data: { status: 'COMPLETED' },
      });

      this.updateProgress(lectureId, 'COMPLETED', 100, 'Processing completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Pipeline Error] Lecture ${lectureId} failed:`, errorMsg);

      await prisma.lecture.update({
        where: { id: lectureId },
        data: { status: 'FAILED' },
      }).catch(() => {});

      this.updateProgress(lectureId, 'FAILED', 0, 'Processing failed', errorMsg);
    }
  }

  /**
   * Starts pipeline asynchronously in the background.
   */
  startPipeline(lectureId: string, inputAudioPath: string): void {
    queueMicrotask(() => {
      void this.runPipeline(lectureId, inputAudioPath);
    });
  }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
