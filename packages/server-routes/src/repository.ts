import type { Chunk } from '@lectern/core';
import type { LectureRecord, LectureSummaryItem, LectureStatus } from './types.js';

export interface LectureRepository {
  createLecture(lecture: LectureRecord): Promise<void> | void;
  getLecture(id: string): Promise<LectureRecord | null> | LectureRecord | null;
  listLectures(): Promise<LectureSummaryItem[]> | LectureSummaryItem[];
  updateProgress(
    id: string,
    status: LectureStatus,
    percent: number,
    errorMessage?: string,
  ): Promise<void> | void;
  updateLecture(id: string, updates: Partial<LectureRecord>): Promise<void> | void;
  saveChunks(chunks: Chunk[]): Promise<void> | void;
  getAllChunks(): Promise<Chunk[]> | Chunk[];
  getChunksForLecture(lectureId: string): Promise<Chunk[]> | Chunk[];
  close?(): void;
}
