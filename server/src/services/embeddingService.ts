import { CONFIG } from '../config.js';
import { prisma } from '../db.js';
import type { ChunkDTO } from '@lectern/shared';

export interface EmbeddingOptions {
  baseUrl?: string;
  model?: string;
  batchSize?: number;
}

export class EmbeddingService {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = (baseUrl || CONFIG.OLLAMA_BASE_URL).replace(/\/+$/, '');
    this.model = model || CONFIG.OLLAMA_EMBED_MODEL;
  }

  /**
   * Generates a 768-dim embedding for a single text using local Ollama nomic-embed-text.
   */
  async getEmbedding(text: string, modelOverride?: string): Promise<number[]> {
    const model = modelOverride || this.model;
    const url = `${this.baseUrl}/api/embed`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: text,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama embed error (${res.status}): ${errText}`);
    }

    interface OllamaEmbedResponse {
      embeddings?: number[][];
      embedding?: number[];
    }

    const data = (await res.json()) as OllamaEmbedResponse;

    if (Array.isArray(data.embeddings) && data.embeddings.length > 0) {
      return data.embeddings[0];
    }
    if (Array.isArray(data.embedding)) {
      return data.embedding;
    }

    throw new Error('Ollama embed endpoint returned no vector embeddings');
  }

  /**
   * Generates embeddings for all chunks and persists them into the SQLite Chunk table
   * as serialized JSON arrays.
   */
  async generateAndSaveEmbeddings(
    chunks: ChunkDTO[],
    lectureId: string,
    options: EmbeddingOptions = {},
  ): Promise<ChunkDTO[]> {
    if (chunks.length === 0) {
      return [];
    }

    // Clear previous chunks for this lecture
    await prisma.chunk.deleteMany({ where: { lectureId } });

    const results: ChunkDTO[] = [];

    for (const chunk of chunks) {
      const embedding = await this.getEmbedding(chunk.text, options.model);

      const saved = await prisma.chunk.create({
        data: {
          id: chunk.id,
          lectureId,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          text: chunk.text,
          embeddingJson: JSON.stringify(embedding),
        },
      });

      results.push({
        id: saved.id,
        lectureId: saved.lectureId,
        startTime: saved.startTime,
        endTime: saved.endTime,
        text: saved.text,
      });
    }

    return results;
  }

  /**
   * Cosine similarity between two numeric vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return Math.max(-1, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
  }

  /**
   * Retrieves top K chunks by cosine similarity across all stored chunks in SQLite.
   */
  async findTopK(
    queryEmbedding: number[],
    k = 6,
    filterLectureId?: string,
  ): Promise<Array<ChunkDTO & { similarity: number }>> {
    const where = filterLectureId ? { lectureId: filterLectureId } : {};
    const rows = await prisma.chunk.findMany({
      where,
      include: { lecture: { select: { title: true } } },
    });

    const scored: Array<ChunkDTO & { similarity: number }> = [];

    for (const r of rows) {
      try {
        const vec = JSON.parse(r.embeddingJson) as number[];
        const sim = this.cosineSimilarity(queryEmbedding, vec);
        scored.push({
          id: r.id,
          lectureId: r.lectureId,
          lectureTitle: r.lecture?.title,
          startTime: r.startTime,
          endTime: r.endTime,
          text: r.text,
          similarity: Math.round(sim * 1000) / 1000,
        });
      } catch {
        // ignore parse error
      }
    }

    scored.sort((x, y) => y.similarity - x.similarity);
    return scored.slice(0, k);
  }
}

export const embeddingService = new EmbeddingService();
