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

  /**
   * Retrieves accurate audio duration in seconds using ffprobe, ffmpeg,
   * or direct WAV PCM byte-length calculation.
   */
  async getAudioDuration(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) return 0;

    // 1. Try ffprobe first
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const dur = parseFloat(stdout.trim());
      if (!isNaN(dur) && dur > 0) {
        return Math.round(dur * 100) / 100;
      }
    } catch {
      // ffprobe failed, try ffmpeg
    }

    // 2. Try ffmpeg -i parsing stderr
    try {
      const { stderr } = await execFileAsync(this.ffmpegCmd, ['-i', filePath]);
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const secs = parseFloat(match[3]);
        const dur = hours * 3600 + mins * 60 + secs;
        if (!isNaN(dur) && dur > 0) {
          return Math.round(dur * 100) / 100;
        }
      }
    } catch {
      // Continue to WAV fallback
    }

    // 3. WAV fallback: 16kHz mono 16-bit PCM has 32000 bytes/sec
    try {
      if (filePath.toLowerCase().endsWith('.wav')) {
        const stats = fs.statSync(filePath);
        if (stats.size > 44) {
          const dur = (stats.size - 44) / 32000;
          return Math.round(dur * 100) / 100;
        }
      }
    } catch {
      // ignore
    }

    return 0;
  }
}

export const audioService = new AudioService();
