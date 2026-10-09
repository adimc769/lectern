import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CONFIG } from '../config.js';
import { prisma } from '../db.js';
import type { TranscriptSegmentDTO } from '@lectern/shared';

const execFileAsync = promisify(execFile);

export interface WhisperOptions {
  cliPath?: string;
  modelPath?: string;
  deviceId?: number;
  flashAttention?: boolean;
  language?: string;
}

export interface RawWhisperJson {
  transcription?: Array<{
    timestamps?: {
      from?: string;
      to?: string;
    };
    offsets?: {
      from?: number;
      to?: number;
    };
    text?: string;
  }>;
}

export class WhisperService {
  private readonly cliPath: string;
  private readonly modelPath: string;

  constructor(cliPath?: string, modelPath?: string) {
    this.cliPath = cliPath || CONFIG.WHISPER_CLI_PATH;
    this.modelPath = modelPath || CONFIG.WHISPER_MODEL_PATH;
  }

  private parseTimestampToSeconds(ts: string): number {
    // format: "00:01:23,456" or "00:01:23.456"
    const normalized = ts.replace(',', '.').trim();
    const parts = normalized.split(':');
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }

  private parseStdoutFallback(stdout: string): Array<{ startTime: number; endTime: number; text: string }> {
    const segments: Array<{ startTime: number; endTime: number; text: string }> = [];
    const regex = /\[(\d{2}:\d{2}:\d{2}[.,]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[.,]\d{3})\]\s+(.*)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(stdout)) !== null) {
      const startTime = this.parseTimestampToSeconds(match[1]);
      const endTime = this.parseTimestampToSeconds(match[2]);
      const text = match[3].trim();
      if (text) {
        segments.push({ startTime, endTime, text });
      }
    }

    return segments;
  }

  /**
   * Executes whisper-cli with CUDA GPU acceleration and parses output into
   * timestamped transcript segments. Saves segments to Prisma if lectureId is provided.
   */
  async transcribe(
    wavPath: string,
    lectureId?: string,
    options: WhisperOptions = {},
  ): Promise<TranscriptSegmentDTO[]> {
    const cli = options.cliPath || this.cliPath;
    const model = options.modelPath || this.modelPath;

    if (!fs.existsSync(cli)) {
      throw new Error(`Whisper CLI binary not found at: ${cli}`);
    }
    if (!fs.existsSync(model)) {
      throw new Error(`Whisper model weights not found at: ${model}`);
    }
    if (!fs.existsSync(wavPath)) {
      throw new Error(`Audio file not found at: ${wavPath}`);
    }

    const outputPrefix = path.join(
      path.dirname(wavPath),
      `whisper_${path.parse(wavPath).name}_${Date.now()}`,
    );

    const args = [
      '-m',
      model,
      '-f',
      wavPath,
      '-dev',
      String(options.deviceId ?? 0),
      options.flashAttention !== false ? '-fa' : '-nfa',
      '-oj',
      '-of',
      outputPrefix,
    ];

    if (options.language) {
      args.push('-l', options.language);
    }

    let stdout = '';
    let stderr = '';
    try {
      const res = await execFileAsync(cli, args, { maxBuffer: 100 * 1024 * 1024 });
      stdout = String(res.stdout);
      stderr = String(res.stderr);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`whisper-cli execution failed: ${msg}\nStderr: ${stderr}`);
    }

    const expectedJsonFile = `${outputPrefix}.json`;
    let parsedSegments: Array<{ startTime: number; endTime: number; text: string }> = [];

    if (fs.existsSync(expectedJsonFile)) {
      try {
        const jsonContent = fs.readFileSync(expectedJsonFile, 'utf-8');
        const data = JSON.parse(jsonContent) as RawWhisperJson;
        const rawList = data.transcription || [];

        for (const item of rawList) {
          const text = (item.text || '').trim();
          if (!text) continue;

          let startTime = 0;
          let endTime = 0;

          if (item.offsets && typeof item.offsets.from === 'number') {
            startTime = item.offsets.from / 1000;
            endTime = (item.offsets.to || item.offsets.from) / 1000;
          } else if (item.timestamps?.from && item.timestamps?.to) {
            startTime = this.parseTimestampToSeconds(item.timestamps.from);
            endTime = this.parseTimestampToSeconds(item.timestamps.to);
          }

          parsedSegments.push({
            startTime: Math.round(startTime * 100) / 100,
            endTime: Math.round(endTime * 100) / 100,
            text,
          });
        }
      } catch (parseErr) {
        // Fallback to stdout regex if json reading fails
        parsedSegments = this.parseStdoutFallback(stdout);
      } finally {
        // Cleanup JSON artifact
        try {
          fs.unlinkSync(expectedJsonFile);
        } catch {
          // ignore cleanup errors
        }
      }
    } else {
      parsedSegments = this.parseStdoutFallback(stdout);
    }

    if (parsedSegments.length === 0 && stdout.trim().length > 0) {
      // Last-ditch: single segment from trimmed output
      parsedSegments.push({
        startTime: 0,
        endTime: 0,
        text: stdout.trim(),
      });
    }

    // Map to TranscriptSegmentDTO and persist to SQLite if lectureId is provided
    const targetLectureId = lectureId || 'unknown';
    const resultDTOs: TranscriptSegmentDTO[] = [];

    if (lectureId) {
      // Clear any existing segments for this lecture
      await prisma.transcriptSegment.deleteMany({ where: { lectureId } });

      for (const seg of parsedSegments) {
        const created = await prisma.transcriptSegment.create({
          data: {
            lectureId,
            startTime: seg.startTime,
            endTime: seg.endTime,
            text: seg.text,
          },
        });

        resultDTOs.push({
          id: created.id,
          lectureId: created.lectureId,
          startTime: created.startTime,
          endTime: created.endTime,
          text: created.text,
        });
      }
    } else {
      for (const [idx, seg] of parsedSegments.entries()) {
        resultDTOs.push({
          id: `temp-${idx}`,
          lectureId: targetLectureId,
          startTime: seg.startTime,
          endTime: seg.endTime,
          text: seg.text,
        });
      }
    }

    return resultDTOs;
  }
}

export const whisperService = new WhisperService();
