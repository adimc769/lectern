import { Router } from 'express';
import type { QnARequestDTO, QnAResponseDTO } from '@lectern/shared';

export const qnaRouter = Router();

qnaRouter.post('/', async (req, res) => {
  const { question } = req.body as QnARequestDTO;

  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Question parameter is required' });
    return;
  }

  // Baseline response stub; populated fully in feat/core
  const response: QnAResponseDTO = {
    question,
    answer: 'Backend skeleton active. Cross-lecture citation engine ready for indexing in feat/core.',
    citations: [],
    unsupported: false,
  };

  res.json(response);
});
