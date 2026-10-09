import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChunkingService } from '../chunkingService.js';
import { EmbeddingService } from '../embeddingService.js';
import { WhisperService } from '../whisperService.js';
import { AudioService } from '../audioService.js';
import { PipelineOrchestrator } from '../pipelineOrchestrator.js';
import type { TranscriptSegmentDTO } from '@lectern/shared';

describe('Backend Pipeline Services', () => {
  describe('AudioService', () => {
    it('throws error when input audio file does not exist', async () => {
      const audioService = new AudioService();
      await expect(
        audioService.convertToWav('non_existent_file.mp3'),
      ).rejects.toThrow('Audio file does not exist');
    });
  });

  describe('ChunkingService', () => {
    const chunker = new ChunkingService();

    it('returns empty array when given empty segments', () => {
      expect(chunker.chunkSegments([], 'lec-1')).toEqual([]);
      expect(chunker.chunkSegments([{ id: '1', lectureId: 'lec-1', startTime: 0, endTime: 1, text: '   ' }], 'lec-1')).toEqual([]);
    });

    it('chunks segments preserving startTime and combining text', () => {
      const segments: TranscriptSegmentDTO[] = [
        { id: '1', lectureId: 'lec-1', startTime: 0.0, endTime: 5.0, text: 'Hello world, this is segment one.' },
        { id: '2', lectureId: 'lec-1', startTime: 5.0, endTime: 12.0, text: 'And this is segment two with further explanations.' },
      ];

      const chunks = chunker.chunkSegments(segments, 'lec-1', { targetWords: 10, overlapWords: 0 });
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].startTime).toBe(0.0);
      expect(chunks[0].endTime).toBe(12.0);
      expect(chunks[0].text).toContain('segment one');
      expect(chunks[0].text).toContain('segment two');
      expect(chunks[0].lectureId).toBe('lec-1');
    });

    it('handles ~250-word chunks with overlap correctly', () => {
      const segments: TranscriptSegmentDTO[] = [];
      for (let i = 0; i < 20; i++) {
        segments.push({
          id: `seg-${i}`,
          lectureId: 'lec-data',
          startTime: i * 15,
          endTime: (i + 1) * 15,
          text: Array.from({ length: 25 }, (_, w) => `word_${i}_${w}`).join(' '),
        });
      }

      const chunks = chunker.chunkSegments(segments, 'lec-data', { targetWords: 250, overlapWords: 40 });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].startTime).toBe(0);
      expect(chunks[1].startTime).toBeLessThan(chunks[0].endTime); // Overlap preserved
    });
  });

  describe('EmbeddingService', () => {
    const embedService = new EmbeddingService();

    it('computes cosine similarity accurately', () => {
      expect(embedService.cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1.0, 5);
      expect(embedService.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
      expect(embedService.cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
      expect(embedService.cosineSimilarity([], [1, 0])).toBe(0);
    });

    it('handles Ollama embed network calls with fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      });
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const vec = await embedService.getEmbedding('Test lecture chunk text');
      expect(vec).toEqual([0.1, 0.2, 0.3]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/embed'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('WhisperService parsing logic', () => {
    const whisper = new WhisperService();

    it('parses timestamps into fractional seconds correctly', () => {
      // @ts-expect-error accessing private method for unit test
      expect(whisper.parseTimestampToSeconds('00:00:10.500')).toBe(10.5);
      // @ts-expect-error accessing private method for unit test
      expect(whisper.parseTimestampToSeconds('00:01:30,000')).toBe(90);
      // @ts-expect-error accessing private method for unit test
      expect(whisper.parseTimestampToSeconds('01:00:00.000')).toBe(3600);
    });

    it('parses stdout lines when fallback is needed', () => {
      const sampleStdout = `
[00:00:00.000 --> 00:00:05.200]   Welcome to the lecture.
[00:00:05.200 --> 00:00:11.800]   Today we will cover kernel architectures.
      `;
      // @ts-expect-error accessing private method for unit test
      const segs = whisper.parseStdoutFallback(sampleStdout);
      expect(segs).toHaveLength(2);
      expect(segs[0].startTime).toBe(0.0);
      expect(segs[0].endTime).toBe(5.2);
      expect(segs[0].text).toBe('Welcome to the lecture.');
      expect(segs[1].startTime).toBe(5.2);
      expect(segs[1].endTime).toBe(11.8);
      expect(segs[1].text).toBe('Today we will cover kernel architectures.');
    });
  });

  describe('PipelineOrchestrator progress tracking', () => {
    it('manages in-memory progress states and percentages accurately', async () => {
      const orchestrator = new PipelineOrchestrator();

      // @ts-expect-error accessing private method for testing
      orchestrator.updateProgress('lec-test-1', 'CONVERTING_AUDIO', 15, 'Converting audio to WAV');
      let progress = await orchestrator.getProgress('lec-test-1');
      expect(progress.stage).toBe('CONVERTING_AUDIO');
      expect(progress.progressPercent).toBe(15);

      // @ts-expect-error accessing private method for testing
      orchestrator.updateProgress('lec-test-1', 'TRANSCRIBING', 35, 'Transcribing with whisper');
      progress = await orchestrator.getProgress('lec-test-1');
      expect(progress.stage).toBe('TRANSCRIBING');
      expect(progress.progressPercent).toBe(35);

      // @ts-expect-error accessing private method for testing
      orchestrator.updateProgress('lec-test-1', 'COMPLETED', 100, 'All done');
      progress = await orchestrator.getProgress('lec-test-1');
      expect(progress.stage).toBe('COMPLETED');
      expect(progress.progressPercent).toBe(100);
    });
  });
});
