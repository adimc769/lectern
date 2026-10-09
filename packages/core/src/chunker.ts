import type { Segment, Chunk } from './types.js';

export interface ChunkOptions {
  targetWords?: number;
  overlapWords?: number;
  lectureId?: string;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function chunkSegments(
  segments: Segment[],
  options: ChunkOptions = {},
): Chunk[] {
  const validSegments = segments.filter((s) => s.text.trim().length > 0);
  if (validSegments.length === 0) {
    return [];
  }

  const targetWords = options.targetWords ?? 250;
  const overlapWords = options.overlapWords ?? 40;
  const lectureId = options.lectureId ?? 'lecture-1';

  const chunks: Chunk[] = [];
  let startIdx = 0;
  let chunkCount = 0;

  while (startIdx < validSegments.length) {
    let currentWords = 0;
    let endIdx = startIdx;

    while (endIdx < validSegments.length) {
      const segWords = countWords(validSegments[endIdx].text);
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


    const chunkSegmentsSlice = validSegments.slice(startIdx, endIdx + 1);
    const chunkText = chunkSegmentsSlice.map((s) => s.text.trim()).join(' ');
    const chunkStart = chunkSegmentsSlice[0].start;
    const chunkEnd = chunkSegmentsSlice[chunkSegmentsSlice.length - 1].end;

    chunkCount++;
    chunks.push({
      id: `${lectureId}-chunk-${chunkCount}`,
      lectureId,
      start: chunkStart,
      end: chunkEnd,
      text: chunkText,
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
        const words = countWords(validSegments[k].text);
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
