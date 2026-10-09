export type LectureStatus =
  | 'converting'
  | 'transcribing'
  | 'embedding'
  | 'summarizing'
  | 'flashcards'
  | 'done'
  | 'failed';

export interface LectureListItem {
  id: string;
  title: string;
  status: LectureStatus;
  durationSec: number;
  createdAt: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface LectureDetail {
  id: string;
  title: string;
  status: LectureStatus;
  transcript: TranscriptSegment[];
  summary: string;
  keyTerms: KeyTerm[];
  flashcards: Flashcard[];
  durationSec?: number;
  createdAt?: string;
  audioUrl?: string; // Optional audio blob/url for playback in UI
}

export interface LectureProgress {
  status: LectureStatus;
  percent: number;
}

export interface AskCitation {
  lectureId: string;
  lectureTitle: string;
  start: number;
}

export interface AskResponse {
  answer: string;
  citations: AskCitation[];
}

export interface AskRequest {
  question: string;
}

export interface UploadLectureResponse {
  id: string;
}

export interface LecternApiClient {
  uploadLecture: (file: File | Blob, title?: string) => Promise<UploadLectureResponse>;
  getLectures: () => Promise<LectureListItem[]>;
  getLecture: (id: string) => Promise<LectureDetail>;
  getLectureProgress: (id: string) => Promise<LectureProgress>;
  ask: (question: string) => Promise<AskResponse>;
}
