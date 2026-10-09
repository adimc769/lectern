import type { TranscriptSegmentDTO, ChunkDTO } from '@lectern/shared';

export interface ChunkingOptions {
  targetWords?: number;
  overlapWords?: number;
}

export class ChunkingService {
  private countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Chunks transcript segments into ~250-word chunks with overlap,
   * preserving startTime from the earliest segment in the chunk for citations.
   */
  chunkSegments(
    segments: TranscriptSegmentDTO[],
    lectureId: string,
    options: ChunkingOptions = {},
  ): ChunkDTO[] {
    const validSegments = segments.filter((s) => s.text.trim().length > 0);
    if (validSegments.length === 0) {
      return [];
    }

    const targetWords = options.targetWords ?? 250;
    const overlapWords = options.overlapWords ?? 40;

    const chunks: ChunkDTO[] = [];
    let startIdx = 0;
    let chunkCount = 0;

    while (startIdx < validSegments.length) {
      let currentWords = 0;
      let endIdx = startIdx;

      while (endIdx < validSegments.length) {
        const segWords = this.countWords(validSegments[endIdx].text);
        currentWords += segWords;
        if (currentWords >= targetWords) {
          break;
        }
        if (endIdx + 1 < validSegments.length) {
          endIdx++;
        } else {
          break;
        }
      }

      const slice = validSegments.slice(startIdx, endIdx + 1);
      const text = slice.map((s) => s.text.trim()).join(' ');
      const startTime = slice[0].startTime;
      const endTime = slice[slice.length - 1].endTime;

      chunkCount++;
      chunks.push({
        id: `${lectureId}-chunk-${chunkCount}`,
        lectureId,
        startTime,
        endTime,
        text,
      });

      if (endIdx >= validSegments.length - 1) {
        break;
      }

      // Determine the start index for the next chunk based on overlapWords
      if (overlapWords <= 0) {
        startIdx = endIdx + 1;
      } else {
        let overlapCount = 0;
        let nextStart = endIdx;

        for (let k = endIdx; k > startIdx; k--) {
          const words = this.countWords(validSegments[k].text);
          if (overlapCount + words <= overlapWords || k === endIdx) {
            overlapCount += words;
            nextStart = k;
            if (overlapCount >= overlapWords) {
              break;
            }
          } else {
            break;
          }
        }

        if (nextStart <= startIdx) {
          startIdx = startIdx + 1;
        } else {
          startIdx = nextStart;
        }
      }
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
