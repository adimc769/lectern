export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface Chunk {
  id: string;
  lectureId: string;
  start: number;
  end: number;
  text: string;
  embedding?: number[];
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface Citation {
  lectureId: string;
  lectureTitle: string;
  chunkId: string;
  start: number;
}
