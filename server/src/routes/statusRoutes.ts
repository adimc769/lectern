import { Router } from 'express';
import { execFile } from 'node:child_process';
import fs from 'fs';
import { promisify } from 'node:util';
import { CONFIG } from '../config.js';
import type { SystemStatusDTO } from '@lectern/shared';

export const statusRouter = Router();

const execFileAsync = promisify(execFile);

const FALLBACK_GPU_NAME = 'NVIDIA GeForce RTX 5060 Ti';
const FALLBACK_VRAM_MB = 16283;
const PROBE_TIMEOUT_MS = 2000;

interface GpuProbe {
  gpuName: string;
  vramTotalMB: number;
  nvidiaSmiOk: boolean;
}

function parseVramToMB(rawMem: string | undefined): number {
  const match = /([\d.]+)\s*(MiB|GiB|MB|GB)/i.exec(rawMem ?? '');
  if (!match) return FALLBACK_VRAM_MB;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return FALLBACK_VRAM_MB;
  const unit = match[2].toUpperCase();
  if (unit === 'GIB') return Math.round(value * 1024);
  if (unit === 'GB') return Math.round(value * 1000);
  return Math.round(value);
}

async function probeGpu(): Promise<GpuProbe> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader'],
      { timeout: PROBE_TIMEOUT_MS },
    );
    const firstLine = stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (!firstLine) throw new Error('empty nvidia-smi output');
    const [rawName, rawMem] = firstLine.split(',');
    const gpuName = (rawName ?? '').trim() || FALLBACK_GPU_NAME;
    return { gpuName, vramTotalMB: parseVramToMB(rawMem), nvidiaSmiOk: true };
  } catch {
    return { gpuName: FALLBACK_GPU_NAME, vramTotalMB: FALLBACK_VRAM_MB, nvidiaSmiOk: false };
  }
}

async function probeOllama(): Promise<{ ollamaReady: boolean; ollamaModels: string[] }> {
  try {
    const res = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return { ollamaReady: false, ollamaModels: [] };
    const data = (await res.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const ollamaModels = Array.isArray(data.models)
      ? data.models
          .map((m) => m?.name ?? m?.model ?? '')
          .filter((n): n is string => n.length > 0)
      : [];
    return { ollamaReady: true, ollamaModels };
  } catch {
    return { ollamaReady: false, ollamaModels: [] };
  }
}

async function probeFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync(CONFIG.FFMPEG_CMD, ['-version'], { timeout: PROBE_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

/**
 * Times a tiny local embeddings call as an LLM-stack liveness/throughput
 * proxy. Returns estimated tokens/sec, or undefined when Ollama is
 * unreachable or the probe fails/times out.
 */
async function probeEmbeddingThroughput(): Promise<number | undefined> {
  const assumedPromptTokens = 4;
  const startedAt = Date.now();
  try {
    const res = await fetch(`${CONFIG.OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CONFIG.OLLAMA_EMBED_MODEL, prompt: 'ping' }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    await res.json().catch(() => undefined);
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs <= 0) return undefined;
    return Math.round((assumedPromptTokens / (elapsedMs / 1000)) * 10) / 10;
  } catch {
    return undefined;
  }
}

function fallbackStatus(): SystemStatusDTO {
  return {
    offline: true,
    gpuName: FALLBACK_GPU_NAME,
    vramTotalMB: FALLBACK_VRAM_MB,
    whisperReady: false,
    ollamaReady: false,
    activeModels: {
      transcription: pathBasename(CONFIG.WHISPER_MODEL_PATH),
      llm: CONFIG.OLLAMA_LLM_MODEL,
      embeddings: CONFIG.OLLAMA_EMBED_MODEL,
    },
    lastCheckedAt: new Date().toISOString(),
    ffmpegReady: false,
    ollamaModels: [],
    details: {
      nvidiaSmiOk: false,
      whisperCli: false,
      whisperModel: false,
    },
  };
}

// GET /api/status — always answers 200 with local proofs; never throws 500.
statusRouter.get('/', async (_req, res) => {
  try {
    const [gpu, ollama, ffmpegReady] = await Promise.all([
      probeGpu(),
      probeOllama(),
      probeFfmpeg(),
    ]);

    const whisperCli = fs.existsSync(CONFIG.WHISPER_CLI_PATH);
    const whisperModel = fs.existsSync(CONFIG.WHISPER_MODEL_PATH);

    let llmTokensPerSec: number | undefined;
    if (ollama.ollamaReady) {
      llmTokensPerSec = await probeEmbeddingThroughput();
    }

    const status: SystemStatusDTO = {
      offline: true,
      gpuName: gpu.gpuName,
      vramTotalMB: gpu.vramTotalMB,
      whisperReady: whisperCli && whisperModel,
      ollamaReady: ollama.ollamaReady,
      activeModels: {
        transcription: pathBasename(CONFIG.WHISPER_MODEL_PATH),
        llm: CONFIG.OLLAMA_LLM_MODEL,
        embeddings: CONFIG.OLLAMA_EMBED_MODEL,
      },
      lastCheckedAt: new Date().toISOString(),
      ffmpegReady,
      ollamaModels: ollama.ollamaModels,
      llmTokensPerSec,
      details: {
        nvidiaSmiOk: gpu.nvidiaSmiOk,
        whisperCli,
        whisperModel,
      },
    };

    res.status(200).json(status);
  } catch {
    // Never throw 500: status must always answer 200 with safe fallbacks.
    res.status(200).json(fallbackStatus());
  }
});

function pathBasename(p: string) {
  return p.split(/[\\/]/).pop() || p;
}
