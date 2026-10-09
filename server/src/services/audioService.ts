import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CONFIG } from '../config.js';

const execFileAsync = promisify(execFile);

export interface AudioConversionOptions {
  ffmpegCmd?: string;
  outputPath?: string;
}

export class AudioService {
  private readonly ffmpegCmd: string;

  constructor(ffmpegCmd?: string) {
    this.ffmpegCmd = ffmpegCmd || CONFIG.FFMPEG_CMD;
  }

  /**
   * Converts any input audio file (mp3, wav, m4a, webm, mp4, etc.)
   * to 16kHz mono 16-bit PCM WAV format required by Whisper.
   */
  async convertToWav(inputPath: string, options: AudioConversionOptions = {}): Promise<string> {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Audio file does not exist at path: ${inputPath}`);
    }

    const ffmpegPath = options.ffmpegCmd || this.ffmpegCmd;
    const resolvedOutput =
      options.outputPath ||
      path.join(
        path.dirname(inputPath),
        `${path.parse(inputPath).name}_16k_${Date.now()}.wav`,
      );

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
      await execFileAsync(ffmpegPath, args);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`FFmpeg audio conversion failed: ${msg}`);
    }

    if (!fs.existsSync(resolvedOutput) || fs.statSync(resolvedOutput).size === 0) {
      throw new Error(`FFmpeg failed to produce valid WAV file at: ${resolvedOutput}`);
    }

    return resolvedOutput;
  }
}

export const audioService = new AudioService();
