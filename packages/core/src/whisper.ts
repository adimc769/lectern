import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Segment } from './types.js';

const execFileAsync = promisify(execFile);

export interface WhisperOptions {
  baseUrl?: string;
  ffmpegPath?: string;
  fetchFn?: typeof fetch;
  execFn?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  readFileFn?: (filePath: string) => Promise<Buffer>;
}

export class WhisperError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'WhisperError';
  }
}

interface RawWhisperSegment {
  id?: number;
  start?: number;
  end?: number;
  t0?: number;
  t1?: number;
  text?: string;
}

interface RawWhisperResponse {
  text?: string;
  segments?: RawWhisperSegment[];
  transcription?: RawWhisperSegment[];
}

export class WhisperClient {
  public readonly baseUrl: string;
  public readonly ffmpegPath: string;
  private readonly fetchFn: typeof fetch;
  private readonly execFn: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
  private readonly readFileFn: (filePath: string) => Promise<Buffer>;

  constructor(options: WhisperOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:8080').replace(/\/+$/, '');
    this.ffmpegPath = options.ffmpegPath ?? 'ffmpeg';
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.execFn = options.execFn ?? (async (file, args) => {
      const { stdout, stderr } = await execFileAsync(file, args);
      return { stdout: String(stdout), stderr: String(stderr) };
    });
    this.readFileFn = options.readFileFn ?? (async (p) => fs.promises.readFile(p));
  }

  async toWav(inputPath: string, outputPath?: string): Promise<string> {
    const ext = path.extname(inputPath);
    const resolvedOutput =
      outputPath ??
      (ext ? inputPath.slice(0, -ext.length) + '.16k.wav' : `${inputPath}.16k.wav`);

    const args = [
      '-y',
      '-i',
      inputPath,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      resolvedOutput,
    ];

    try {
      await this.execFn(this.ffmpegPath, args);
      return resolvedOutput;
    } catch (err) {
      throw new WhisperError(
        `Failed to convert audio to 16kHz mono WAV with ffmpeg: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }
  }

  async transcribe(wavPath: string): Promise<Segment[]> {
    let fileBytes: Buffer;
    try {
      fileBytes = await this.readFileFn(wavPath);
    } catch (err) {
      throw new WhisperError(
        `Failed to read WAV file at "${wavPath}": ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    const fileName = path.basename(wavPath) || 'audio.wav';
    const blob = new Blob([fileBytes], { type: 'audio/wav' });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('response_format', 'verbose_json');

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/inference`, {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') || msg.includes('fetch failed')) {
        throw new WhisperError(`Whisper.cpp server is down or unreachable at ${this.baseUrl}.`, err);
      }
      throw new WhisperError(`Whisper transcription request failed: ${msg}`, err);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new WhisperError(
        `Whisper.cpp server returned status ${response.status} (${response.statusText}): ${errText}`,
      );
    }

    let data: RawWhisperResponse;
    try {
      data = (await response.json()) as RawWhisperResponse;
    } catch (err) {
      throw new WhisperError('Failed to parse JSON response from Whisper.cpp server.', err);
    }

    const rawSegments = data.segments ?? data.transcription;

    if (Array.isArray(rawSegments) && rawSegments.length > 0) {
      const segments: Segment[] = [];
      for (const seg of rawSegments) {
        const text = (seg.text ?? '').trim();
        if (!text) continue;

        let start = 0;
        let end = 0;

        if (typeof seg.start === 'number' && typeof seg.end === 'number') {
          start = seg.start;
          end = seg.end;
        } else if (typeof seg.t0 === 'number' && typeof seg.t1 === 'number') {
          // Centiseconds or milliseconds fallback
          start = seg.t0 > 1000 ? seg.t0 / 1000 : seg.t0 / 100;
          end = seg.t1 > 1000 ? seg.t1 / 1000 : seg.t1 / 100;
        }

        segments.push({
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text,
        });
      }
      return segments;
    }

    if (data.text && data.text.trim().length > 0) {
      return [
        {
          start: 0,
          end: 0,
          text: data.text.trim(),
        },
      ];
    }

    return [];
  }
}

export const defaultWhisperClient = new WhisperClient();

export async function toWav(
  inputPath: string,
  outputPath?: string,
  options?: WhisperOptions,
): Promise<string> {
  const client = options ? new WhisperClient(options) : defaultWhisperClient;
  return client.toWav(inputPath, outputPath);
}

export async function transcribe(
  wavPath: string,
  options?: WhisperOptions,
): Promise<Segment[]> {
  const client = options ? new WhisperClient(options) : defaultWhisperClient;
  return client.transcribe(wavPath);
}
