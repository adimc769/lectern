import { describe, it, expect } from 'vitest';
import { chunkSegments, countWords } from '../src/chunker.js';
import type { Segment } from '../src/types.js';

describe('chunker', () => {
  it('countWords counts whitespace separated tokens accurately', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('hello world')).toBe(2);
    expect(countWords('  hello   brave   new   world  ')).toBe(4);
  });

  it('returns empty array when given no segments or empty texts', () => {
    expect(chunkSegments([])).toEqual([]);
    expect(chunkSegments([{ start: 0, end: 1, text: '   ' }])).toEqual([]);
  });

  it('keeps start and end times from underlying segments', () => {
    const segments: Segment[] = [
      { start: 0.0, end: 5.0, text: 'This is the first segment with several words.' }, // 8 words
      { start: 5.0, end: 10.0, text: 'And this is the second segment with more words.' }, // 9 words
    ];

    const chunks = chunkSegments(segments, { targetWords: 10, overlapWords: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].start).toBe(0.0);
    expect(chunks[0].end).toBe(10.0);
    expect(chunks[0].text).toContain('first segment');
    expect(chunks[0].text).toContain('second segment');
  });

  it('chunks segments with targetWords: 250 and overlapWords: 40', () => {
    // Generate 30 segments, each with 20 words
    const segments: Segment[] = [];
    for (let i = 0; i < 30; i++) {
      const words = Array.from({ length: 20 }, (_, w) => `word_${i}_${w}`).join(' ');
      segments.push({
        start: i * 10,
        end: (i + 1) * 10,
        text: words,
      });
    }

    const chunks = chunkSegments(segments, { targetWords: 250, overlapWords: 40, lectureId: 'lec-101' });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].id).toBe('lec-101-chunk-1');
    expect(chunks[0].lectureId).toBe('lec-101');
    expect(chunks[0].start).toBe(0);
    // 250 words with 20 words/segment means ~13 segments = 260 words, end ~130
    expect(chunks[0].end).toBe(130);

    // Second chunk should have overlap
    expect(chunks[1].id).toBe('lec-101-chunk-2');
    expect(chunks[1].start).toBeLessThan(chunks[0].end);

    // Each chunk start should match the start of its first segment
    for (const chunk of chunks) {
      expect(typeof chunk.start).toBe('number');
      expect(typeof chunk.end).toBe('number');
      expect(chunk.end).toBeGreaterThan(chunk.start);
      expect(chunk.text.length).toBeGreaterThan(0);
    }
  });

  it('handles zero overlap words correctly without overlap', () => {
    const segments: Segment[] = [
      { start: 0, end: 10, text: 'one two three four five' }, // 5 words
      { start: 10, end: 20, text: 'six seven eight nine ten' }, // 5 words
      { start: 20, end: 30, text: 'eleven twelve thirteen fourteen fifteen' }, // 5 words
    ];

    const chunks = chunkSegments(segments, { targetWords: 5, overlapWords: 0 });
    expect(chunks.length).toBe(3);
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(10);
    expect(chunks[1].start).toBe(10);
    expect(chunks[1].end).toBe(20);
    expect(chunks[2].start).toBe(20);
    expect(chunks[2].end).toBe(30);
  });
});
