import { describe, it, expect, vi } from 'vitest';
import {
  summarizeLecture,
  extractKeyTerms,
  makeFlashcards,
  answerQuestion,
  groupChunksIntoSections,
} from '../src/pipeline.js';
import { OllamaClient } from '../src/ollama.js';
import type { Chunk } from '../src/types.js';
import { NOT_COVERED_RESPONSE } from '../src/prompts.js';

describe('pipeline', () => {
  describe('groupChunksIntoSections', () => {
    it('groups chunks into sections by word budget', () => {
      const chunks: Chunk[] = [
        { id: 'c1', lectureId: 'l1', start: 0, end: 10, text: 'one two three' }, // 3 words
        { id: 'c2', lectureId: 'l1', start: 10, end: 20, text: 'four five six' }, // 3 words
        { id: 'c3', lectureId: 'l1', start: 20, end: 30, text: 'seven eight nine ten' }, // 4 words
      ];
      // Target 5 words per section
      const sections = groupChunksIntoSections(chunks, 5);
      expect(sections.length).toBe(2);
      expect(sections[0]).toContain('one two three\n\nfour five six');
      expect(sections[1]).toContain('seven eight nine ten');
    });
  });

  describe('summarizeLecture', () => {
    it('summarizes a single section lecture directly', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        message: { role: 'assistant', content: 'Single section summary.' },
      });
      const client = { chat: mockChat } as unknown as OllamaClient;

      const chunks: Chunk[] = [
        { id: 'c1', lectureId: 'l1', start: 0, end: 10, text: 'Short lecture about arrays.' },
      ];

      const summary = await summarizeLecture(chunks, {
        ollama: client,
        chatModel: 'test-model',
      });

      expect(mockChat).toHaveBeenCalledTimes(1);
      expect(summary).toBe('Single section summary.');
    });

    it('runs map-reduce summarization on multi-section lectures', async () => {
      const mockChat = vi.fn().mockImplementation(async (params: { messages: Array<{ content: string }> }) => {
        const lastMsg = params.messages[params.messages.length - 1].content;
        if (lastMsg.includes('Synthesize these lecture section summaries')) {
          return { message: { role: 'assistant', content: 'Final combined synthesis.' } };
        }
        return { message: { role: 'assistant', content: 'Section summary.' } };
      });

      const client = { chat: mockChat } as unknown as OllamaClient;

      // Create chunks that exceed targetWords: 10
      const chunks: Chunk[] = [
        { id: 'c1', lectureId: 'l1', start: 0, end: 10, text: 'word '.repeat(8) },
        { id: 'c2', lectureId: 'l1', start: 10, end: 20, text: 'word '.repeat(8) },
        { id: 'c3', lectureId: 'l1', start: 20, end: 30, text: 'word '.repeat(8) },
      ];

      const summary = await summarizeLecture(chunks, {
        ollama: client,
        maxSectionWords: 7,
      });


      // 3 sections mapped + 1 reduce = 4 calls
      expect(mockChat).toHaveBeenCalledTimes(4);
      expect(summary).toBe('Final combined synthesis.');
    });

    it('returns empty string for empty chunks', async () => {
      expect(await summarizeLecture([])).toBe('');
    });
  });

  describe('extractKeyTerms', () => {
    it('extracts key terms from JSON response including markdown fences', async () => {
      const mockChat = vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: '```json\n{"keyTerms": [{"term": "Array", "definition": "Linear collection"}, {"term": "Array", "definition": "Duplicate"}]}\n```',
        },
      });
      const client = { chat: mockChat } as unknown as OllamaClient;

      const terms = await extractKeyTerms('text about arrays', { ollama: client });
      // Should deduplicate 'Array'
      expect(terms).toHaveLength(1);
      expect(terms[0].term).toBe('Array');
      expect(terms[0].definition).toBe('Linear collection');
    });

    it('returns empty array on empty input', async () => {
      expect(await extractKeyTerms('')).toEqual([]);
    });
  });

  describe('makeFlashcards', () => {
    it('extracts flashcards, enforces deduplication and max 12 items', async () => {
      const cards = Array.from({ length: 15 }, (_, i) => ({
        question: `Question ${i + 1}`,
        answer: `Answer ${i + 1}`,
      }));

      const mockChat = vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: JSON.stringify({ flashcards: cards }),
        },
      });
      const client = { chat: mockChat } as unknown as OllamaClient;

      const result = await makeFlashcards('text', { ollama: client });
      expect(result).toHaveLength(12);
      expect(result[0].question).toBe('Question 1');
      expect(result[11].question).toBe('Question 12');
    });
  });

  describe('answerQuestion', () => {
    const chunks: Chunk[] = [
      {
        id: 'c1',
        lectureId: 'lecture-1',
        start: 10,
        end: 25,
        text: 'A binary tree has at most two children per node.',
        embedding: [0.9, 0.1],
      },
      {
        id: 'c2',
        lectureId: 'lecture-1',
        start: 30,
        end: 50,
        text: 'A hash table offers O(1) average lookup time.',
        embedding: [0.1, 0.9],
      },
    ];

    it('embeds question, retrieves top chunks, and returns cited answer', async () => {
      const mockEmbed = vi.fn().mockResolvedValue({ embedding: [0.9, 0.1] });
      const mockChat = vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'A binary tree has at most two children per node [Lecture 1, 00:10].',
        },
      });

      const client = { embed: mockEmbed, chat: mockChat } as unknown as OllamaClient;

      const res = await answerQuestion('What is a binary tree?', chunks, {
        ollama: client,
        topK: 1,
      });

      expect(mockEmbed).toHaveBeenCalledWith(expect.objectContaining({ input: 'What is a binary tree?' }));
      expect(mockChat).toHaveBeenCalledTimes(1);
      expect(res.answer).toContain('two children per node');
      expect(res.citations).toHaveLength(1);
      expect(res.citations[0].chunkId).toBe('c1');
      expect(res.citations[0].lectureId).toBe('lecture-1');
      expect(res.citations[0].start).toBe(10);
    });

    it('returns exact fallback when model answers not covered', async () => {
      const mockEmbed = vi.fn().mockResolvedValue({ embedding: [0.5, 0.5] });
      const mockChat = vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'Not covered in your lectures.',
        },
      });

      const client = { embed: mockEmbed, chat: mockChat } as unknown as OllamaClient;

      const res = await answerQuestion('Who was the 16th president of the US?', chunks, {
        ollama: client,
      });

      expect(res.answer).toBe(NOT_COVERED_RESPONSE);
      expect(res.citations).toEqual([]);
    });

    it('returns not covered immediately when chunks array is empty', async () => {
      const res = await answerQuestion('Any question', []);
      expect(res.answer).toBe(NOT_COVERED_RESPONSE);
      expect(res.citations).toEqual([]);
    });
  });
});
