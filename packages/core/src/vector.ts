import type { Chunk } from './types.js';

export interface ScoredChunk extends Chunk {
  similarity: number;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Clamp between -1 and 1 to eliminate floating-point precision artifacts
  return Math.max(-1, Math.min(1, similarity));
}

export function topK(
  queryEmbedding: number[],
  chunks: Chunk[],
  k: number,
): ScoredChunk[] {
  if (k <= 0 || chunks.length === 0 || queryEmbedding.length === 0) {
    return [];
  }

  const scored: ScoredChunk[] = [];

  for (const chunk of chunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) {
      continue;
    }

    const similarity = cosine(queryEmbedding, chunk.embedding);
    scored.push({
      ...chunk,
      similarity,
    });
  }

  scored.sort((x, y) => y.similarity - x.similarity);

  return scored.slice(0, k);
}
