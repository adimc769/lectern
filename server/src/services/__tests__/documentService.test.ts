import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  DOCUMENT_MAX_BYTES,
  YieldError,
  documentService,
  resolveDocType,
} from '../documentService.js';
import type { ExtractedPage } from '../documentService.js';

vi.mock('../documentPipeline.js', () => ({
  documentPipeline: {
    startPipeline: vi.fn(),
    getProgress: vi.fn(),
    runPipeline: vi.fn(),
  },
}));

vi.mock('../../db.js', () => ({
  prisma: {
    document: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    documentPage: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    documentChunk: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mocked modules must be imported after vi.mock is hoisted.
import { documentRouter } from '../../routes/documentRoutes.js';
import { documentPipeline } from '../documentPipeline.js';
import { prisma } from '../../db.js';
import { CONFIG } from '../../config.js';

// Resolved from the process working directory so the file also compiles to
// CommonJS (server tsconfig has no "type": "module", so import.meta is off-limits).
function fixturesDir(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'services', '__tests__', 'fixtures'),
    path.join(process.cwd(), 'server', 'src', 'services', '__tests__', 'fixtures'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('document fixtures directory not found');
  }
  return found;
}

function readFixture(name: string): Buffer {
  return fs.readFileSync(path.join(fixturesDir(), name));
}

function words(count: number, stem: string): string {
  return Array.from({ length: count }, (_, i) => `${stem}_${i}`).join(' ');
}

describe('DocumentService', () => {
  describe('resolveDocType', () => {
    it('maps the allowlist extensions to document types', () => {
      expect(resolveDocType('.pdf')).toBe('PDF');
      expect(resolveDocType('.docx')).toBe('DOCX');
      expect(resolveDocType('.txt')).toBe('TXT');
    });

    it('is case-insensitive and tolerates a missing leading dot', () => {
      expect(resolveDocType('.PDF')).toBe('PDF');
      expect(resolveDocType('DOCX')).toBe('DOCX');
      expect(resolveDocType('Txt')).toBe('TXT');
    });

    it('rejects anything outside the allowlist', () => {
      expect(resolveDocType('.doc')).toBeNull();
      expect(resolveDocType('.exe')).toBeNull();
      expect(resolveDocType('.mp3')).toBeNull();
      expect(resolveDocType('')).toBeNull();
    });

    it('caps uploads at 25MB', () => {
      expect(DOCUMENT_MAX_BYTES).toBe(25 * 1024 * 1024);
    });
  });

  describe('TXT extraction', () => {
    it('extracts fixture notes with detected sections', async () => {
      const pages = await documentService.extractFromBuffer(readFixture('notes.txt'), 'TXT');
      expect(pages.length).toBeGreaterThanOrEqual(1);
      expect(pages[0].pageNo).toBe(1);
      const allText = pages.map((p) => p.text).join('\n');
      expect(allText).toContain('basic unit of life');
      const allSections = pages.flatMap((p) => p.sections);
      expect(allSections).toContain('CHAPTER 1: CELL STRUCTURE');
    });

    it('returns empty sections for prose with no heading-like lines', async () => {
      const prose = `${words(40, 'plain')}\n\n${words(40, 'prose')}\n`;
      const pages = await documentService.extractFromBuffer(Buffer.from(prose, 'utf-8'), 'TXT');
      expect(pages.length).toBeGreaterThanOrEqual(1);
      for (const page of pages) {
        expect(page.sections).toEqual([]);
      }
    });
  });

  describe('PDF extraction', () => {
    it('extracts both pages of the fixture PDF with page numbers', async () => {
      const pages = await documentService.extractFromBuffer(readFixture('sample.pdf'), 'PDF');
      expect(pages).toHaveLength(2);
      expect(pages[0].pageNo).toBe(1);
      expect(pages[1].pageNo).toBe(2);
      expect(pages[0].text).toContain('Photosynthesis');
      expect(pages[1].text).toContain('Respiration');
      for (const page of pages) {
        expect(Array.isArray(page.sections)).toBe(true);
      }
    });

    it('maps encrypted PDFs to the ENCRYPTED yield cause', async () => {
      await expect(
        documentService.extractFromBuffer(readFixture('encrypted.pdf'), 'PDF'),
      ).rejects.toMatchObject({ name: 'YieldError', cause: 'ENCRYPTED' });
    });
  });

  describe('DOCX extraction', () => {
    it('extracts raw text and style-mapped headings from the fixture', async () => {
      const pages = await documentService.extractFromBuffer(readFixture('sample.docx'), 'DOCX');
      expect(pages.length).toBeGreaterThanOrEqual(1);
      const allText = pages.map((p) => p.text).join('\n');
      expect(allText).toContain('basic unit of life');
      const allSections = pages.flatMap((p) => p.sections);
      expect(allSections).toContain('Study Guide: Cell Biology');
      expect(allSections).toContain('Mitosis and Meiosis');
    });
  });

  describe('yield-gate', () => {
    it('rejects empty buffers as EMPTY', () => {
      expect(() => documentService.assertYield([], 'TXT', 0)).toThrow(YieldError);
      try {
        documentService.assertYield([{ pageNo: 1, text: '', sections: [] }], 'TXT', 0);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(YieldError);
        expect((err as YieldError).cause).toBe('EMPTY');
      }
    });

    it('rejects whitespace-only text as EMPTY', () => {
      const pages: ExtractedPage[] = [{ pageNo: 1, text: '   \n\n  \t ', sections: [] }];
      expect(() => documentService.assertYield(pages, 'DOCX', 2048)).toThrowError(YieldError);
      try {
        documentService.assertYield(pages, 'DOCX', 2048);
      } catch (err) {
        expect((err as YieldError).cause).toBe('EMPTY');
      }
    });

    it('flags sizable PDFs with no text as SCANNED', () => {
      const pages: ExtractedPage[] = [
        { pageNo: 1, text: '', sections: [] },
        { pageNo: 2, text: '  ', sections: [] },
      ];
      try {
        documentService.assertYield(pages, 'PDF', 50000);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(YieldError);
        expect((err as YieldError).cause).toBe('SCANNED');
        expect((err as Error).message).toMatch(/scanned/i);
      }
    });

    it('passes documents that contain readable text', () => {
      const pages: ExtractedPage[] = [{ pageNo: 1, text: 'Real content here.', sections: [] }];
      expect(() => documentService.assertYield(pages, 'PDF', 50000)).not.toThrow();
    });
  });

  describe('chunkDocumentPages', () => {
    it('carries pageNo and section into chunks', () => {
      const pages: ExtractedPage[] = [
        { pageNo: 1, text: `Intro\n\n${words(30, 'alpha')}`, sections: ['Intro'] },
        { pageNo: 2, text: words(30, 'beta'), sections: [] },
      ];

      const chunks = documentService.chunkDocumentPages(pages, {
        targetWords: 20,
        overlapWords: 0,
      });

      expect(chunks).toHaveLength(2);
      expect(chunks[0].pageNo).toBe(1);
      expect(chunks[0].section).toBe('Intro');
      expect(chunks[0].text).toContain('alpha_0');
      expect(chunks[1].pageNo).toBe(2);
      expect(chunks[1].section).toBe('Page 2');
      expect(chunks[1].text).toContain('beta_0');
    });

    it('returns no chunks for empty pages', () => {
      expect(documentService.chunkDocumentPages([])).toEqual([]);
      expect(
        documentService.chunkDocumentPages([{ pageNo: 1, text: '   ', sections: [] }]),
      ).toEqual([]);
    });
  });
});

describe('Document routes validation', () => {
  let server: import('node:http').Server;
  let baseUrl: string;
  let uploadsDir: string;
  const originalUploadsDir = CONFIG.UPLOADS_DIR;

  const docCreate = () => prisma.document.create as unknown as ReturnType<typeof vi.fn>;
  const docFindMany = () => prisma.document.findMany as unknown as ReturnType<typeof vi.fn>;
  const docFindUnique = () => prisma.document.findUnique as unknown as ReturnType<typeof vi.fn>;
  const docDelete = () => prisma.document.delete as unknown as ReturnType<typeof vi.fn>;
  const startPipeline = () => documentPipeline.startPipeline as unknown as ReturnType<typeof vi.fn>;
  const getProgress = () => documentPipeline.getProgress as unknown as ReturnType<typeof vi.fn>;

  function docRow(overrides: Record<string, unknown> = {}) {
    const now = new Date('2026-01-01T00:00:00.000Z');
    return {
      id: 'doc-1',
      title: 'Test Doc',
      docType: 'TXT',
      status: 'PROCESSING',
      filePath: 'C:\\uploads\\test.txt',
      pageCount: 1,
      error: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  async function postFile(name: string, buffer: Buffer, title?: string) {
    const form = new FormData();
    // Buffer is a Uint8Array at runtime; the cast satisfies the DOM BlobPart type.
    form.append('file', new File([buffer as unknown as Uint8Array<ArrayBuffer>], name));
    if (title !== undefined) {
      form.append('title', title);
    }
    const res = await fetch(`${baseUrl}/api/documents`, { method: 'POST', body: form });
    const body = (await res.json()) as Record<string, unknown>;
    return { res, body };
  }

  beforeAll(async () => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lectern-doc-test-'));
    CONFIG.UPLOADS_DIR = uploadsDir;

    const app = express();
    app.use(express.json());
    app.use('/api/documents', documentRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    CONFIG.UPLOADS_DIR = originalUploadsDir;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const entry of fs.readdirSync(uploadsDir)) {
      try {
        fs.unlinkSync(path.join(uploadsDir, entry));
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it('rejects extensions outside the allowlist with 400 and persists nothing', async () => {
    const { res, body } = await postFile('malware.exe', Buffer.from('MZ fake binary', 'utf-8'));

    expect(res.status).toBe(400);
    expect(String(body.error)).toMatch(/PDF.*docx.*txt/i);
    expect(docCreate()).not.toHaveBeenCalled();
  });

  it('rejects files over 25MB with 400', async () => {
    const big = Buffer.alloc(26 * 1024 * 1024, 'a');
    const { res, body } = await postFile('huge.pdf', big);

    expect(res.status).toBe(400);
    expect(String(body.error)).toMatch(/25 MB/);
    expect(docCreate()).not.toHaveBeenCalled();
  });

  it('rejects unextractable uploads with 400 and persists nothing', async () => {
    const { res, body } = await postFile('blank.txt', readFixture('empty.txt'));

    expect(res.status).toBe(400);
    expect(String(body.error).length).toBeGreaterThan(0);
    expect(docCreate()).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only pasted notes with 400', async () => {
    const res = await fetch(`${baseUrl}/api/documents/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Empty notes', text: '   \n\t  ' }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(String(body.error)).toMatch(/empty/i);
    expect(docCreate()).not.toHaveBeenCalled();
  });

  it('creates a document from pasted text with 201 { id, status }', async () => {
    docCreate().mockResolvedValue(docRow({ id: 'doc-text-1', title: 'My Notes' }));

    const res = await fetch(`${baseUrl}/api/documents/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Notes', text: 'Mitochondria release energy from glucose.' }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: 'doc-text-1', status: 'PROCESSING' });
    expect(startPipeline()).toHaveBeenCalledWith('doc-text-1');
  });

  it('creates a document from upload with 201 { id, status }', async () => {
    docCreate().mockResolvedValue(docRow({ id: 'doc-up-1' }));

    const { res, body } = await postFile('notes.txt', readFixture('notes.txt'), 'Lecture Notes');

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: 'doc-up-1', status: 'PROCESSING' });
    expect(startPipeline()).toHaveBeenCalledWith('doc-up-1');
  });

  it('lists documents without pages', async () => {
    docFindMany().mockResolvedValue([docRow(), docRow({ id: 'doc-2' })]);

    const res = await fetch(`${baseUrl}/api/documents`);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty('pages');
    expect(body[0].id).toBe('doc-1');
  });

  it('returns 404 for an unknown document id', async () => {
    docFindUnique().mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/documents/missing`);
    expect(res.status).toBe(404);
  });

  it('returns a document with pages', async () => {
    docFindUnique().mockResolvedValue({
      ...docRow(),
      pages: [{ pageNo: 1, text: 'Cell content.', sectionsJson: JSON.stringify(['Intro']) }],
    });

    const res = await fetch(`${baseUrl}/api/documents/doc-1`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.pages).toEqual([{ pageNo: 1, text: 'Cell content.', sections: ['Intro'] }]);
  });

  it('reports PROCESSING progress', async () => {
    getProgress().mockResolvedValue({
      lectureId: 'doc-1',
      stage: 'PROCESSING',
      progressPercent: 45,
      message: 'Extracting text from document',
    });

    const res = await fetch(`${baseUrl}/api/documents/doc-1/progress`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.stage).toBe('PROCESSING');
    expect(body.progressPercent).toBe(45);
  });

  it('deletes a document and removes its file best-effort', async () => {
    const stored = path.join(uploadsDir, 'doomed.txt');
    fs.writeFileSync(stored, 'doomed content', 'utf-8');
    docFindUnique().mockResolvedValue(docRow({ filePath: stored }));
    docDelete().mockResolvedValue(docRow());

    const res = await fetch(`${baseUrl}/api/documents/doc-1`, { method: 'DELETE' });
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(fs.existsSync(stored)).toBe(false);
  });

  it('returns 404 when deleting an unknown document', async () => {
    docFindUnique().mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/documents/missing`, { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(docDelete()).not.toHaveBeenCalled();
  });
});
