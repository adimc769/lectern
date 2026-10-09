export interface OllamaClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetchFn?: typeof fetch;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  format?: 'json' | Record<string, unknown>;
  keepAlive?: string | number;
}

export interface ChatResponse {
  message: {
    role: string;
    content: string;
  };
  model: string;
  done?: boolean;
  total_duration?: number;
}

export interface EmbedParams {
  model: string;
  input: string | string[];
  keepAlive?: string | number;
}

export interface EmbedResponse {
  embedding: number[];
  embeddings: number[][];
  model?: string;
}

export class OllamaError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OllamaError';
  }
}

export class OllamaDownError extends OllamaError {
  constructor(baseUrl: string, cause?: unknown) {
    super(`Ollama is down or unreachable at ${baseUrl}. Ensure Ollama is running on your machine.`, cause);
    this.name = 'OllamaDownError';
  }
}

export class OllamaModelNotFoundError extends OllamaError {
  constructor(model: string, detail?: string) {
    super(`Ollama model "${model}" is not installed or pulled. Run \`ollama pull ${model}\` to download it.${detail ? ` Detail: ${detail}` : ''}`);
    this.name = 'OllamaModelNotFoundError';
  }
}

export class OllamaTimeoutError extends OllamaError {
  constructor(timeoutMs: number) {
    super(`Ollama request timed out after ${timeoutMs}ms.`);
    this.name = 'OllamaTimeoutError';
  }
}

export class OllamaClient {
  public readonly baseUrl: string;
  public readonly timeoutMs: number;
  public readonly maxRetries: number;
  public readonly retryDelayMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 100;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isConnectionError(err: unknown): boolean {
    if (!err) return false;
    const msg = String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch') || msg.includes('fetch failed')) {
      return true;
    }
    if (typeof err === 'object' && err !== null && 'cause' in err) {
      const cause = (err as { cause?: unknown }).cause;
      if (cause && typeof cause === 'object' && 'code' in cause) {
        const code = String((cause as { code?: unknown }).code);
        if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
          return true;
        }
      }
    }
    return false;
  }

  private async executeWithRetry<T>(
    endpoint: string,
    body: Record<string, unknown>,
    model: string,
  ): Promise<T> {
    let lastError: unknown;
    const totalAttempts = this.maxRetries + 1;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      const controller = new AbortController();
      let didTimeout = false;
      const timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, this.timeoutMs);

      try {
        const response = await this.fetchFn(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          let errorText = '';
          try {
            const errJson = (await response.json()) as { error?: string };
            errorText = errJson.error ?? JSON.stringify(errJson);
          } catch {
            errorText = await response.text();
          }

          if (
            response.status === 404 ||
            errorText.toLowerCase().includes('not found') ||
            errorText.toLowerCase().includes('pull')
          ) {
            throw new OllamaModelNotFoundError(model, errorText);
          }

          // 5xx errors can be retried
          if (response.status >= 500 && attempt < totalAttempts) {
            lastError = new OllamaError(`Server returned status ${response.status}: ${errorText}`);
            await this.sleep(this.retryDelayMs * attempt);
            continue;
          }

          throw new OllamaError(`Ollama request failed with status ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as T;
        return data;
      } catch (err) {
        clearTimeout(timer);

        if (err instanceof OllamaModelNotFoundError) {
          throw err;
        }

        if (didTimeout || (err instanceof Error && err.name === 'AbortError')) {
          lastError = new OllamaTimeoutError(this.timeoutMs);
          if (attempt < totalAttempts) {
            await this.sleep(this.retryDelayMs * attempt);
            continue;
          }
          throw lastError;
        }

        lastError = err;
        if (attempt < totalAttempts) {
          await this.sleep(this.retryDelayMs * attempt);
          continue;
        }
      }
    }

    if (this.isConnectionError(lastError)) {
      throw new OllamaDownError(this.baseUrl, lastError);
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new OllamaError(String(lastError), lastError);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const payload: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      stream: false,
    };

    if (params.format !== undefined) {
      payload.format = params.format;
    }

    if (params.keepAlive !== undefined) {
      payload.keep_alive = params.keepAlive;
    }

    const data = await this.executeWithRetry<{
      message: { role: string; content: string };
      model: string;
      done?: boolean;
      total_duration?: number;
    }>('/api/chat', payload, params.model);

    return data;
  }

  async embed(params: EmbedParams): Promise<EmbedResponse> {
    const payload: Record<string, unknown> = {
      model: params.model,
      input: params.input,
    };

    if (params.keepAlive !== undefined) {
      payload.keep_alive = params.keepAlive;
    }

    interface RawEmbedResponse {
      embeddings?: number[][];
      embedding?: number[];
      model?: string;
    }

    const data = await this.executeWithRetry<RawEmbedResponse>('/api/embed', payload, params.model);

    if (Array.isArray(data.embeddings) && data.embeddings.length > 0) {
      return {
        embedding: data.embeddings[0],
        embeddings: data.embeddings,
        model: data.model ?? params.model,
      };
    }

    if (Array.isArray(data.embedding)) {
      return {
        embedding: data.embedding,
        embeddings: [data.embedding],
        model: data.model ?? params.model,
      };
    }

    return {
      embedding: [],
      embeddings: [],
      model: data.model ?? params.model,
    };
  }
}

export const defaultOllamaClient = new OllamaClient();

export async function chat(
  params: ChatParams,
  options?: OllamaClientOptions,
): Promise<ChatResponse> {
  const client = options ? new OllamaClient(options) : defaultOllamaClient;
  return client.chat(params);
}

export async function embed(
  params: EmbedParams,
  options?: OllamaClientOptions,
): Promise<EmbedResponse> {
  const client = options ? new OllamaClient(options) : defaultOllamaClient;
  return client.embed(params);
}
