import type {
  DocumentDTO,
  DocumentPageDTO,
  DocumentStatus,
  DocumentType,
  JobProgressDTO,
} from '@lectern/shared';
import { BackendUnreachableError, notifyBackendFallback } from './api';

/** Shared document contracts, re-exported beside the fetch helpers. */
export type { DocumentDTO, DocumentPageDTO, DocumentStatus, DocumentType };

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object') {
      const err = (data as { error?: unknown }).error;
      if (typeof err === 'string' && err.trim().length > 0) return err;
    }
  } catch {
    // ignore parse error — fall through to the status fallback below
  }
  return `${fallback} (status ${res.status})`;
}

/**
 * Uploads a single document file with an optional title.
 * Resolves with the new { id, status }; throws explicit errors, never fake data.
 */
export async function uploadDocument(
  file: File,
  title?: string
): Promise<{ id: string; status: string }> {
  let res: Response;
  try {
    const formData = new FormData();
    formData.append('file', file, file.name);
    if (title && title.trim().length > 0) formData.append('title', title.trim());
    res = await fetch('/api/documents', { method: 'POST', body: formData });
  } catch {
    notifyBackendFallback('Document service unreachable — your file was not stored');
    throw new BackendUnreachableError(
      '/api/documents',
      'Document service unreachable — your file was not stored. Check that the backend is running and try again.'
    );
  }

  if (res.status === 201) {
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string') {
        const { id, status } = data as { id: string; status: string };
        return { id, status };
      }
    } catch {
      // fall through to the shape error below
    }
    throw new Error('Document upload returned an unexpected response shape (missing { id })');
  }

  throw new Error(await readErrorMessage(res, 'Document upload failed'));
}

/**
 * Creates a TXT-equivalent document source from pasted plain-text notes.
 * Resolves with the new { id, status }; throws explicit errors, never fake data.
 */
export async function createTextDocument(
  title: string,
  text: string
): Promise<{ id: string; status: string }> {
  let res: Response;
  try {
    res = await fetch('/api/documents/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, text }),
    });
  } catch {
    notifyBackendFallback('Document service unreachable — your notes were not stored');
    throw new BackendUnreachableError(
      '/api/documents/text',
      'Document service unreachable — your notes were not stored. Check that the backend is running and try again.'
    );
  }

  if (res.status === 201) {
    try {
      const data: unknown = await res.json();
      if (data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string') {
        const { id, status } = data as { id: string; status: string };
        return { id, status };
      }
    } catch {
      // fall through to the shape error below
    }
    throw new Error('Document creation returned an unexpected response shape (missing { id })');
  }

  throw new Error(await readErrorMessage(res, 'Document creation failed'));
}

/**
 * Fetches the document library (no page bodies).
 * Throws BackendUnreachableError on transport failure, never silent fake data.
 */
export async function fetchDocuments(): Promise<DocumentDTO[]> {
  let res: Response;
  try {
    res = await fetch('/api/documents', { cache: 'no-store' });
  } catch {
    notifyBackendFallback('Document service unreachable — showing lectures only');
    throw new BackendUnreachableError(
      '/api/documents',
      'Document service unreachable — could not load documents.'
    );
  }

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Could not load documents'));
  }

  try {
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data as DocumentDTO[];
  } catch {
    // fall through to the shape error below
  }
  throw new Error('Documents returned an unexpected response shape (expected an array)');
}

/**
 * Fetches one document with its extracted pages.
 * Throws BackendUnreachableError on transport failure, never silent fake data.
 */
export async function fetchDocument(id: string): Promise<DocumentDTO> {
  if (!id || id.trim().length === 0) {
    throw new Error('Document id is required.');
  }

  let res: Response;
  try {
    res = await fetch(`/api/documents/${encodeURIComponent(id)}`, { cache: 'no-store' });
  } catch {
    notifyBackendFallback('Document service unreachable — could not load this document');
    throw new BackendUnreachableError(
      `/api/documents/${id}`,
      'Document service unreachable — could not load this document.'
    );
  }

  if (res.status === 404) {
    throw new Error(`Document with id "${id}" not found.`);
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Could not load this document'));
  }

  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string') {
      return data as DocumentDTO;
    }
  } catch {
    // fall through to the shape error below
  }
  throw new Error('Document returned an unexpected response shape (missing { id })');
}

/**
 * Polls document extraction progress.
 * Throws BackendUnreachableError on transport failure so callers keep polling honestly.
 */
export async function fetchDocumentProgress(id: string): Promise<JobProgressDTO> {
  let res: Response;
  try {
    res = await fetch(`/api/documents/${encodeURIComponent(id)}/progress`, {
      cache: 'no-store',
    });
  } catch {
    throw new BackendUnreachableError(
      `/api/documents/${id}/progress`,
      'Document progress unreachable — still waiting for the backend.'
    );
  }

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Could not load document progress'));
  }

  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && typeof (data as { stage?: unknown }).stage === 'string') {
      return data as JobProgressDTO;
    }
  } catch {
    // fall through to the shape error below
  }
  throw new Error('Document progress returned an unexpected response shape (missing { stage })');
}
