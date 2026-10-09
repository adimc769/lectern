import { Router } from 'express';
import { CONFIG } from '../config.js';
import { embeddingService } from '../services/embeddingService.js';
import type { QnARequestDTO, QnAResponseDTO, CitationItem } from '@lectern/shared';

export const qnaRouter = Router();

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

qnaRouter.post('/', async (req, res) => {
  const { question, topK = 6 } = req.body as QnARequestDTO;

  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Question parameter is required' });
    return;
  }

  try {
    // 1. Embed query vector
    const queryEmbedding = await embeddingService.getEmbedding(question);

    // 2. Retrieve top K chunks
    const topChunks = await embeddingService.findTopK(queryEmbedding, topK);

    if (topChunks.length === 0) {
      const response: QnAResponseDTO = {
        question,
        answer: 'Not covered in your lectures.',
        citations: [],
        unsupported: true,
      };
      res.json(response);
      return;
    }

    // 3. Format sources
    const sourcesText = topChunks
      .map((c, idx) => {
        const timeLabel = formatTimestamp(c.startTime);
        const title = c.lectureTitle || c.lectureId;
        return `Source [${idx + 1}] [${title}, ${timeLabel}]:\n"${c.text}"`;
      })
      .join('\n\n');

    const promptMessages = [
      {
        role: 'system',
        content:
          'You are an offline academic assistant answering student questions about lectures.\n' +
          'Rules:\n' +
          '1. Answer ONLY from the numbered sources provided below. Do not use outside knowledge or make assumptions.\n' +
          '2. If the sources do not provide sufficient information to support an answer to the question, you must reply EXACTLY with:\n' +
          'Not covered in your lectures.\n' +
          '3. When citing sources in your answer, cite them strictly as [LectureTitle, mm:ss].\n' +
          '4. Keep your answer factual, precise, and directly relevant.',
      },
      {
        role: 'user',
        content: `Sources:\n${sourcesText}\n\nQuestion: ${question}\n\nAnswer:`,
      },
    ];

    // 4. Query Ollama
    const chatRes = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.OLLAMA_LLM_MODEL,
        messages: promptMessages,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!chatRes.ok) {
      throw new Error(`Ollama chat error (${chatRes.status})`);
    }

    interface OllamaChatRes {
      message: { content: string };
    }
    const chatData = (await chatRes.json()) as OllamaChatRes;
    const answer = chatData.message.content.trim();

    const isUnsupported =
      answer === 'Not covered in your lectures.' ||
      answer.toLowerCase().startsWith('not covered in your lectures');

    const citations: CitationItem[] = isUnsupported
      ? []
      : topChunks.map((c) => ({
          lectureId: c.lectureId,
          lectureTitle: c.lectureTitle || c.lectureId,
          startTime: c.startTime,
          endTime: c.endTime,
          timestampLabel: `[${c.lectureTitle || c.lectureId}, ${formatTimestamp(c.startTime)}]`,
          textSnippet: c.text,
          similarity: c.similarity ?? 0,
        }));

    const response: QnAResponseDTO = {
      question,
      answer: isUnsupported ? 'Not covered in your lectures.' : answer,
      citations,
      unsupported: isUnsupported,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Q&A processing failed', details: String(error) });
  }
});
