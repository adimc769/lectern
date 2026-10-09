import { describe, it, expect, vi } from 'vitest';
import {
  OllamaClient,
  chat,
  embed,
  OllamaDownError,
  OllamaModelNotFoundError,
  OllamaTimeoutError,
} from '../src/ollama.js';

describe('OllamaClient', () => {
  it('sends correct chat request with structured output format and keepAlive', async () => {
    let capturedUrl = '';
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'qwen2.5:7b',
          message: { role: 'assistant', content: '{"answer":"test"}' },
          done: true,
        }),
      } as unknown as Response;
    });

    const client = new OllamaClient({
      baseUrl: 'http://localhost:11434',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const schema = {
      type: 'object',
      properties: { answer: { type: 'string' } },
      required: ['answer'],
    };

    const res = await client.chat({
      model: 'qwen2.5:7b',
      messages: [{ role: 'user', content: 'hello' }],
      format: schema,
      keepAlive: '10m',
    });

    expect(capturedUrl).toBe('http://localhost:11434/api/chat');
    expect(capturedBody.model).toBe('qwen2.5:7b');
    expect(capturedBody.stream).toBe(false);
    expect(capturedBody.format).toEqual(schema);
    expect(capturedBody.keep_alive).toBe('10m');
    expect(res.message.content).toBe('{"answer":"test"}');
  });

  it('embed sends correct request and parses embedding and embeddings', async () => {
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        }),
      } as unknown as Response;
    });

    const client = new OllamaClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.embed({
      model: 'nomic-embed-text:latest',
      input: ['text 1', 'text 2'],
    });

    expect(capturedBody.model).toBe('nomic-embed-text:latest');
    expect(capturedBody.input).toEqual(['text 1', 'text 2']);
    expect(res.embeddings).toHaveLength(2);
    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('retries up to 2 times on 500 error before succeeding', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: { role: 'assistant', content: 'success after retry' },
          model: 'qwen2.5:7b',
        }),
      } as unknown as Response;
    });

    const client = new OllamaClient({
      fetchFn: mockFetch as unknown as typeof fetch,
      retryDelayMs: 1,
    });

    const res = await client.chat({
      model: 'qwen2.5:7b',
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(callCount).toBe(3);
    expect(res.message.content).toBe('success after retry');
  });

  it('throws OllamaModelNotFoundError immediately if model is not pulled (404)', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "model 'unknown:latest' not found" }),
      } as unknown as Response;
    });

    const client = new OllamaClient({
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.chat({
        model: 'unknown:latest',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrowError(OllamaModelNotFoundError);

    // 404 should not retry
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws OllamaDownError if Ollama connection fails after retries', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      throw new TypeError('fetch failed', {
        cause: { code: 'ECONNREFUSED' },
      });
    });

    const client = new OllamaClient({
      fetchFn: mockFetch as unknown as typeof fetch,
      retryDelayMs: 1,
      maxRetries: 2,
    });

    await expect(
      client.chat({
        model: 'qwen2.5:7b',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrowError(OllamaDownError);

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws OllamaTimeoutError when request times out', async () => {
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const client = new OllamaClient({
      fetchFn: mockFetch as unknown as typeof fetch,
      timeoutMs: 10,
      retryDelayMs: 1,
      maxRetries: 1,
    });

    await expect(
      client.chat({
        model: 'qwen2.5:7b',
        messages: [{ role: 'user', content: 'test' }],
      }),
    ).rejects.toThrowError(OllamaTimeoutError);
  });

  it('top-level chat and embed helper functions work', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          embeddings: [[0.5, 0.5]],
          message: { role: 'assistant', content: 'hello' },
        }),
      } as unknown as Response;
    });

    const chatRes = await chat(
      { model: 'qwen2.5:7b', messages: [{ role: 'user', content: 'hi' }] },
      { fetchFn: mockFetch as unknown as typeof fetch },
    );
    expect(chatRes.message.content).toBe('hello');

    const embedRes = await embed(
      { model: 'nomic-embed-text:latest', input: 'hi' },
      { fetchFn: mockFetch as unknown as typeof fetch },
    );
    expect(embedRes.embedding).toEqual([0.5, 0.5]);
  });
});
