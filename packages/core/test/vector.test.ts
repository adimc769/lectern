import { describe, it, expect } from 'vitest';
import { cosine, topK } from '../src/vector.js';
import type { Chunk } from '../src/types.js';

describe('vector operations', () => {
  describe('cosine', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(cosine(a, b)).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(cosine(a, b)).toBeCloseTo(0.0, 5);
    });

    it('returns -1 for opposite vectors', () => {
      const a = [2, 0];
      const b = [-2, 0];
      expect(cosine(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for zero vectors or empty arrays or mismatched lengths', () => {
      expect(cosine([0, 0], [1, 2])).toBe(0);
      expect(cosine([], [1, 2])).toBe(0);
      expect(cosine([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('topK', () => {
    const chunks: Chunk[] = [
      { id: 'c1', lectureId: 'l1', start: 0, end: 10, text: 'text 1', embedding: [1, 0, 0] },
      { id: 'c2', lectureId: 'l1', start: 10, end: 20, text: 'text 2', embedding: [0.8, 0.2, 0] },
      { id: 'c3', lectureId: 'l1', start: 20, end: 30, text: 'text 3', embedding: [0, 1, 0] },
      { id: 'c4', lectureId: 'l1', start: 30, end: 40, text: 'no embedding text' }, // missing embedding
    ];

    it('retrieves top K chunks sorted by similarity', () => {
      const query = [1, 0, 0];
      const results = topK(query, chunks, 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('c1');
      expect(results[0].similarity).toBeCloseTo(1.0, 4);

      expect(results[1].id).toBe('c2');
      expect(results[1].similarity).toBeGreaterThan(0.9);
    });

    it('skips chunks without embedding and handles k greater than valid count', () => {
      const query = [0, 1, 0];
      const results = topK(query, chunks, 10);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('c3');
      expect(results.some((r) => r.id === 'c4')).toBe(false);
    });

    it('returns empty array when k <= 0 or query embedding is empty', () => {
      expect(topK([1, 0], chunks, 0)).toEqual([]);
      expect(topK([], chunks, 2)).toEqual([]);
    });
  });
});
