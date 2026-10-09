import type { Segment, Chunk, Flashcard, KeyTerm } from '@lectern/core';

export type LectureStatus =
  | 'converting'
  | 'transcribing'
  | 'embedding'
  | 'summarizing'
  | 'flashcards'
  | 'done'
  | 'failed';

export interface LectureRecord {
  id: string;
  title: string;
  status: LectureStatus;
  progressPercent: number;
  durationSec: number;
  createdAt: string;
  transcript: Segment[];
  summary: string;
  keyTerms: KeyTerm[];
  flashcards: Flashcard[];
  errorMessage?: string;
  audioFilePath?: string;
}

export interface LectureSummaryItem {
  id: string;
  title: string;
  status: LectureStatus;
  durationSec: number;
  createdAt: string;
}

export interface PostLecturesRequest {
  file: Buffer | Uint8Array;
  filename: string;
  title?: string;
  autoStart?: boolean;
}


export interface PostLecturesResponse {
  id: string;
}

export type GetLecturesResponse = LectureSummaryItem[];

export interface GetLectureByIdRequest {
  id: string;
}

export interface GetLectureByIdResponse {
  id: string;
  title: string;
  status: LectureStatus;
  transcript: Segment[];
  summary: string;
  keyTerms: KeyTerm[];
  flashcards: Flashcard[];
}

export interface GetLectureProgressRequest {
  id: string;
}

export interface GetLectureProgressResponse {
  status: LectureStatus;
  percent: number;
  error?: string;
}

export interface PostAskRequest {
  question: string;
}

export interface AskCitation {
  lectureId: string;
  lectureTitle: string;
  start: number;
}

export interface PostAskResponse {
  answer: string;
  citations: AskCitation[];
}
