import type { Chunk, Flashcard, KeyTerm, Citation } from './types.js';
import { OllamaClient, defaultOllamaClient } from './ollama.js';
import { countWords } from './chunker.js';
import { topK } from './vector.js';
import { keyTermsSchema, flashcardsSchema } from './schemas.js';
import {
  sectionSummaryMessages,
  combineSummariesMessages,
  keyTermsMessages,
  flashcardsMessages,
  citedQAMessages,
  NOT_COVERED_RESPONSE,
} from './prompts.js';

export interface PipelineOptions {
  ollama?: OllamaClient;
  chatModel?: string;
  embedModel?: string;
  maxSectionWords?: number;
  topK?: number;
}

export interface AnswerResult {
  answer: string;
  citations: Citation[];
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  const trimmed = text.trim();
  // Strip markdown code fences if present (e.g. ```json ... ```)
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Attempt extracting between outermost { and }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1)) as T;
      } catch {
        // continue
      }
    }
    return fallback;
  }
}

export function groupChunksIntoSections(chunks: Chunk[], targetWords = 1500): string[] {
  if (chunks.length === 0) return [];
  const sections: string[] = [];
  let currentWords = 0;
  let currentTexts: string[] = [];

  for (const chunk of chunks) {
    const words = countWords(chunk.text);
    currentTexts.push(chunk.text);
    currentWords += words;

    if (currentWords >= targetWords) {
      sections.push(currentTexts.join('\n\n'));
      currentTexts = [];
      currentWords = 0;
    }
  }

  if (currentTexts.length > 0) {
    sections.push(currentTexts.join('\n\n'));
  }

  return sections;
}


export async function summarizeLecture(
  chunks: Chunk[],
  options: PipelineOptions = {},
): Promise<string> {
  if (chunks.length === 0) {
    return '';
  }

  const ollama = options.ollama ?? defaultOllamaClient;
  const chatModel = options.chatModel ?? 'qwen2.5:7b';
  const maxWords = options.maxSectionWords ?? 1500;

  const sections = groupChunksIntoSections(chunks, maxWords);

  if (sections.length === 0) {
    return '';
  }

  if (sections.length === 1) {
    const res = await ollama.chat({
      model: chatModel,
      messages: sectionSummaryMessages(sections[0]),
    });
    return res.message.content.trim();
  }

  // Map step: summarize each section
  const sectionSummaries: string[] = [];
  for (const section of sections) {
    const res = await ollama.chat({
      model: chatModel,
      messages: sectionSummaryMessages(section),
    });
    sectionSummaries.push(res.message.content.trim());
  }

  // Reduce step: combine all section summaries
  const combinedRes = await ollama.chat({
    model: chatModel,
    messages: combineSummariesMessages(sectionSummaries),
  });

  return combinedRes.message.content.trim();
}

export async function extractKeyTerms(
  chunksOrText: Chunk[] | string,
  options: PipelineOptions = {},
): Promise<KeyTerm[]> {
  const fullText = Array.isArray(chunksOrText)
    ? chunksOrText.map((c) => c.text).join('\n\n')
    : chunksOrText;

  if (!fullText.trim()) {
    return [];
  }

  const ollama = options.ollama ?? defaultOllamaClient;
  const chatModel = options.chatModel ?? 'qwen2.5:7b';

  const res = await ollama.chat({
    model: chatModel,
    messages: keyTermsMessages(fullText),
    format: keyTermsSchema as unknown as Record<string, unknown>,
  });

  interface RawKeyTerms {
    keyTerms?: Array<{ term?: string; definition?: string }>;
  }

  const parsed = parseJsonSafe<RawKeyTerms>(res.message.content, {});
  const list = parsed.keyTerms ?? [];

  const keyTerms: KeyTerm[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    const term = (item.term ?? '').trim();
    const definition = (item.definition ?? '').trim();
    if (term && definition && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      keyTerms.push({ term, definition });
    }
  }

  return keyTerms;
}

export async function makeFlashcards(
  chunksOrText: Chunk[] | string,
  options: PipelineOptions = {},
): Promise<Flashcard[]> {
  const fullText = Array.isArray(chunksOrText)
    ? chunksOrText.map((c) => c.text).join('\n\n')
    : chunksOrText;

  if (!fullText.trim()) {
    return [];
  }

  const ollama = options.ollama ?? defaultOllamaClient;
  const chatModel = options.chatModel ?? 'qwen2.5:7b';

  const res = await ollama.chat({
    model: chatModel,
    messages: flashcardsMessages(fullText),
    format: flashcardsSchema as unknown as Record<string, unknown>,
  });

  interface RawFlashcards {
    flashcards?: Array<{ question?: string; answer?: string }>;
  }

  const parsed = parseJsonSafe<RawFlashcards>(res.message.content, {});
  const list = parsed.flashcards ?? [];

  const flashcards: Flashcard[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    const question = (item.question ?? '').trim();
    const answer = (item.answer ?? '').trim();
    if (question && answer && !seen.has(question.toLowerCase())) {
      seen.add(question.toLowerCase());
      flashcards.push({ question, answer });
      if (flashcards.length >= 12) {
        break;
      }
    }
  }

  return flashcards;
}

export async function answerQuestion(
  question: string,
  allChunks: Chunk[],
  options: PipelineOptions = {},
): Promise<AnswerResult> {
  const ollama = options.ollama ?? defaultOllamaClient;
  const chatModel = options.chatModel ?? 'qwen2.5:7b';
  const embedModel = options.embedModel ?? 'nomic-embed-text:latest';
  const k = options.topK ?? 6;

  if (allChunks.length === 0) {
    return {
      answer: NOT_COVERED_RESPONSE,
      citations: [],
    };
  }

  // 1. Embed query
  const queryEmbedRes = await ollama.embed({
    model: embedModel,
    input: question,
  });
  const queryEmbedding = queryEmbedRes.embedding;

  // 2. Retrieve top K chunks
  const topChunks = topK(queryEmbedding, allChunks, k);

  if (topChunks.length === 0) {
    return {
      answer: NOT_COVERED_RESPONSE,
      citations: [],
    };
  }

  // 3. Prepare messages for LLM
  const sources = topChunks.map((c) => ({
    lectureId: c.lectureId,
    chunkId: c.id,
    start: c.start,
    text: c.text,
  }));

  const messages = citedQAMessages(question, sources);

  // 4. Call chat LLM
  const chatRes = await ollama.chat({
    model: chatModel,
    messages,
  });

  const rawAnswer = chatRes.message.content.trim();

  // 5. If model states not covered, strictly return NOT_COVERED_RESPONSE with empty citations
  const lower = rawAnswer.toLowerCase();
  if (
    rawAnswer === NOT_COVERED_RESPONSE ||
    lower === 'not covered in your lectures.' ||
    lower === 'not covered in your lectures' ||
    lower.startsWith('not covered in your lectures')
  ) {
    return {
      answer: NOT_COVERED_RESPONSE,
      citations: [],
    };
  }

  // 6. Map citations from retrieved chunks
  const citations: Citation[] = topChunks.map((c) => ({
    lectureId: c.lectureId,
    lectureTitle: c.lectureId,
    chunkId: c.id,
    start: c.start,
  }));

  return {
    answer: rawAnswer,
    citations,
  };
}
