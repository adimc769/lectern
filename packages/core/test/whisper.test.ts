import { describe, it, expect, vi } from 'vitest';
import { WhisperClient, toWav, transcribe, WhisperError } from '../src/whisper.js';

describe('WhisperClient', () => {
  describe('toWav', () => {
    it('executes ffmpeg with 16kHz mono PCM arguments', async () => {
      let executedFile = '';
      let executedArgs: string[] = [];

      const mockExec = vi.fn().mockImplementation(async (file: string, args: string[]) => {
        executedFile = file;
        executedArgs = args;
        return { stdout: '', stderr: '' };
      });

      const client = new WhisperClient({
        ffmpegPath: '/usr/bin/ffmpeg',
        execFn: mockExec,
      });

      const out = await client.toWav('lecture.mp4');

      expect(executedFile).toBe('/usr/bin/ffmpeg');
      expect(executedArgs).toEqual([
        '-y',
        '-i',
        'lecture.mp4',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        'lecture.16k.wav',
      ]);
      expect(out).toBe('lecture.16k.wav');
    });

    it('respects custom output path', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      const client = new WhisperClient({ execFn: mockExec });

      const out = await client.toWav('audio.m4a', 'custom_output.wav');
      expect(out).toBe('custom_output.wav');
    });

    it('throws WhisperError when ffmpeg fails', async () => {
      const mockExec = vi.fn().mockRejectedValue(new Error('ffmpeg: command not found'));
      const client = new WhisperClient({ execFn: mockExec });

      await expect(client.toWav('audio.mp3')).rejects.toThrowError(WhisperError);
    });
  });

  describe('transcribe', () => {
    it('calls /inference with multipart form data and parses segments', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: FormData | undefined;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method ?? '';
        capturedBody = init?.body as FormData;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            text: 'Hello world. Welcome to lecture 1.',
            segments: [
              { id: 0, start: 0.0, end: 1.5, text: ' Hello world. ' },
              { id: 1, start: 1.5, end: 3.8, text: ' Welcome to lecture 1.' },
            ],
          }),
        } as unknown as Response;
      });

      const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('RIFF mock wav bytes'));

      const client = new WhisperClient({
        baseUrl: 'http://localhost:8080',
        fetchFn: mockFetch as unknown as typeof fetch,
        readFileFn: mockReadFile,
      });

      const segments = await client.transcribe('test.wav');

      expect(capturedUrl).toBe('http://localhost:8080/inference');
      expect(capturedMethod).toBe('POST');
      expect(capturedBody).toBeInstanceOf(FormData);
      expect(capturedBody?.get('response_format')).toBe('verbose_json');

      expect(segments).toEqual([
        { start: 0, end: 1.5, text: 'Hello world.' },
        { start: 1.5, end: 3.8, text: 'Welcome to lecture 1.' },
      ]);
    });

    it('throws WhisperError when whisper server is unreachable', async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }),
      );
      const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('fake'));

      const client = new WhisperClient({
        baseUrl: 'http://localhost:8080',
        fetchFn: mockFetch as unknown as typeof fetch,
        readFileFn: mockReadFile,
      });

      await expect(client.transcribe('test.wav')).rejects.toThrowError(WhisperError);
    });

    it('top-level toWav and transcribe functions work with options', async () => {
      const mockExec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
      const mockReadFile = vi.fn().mockResolvedValue(Buffer.from('wav data'));
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          segments: [{ start: 0, end: 2, text: 'Sample' }],
        }),
      });

      const wavPath = await toWav('test.mp4', undefined, { execFn: mockExec });
      expect(wavPath).toBe('test.16k.wav');

      const segments = await transcribe('test.wav', {
        fetchFn: mockFetch as unknown as typeof fetch,
        readFileFn: mockReadFile,
      });
      expect(segments).toHaveLength(1);
      expect(segments[0].text).toBe('Sample');
    });
  });
});
