import type {
  AskResponse,
  LectureDetail,
  LectureListItem,
  LectureProgress,
  UploadLectureResponse,
  LecternApiClient,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

export class LecternApi implements LecternApiClient {
  private baseUrl: string;
  private fetch: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
    this.fetch = options.fetchFn ?? window.fetch.bind(window);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers);

    if (options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      let body: unknown = null;
      try {
        body = await response.json();
        if (body && typeof body === 'object' && 'error' in body) {
          errorMessage = String((body as { error: unknown }).error);
        } else if (body && typeof body === 'object' && 'message' in body) {
          errorMessage = String((body as { message: unknown }).message);
        }
      } catch {
        // Body was not JSON
      }
      throw new ApiError(response.status, errorMessage, body);
    }

    return response.json() as Promise<T>;
  }

  /**
   * POST /lectures (multipart upload) -> {id}
   */
  async uploadLecture(file: File | Blob, title?: string): Promise<UploadLectureResponse> {
    const formData = new FormData();
    const filename = file instanceof File ? file.name : (title ? `${title}.webm` : 'recording.webm');
    formData.append('file', file, filename);
    if (title) {
      formData.append('title', title);
    }

    return this.request<UploadLectureResponse>('/lectures', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * GET /lectures -> [{id,title,status,durationSec,createdAt}]
   */
  async getLectures(): Promise<LectureListItem[]> {
    return this.request<LectureListItem[]>('/lectures');
  }

  /**
   * GET /lectures/:id -> {id,title,status,transcript:[{start,end,text}],summary,keyTerms:[{term,definition}],flashcards:[{question,answer}]}
   */
  async getLecture(id: string): Promise<LectureDetail> {
    return this.request<LectureDetail>(`/lectures/${encodeURIComponent(id)}`);
  }

  /**
   * GET /lectures/:id/progress -> {status,percent}; status is one of converting|transcribing|embedding|summarizing|flashcards|done|failed
   */
  async getLectureProgress(id: string): Promise<LectureProgress> {
    return this.request<LectureProgress>(`/lectures/${encodeURIComponent(id)}/progress`);
  }

  /**
   * POST /ask {question} -> {answer,citations:[{lectureId,lectureTitle,start}]}
   */
  async ask(question: string): Promise<AskResponse> {
    return this.request<AskResponse>('/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }
}

export const createApiClient = (options?: ApiClientOptions): LecternApiClient => {
  return new LecternApi(options);
};
