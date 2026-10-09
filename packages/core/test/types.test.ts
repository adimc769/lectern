import { describe, it, expect } from 'vitest';
import type { Segment, Chunk, Flashcard, KeyTerm, Citation } from '../src/types.js';

describe('Core Types', () => {
  it('creates valid Segment, Chunk, Flashcard, KeyTerm, Citation objects', () => {
    const segment: Segment = {
      start: 0.5,
      end: 4.2,
      text: 'Hello world',
    };
    expect(segment.start).toBe(0.5);
    expect(segment.end).toBe(4.2);
    expect(segment.text).toBe('Hello world');

    const chunk: Chunk = {
      id: 'chunk-1',
      lectureId: 'lecture-1',
      start: 0,
      end: 10,
      text: 'Chunk content',
      embedding: [0.1, 0.2, 0.3],
    };
    expect(chunk.id).toBe('chunk-1');
    expect(chunk.embedding).toHaveLength(3);

    const flashcard: Flashcard = {
      question: 'What is a stack?',
      answer: 'A LIFO data structure.',
    };
    expect(flashcard.question).toBeTruthy();
    expect(flashcard.answer).toBeTruthy();

    const keyTerm: KeyTerm = {
      term: 'Stack',
      definition: 'A linear data structure following Last-In-First-Out.',
    };
    expect(keyTerm.term).toBe('Stack');

    const citation: Citation = {
      lectureId: 'lecture-1',
      lectureTitle: 'Intro to Data Structures',
      chunkId: 'chunk-1',
      start: 0,
    };
    expect(citation.lectureTitle).toBe('Intro to Data Structures');
  });
});
