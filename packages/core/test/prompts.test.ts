import { describe, it, expect } from 'vitest';
import { keyTermsSchema, flashcardsSchema } from '../src/schemas.js';
import {
  formatTimestamp,
  sectionSummaryMessages,
  combineSummariesMessages,
  keyTermsMessages,
  flashcardsMessages,
  citedQAMessages,
  NOT_COVERED_RESPONSE,
} from '../src/prompts.js';

describe('schemas and prompts', () => {
  it('validates keyTermsSchema structure', () => {
    expect(keyTermsSchema.type).toBe('object');
    expect(keyTermsSchema.required).toContain('keyTerms');
    expect(keyTermsSchema.properties.keyTerms.type).toBe('array');
    expect(keyTermsSchema.properties.keyTerms.items.required).toContain('term');
    expect(keyTermsSchema.properties.keyTerms.items.required).toContain('definition');
  });

  it('validates flashcardsSchema structure', () => {
    expect(flashcardsSchema.type).toBe('object');
    expect(flashcardsSchema.required).toContain('flashcards');
    expect(flashcardsSchema.properties.flashcards.type).toBe('array');
    expect(flashcardsSchema.properties.flashcards.items.required).toContain('question');
    expect(flashcardsSchema.properties.flashcards.items.required).toContain('answer');
  });

  it('formats timestamp as mm:ss', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(9)).toBe('00:09');
    expect(formatTimestamp(65)).toBe('01:05');
    expect(formatTimestamp(125.8)).toBe('02:05');
    expect(formatTimestamp(900)).toBe('15:00');
  });

  it('generates section summary prompt', () => {
    const msgs = sectionSummaryMessages('Binary search trees maintain sorted order.');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].content).toContain('Binary search trees maintain sorted order.');
  });

  it('generates combine summaries prompt', () => {
    const msgs = combineSummariesMessages(['Part 1 summary', 'Part 2 summary']);
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toContain('Section 1:');
    expect(msgs[1].content).toContain('Part 1 summary');
    expect(msgs[1].content).toContain('Section 2:');
    expect(msgs[1].content).toContain('Part 2 summary');
  });

  it('generates key terms prompt', () => {
    const msgs = keyTermsMessages('Today we discuss mutex and semaphores.');
    expect(msgs).toHaveLength(2);
    expect(msgs[1].content).toContain('mutex and semaphores');
  });

  it('generates flashcards prompt with constraints', () => {
    const msgs = flashcardsMessages('Today we discuss hash tables.');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toContain('12 cards');
    expect(msgs[0].content).toContain('25 words');
  });

  it('generates cited Q&A prompt with citations and fallback rule', () => {
    const msgs = citedQAMessages('What is a page table?', [
      {
        lectureId: 'lecture-2',
        lectureTitle: 'Intro to OS',
        start: 125,
        text: 'A page table translates virtual page numbers to physical frame numbers.',
      },
    ]);

    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toContain('Answer ONLY from the numbered sources');
    expect(msgs[0].content).toContain('[Lecture N, mm:ss]');
    expect(msgs[0].content).toContain(NOT_COVERED_RESPONSE);

    expect(msgs[1].content).toContain('[Lecture 2, 02:05]');
    expect(msgs[1].content).toContain('A page table translates virtual page numbers');
  });
});
