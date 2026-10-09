import { Router } from 'express';
import fs from 'fs';
import { CONFIG } from '../config.js';
import type { SystemStatusDTO } from '@lectern/shared';

export const statusRouter = Router();

statusRouter.get('/', async (_req, res) => {
  let ollamaReady = false;
  try {
    const check = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    ollamaReady = check.ok;
  } catch {
    ollamaReady = false;
  }

  const whisperExists = fs.existsSync(CONFIG.WHISPER_CLI_PATH) && fs.existsSync(CONFIG.WHISPER_MODEL_PATH);

  const status: SystemStatusDTO = {
    offline: true,
    gpuName: 'NVIDIA GeForce RTX 5060 Ti',
    vramTotalMB: 16283,
    whisperReady: whisperExists,
    ollamaReady,
    activeModels: {
      transcription: pathBasename(CONFIG.WHISPER_MODEL_PATH),
      llm: CONFIG.OLLAMA_LLM_MODEL,
      embeddings: CONFIG.OLLAMA_EMBED_MODEL,
    },
  };

  res.json(status);
});

function pathBasename(p: string) {
  return p.split(/[\\/]/).pop() || p;
}
