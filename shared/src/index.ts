export type LectureStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type PipelineStage =
  | 'IDLE'
  | 'PROCESSING'
  | 'CONVERTING_AUDIO'
  | 'TRANSCRIBING'
  | 'CHUNKING'
  | 'GENERATING_EMBEDDINGS'
  | 'SUMMARIZING'
  | 'EXTRACTING_CARDS'
  | 'COMPLETED'
  | 'FAILED';

export interface TranscriptSegmentDTO {
  id: string;
  lectureId: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export interface ChunkDTO {
  id: string;
  lectureId: string;
  lectureTitle?: string;
  startTime: number;
  endTime: number;
  text: string;
  similarity?: number;
}

export interface FlashcardDTO {
  id: string;
  lectureId: string;
  front: string;
  back: string;
}

export interface KeyTermDTO {
  id: string;
  lectureId: string;
  term: string;
  definition: string;
}

export interface LectureDTO {
  id: string;
  title: string;
  audioPath: string;
  duration: number; // in seconds
  status: LectureStatus;
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
  segments?: TranscriptSegmentDTO[];
  chunks?: ChunkDTO[];
  flashcards?: FlashcardDTO[];
  keyTerms?: KeyTermDTO[];
}

export interface JobProgressDTO {
  lectureId: string;
  stage: PipelineStage;
  progressPercent: number; // 0 - 100
  message: string;
  error?: string;
}

export interface CitationItem {
  lectureId: string;
  lectureTitle: string;
  startTime: number;
  endTime: number;
  timestampLabel: string; // e.g. "[Lecture 1, 04:12]"
  textSnippet: string;
  similarity: number;
}

export interface QnARequestDTO {
  question: string;
  topK?: number;
}

export interface QnAResponseDTO {
  question: string;
  answer: string;
  citations: CitationItem[];
  unsupported: boolean;
}

export interface SystemStatusDTO {
  offline: boolean;
  gpuName: string;
  vramTotalMB: number;
  whisperReady: boolean;
  ollamaReady: boolean;
  activeModels: {
    transcription: string;
    llm: string;
    embeddings: string;
  };
  lastCheckedAt?: string;
  ffmpegReady?: boolean;
  ollamaModels?: string[];
  whisperLatencyMs?: number;
  llmTokensPerSec?: number | null;
  transcriptionRealtimeFactor?: number;
  details?: {
    nvidiaSmiOk: boolean;
    whisperCli: boolean;
    whisperModel: boolean;
  };
}

export type DocumentType = 'PDF' | 'DOCX' | 'TXT';
export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export interface DocumentPageDTO { pageNo: number; text: string; sections: string[]; }
export interface DocumentDTO { id: string; title: string; docType: DocumentType; status: DocumentStatus; filePath: string; pageCount: number; createdAt: string; updatedAt: string; error?: string; pages?: DocumentPageDTO[]; }
