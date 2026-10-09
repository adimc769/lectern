import type { ChatMessage } from './ollama.js';

export const NOT_COVERED_RESPONSE = 'Not covered in your lectures.';

export function formatTimestamp(seconds: number): string {
  const totalSecs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function sectionSummaryMessages(sectionText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are an expert lecture summarizer. Provide a dense, accurate summary of the following lecture excerpt. Capture all key technical concepts, core definitions, and progression of ideas while omitting conversational filler.',
    },
    {
      role: 'user',
      content: `Please summarize this lecture excerpt:\n\n${sectionText}`,
    },
  ];
}

export function combineSummariesMessages(summaries: string[]): ChatMessage[] {
  const combined = summaries
    .map((summary, idx) => `Section ${idx + 1}:\n${summary}`)
    .join('\n\n');

  return [
    {
      role: 'system',
      content:
        'You are an expert academic assistant. Synthesize the provided section summaries into a single cohesive, high-quality lecture summary. Organize with clear thematic headings and bullet points covering main topics, mechanisms, and key takeaways.',
    },
    {
      role: 'user',
      content: `Synthesize these lecture section summaries into a comprehensive overall summary:\n\n${combined}`,
    },
  ];
}

export function keyTermsMessages(lectureText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are an expert educational content extractor. Extract the most important technical terms and concepts from the lecture, providing clear, concise definitions for each. Return a JSON object matching the requested schema with a "keyTerms" array.',
    },
    {
      role: 'user',
      content: `Extract key terms and definitions from this lecture transcript:\n\n${lectureText}`,
    },
  ];
}

export function flashcardsMessages(lectureText: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You are a study aid generator. Create high-quality study flashcards from the lecture transcript. Follow these strict rules:\n' +
        '1. Maximum 12 cards total.\n' +
        '2. No duplicate questions or concepts.\n' +
        '3. Every answer must be strictly under 25 words.\n' +
        '4. Return a JSON object matching the requested schema with a "flashcards" array.',
    },
    {
      role: 'user',
      content: `Generate study flashcards from this lecture transcript:\n\n${lectureText}`,
    },
  ];
}

export interface QASource {
  lectureId: string;
  lectureTitle?: string;
  chunkId?: string;
  start: number;
  text: string;
}

export function citedQAMessages(question: string, sources: QASource[]): ChatMessage[] {
  const formattedSources = sources
    .map((s, idx) => {
      const timeStr = formatTimestamp(s.start);
      const lectureRef = s.lectureId.replace(/^lecture-?/i, '');
      return `Source [${idx + 1}] [Lecture ${lectureRef}, ${timeStr}]:\n"${s.text}"`;
    })
    .join('\n\n');

  const systemPrompt =
    'You are an offline academic assistant answering student questions about lectures.\n' +
    'Rules:\n' +
    '1. Answer ONLY from the numbered sources provided below. Do not use outside knowledge or make assumptions.\n' +
    '2. If the sources do not provide sufficient information to support an answer to the question, you must reply EXACTLY with:\n' +
    'Not covered in your lectures.\n' +
    '3. When citing sources in your answer, cite them strictly as [Lecture N, mm:ss], where N is the lecture number and mm:ss is the timestamp.\n' +
    '4. Do not cite sources that are not in the provided list.';

  const userPrompt = `Sources:\n${formattedSources}\n\nQuestion: ${question}\n\nAnswer:`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
