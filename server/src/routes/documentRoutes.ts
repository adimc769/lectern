import { Router } from 'express';
import fs from 'node:fs';
import multer from 'multer';
import path from 'node:path';
import { prisma } from '../db.js';
import { CONFIG } from '../config.js';
import { documentPipeline } from '../services/documentPipeline.js';
import {
  DOCUMENT_MAX_BYTES,
  YieldError,
  documentService,
  resolveDocType,
} from '../services/documentService.js';
import type { DocumentDTO } from '@lectern/shared';

function toPublicFilePath(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('/uploads/')) return filePath;
  return `/uploads/${path.basename(filePath)}`;
}

function parseSections(sectionsJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(sectionsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

function removeFileBestEffort(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup errors
  }
}

type DocumentRow = {
  id: string;
  title: string;
  docType: string;
  status: string;
  filePath: string;
  pageCount: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DocumentPageRow = {
  pageNo: number;
  text: string;
  sectionsJson: string;
};

function toDocumentDTO(row: DocumentRow, pages?: DocumentPageRow[]): DocumentDTO {
  return {
    id: row.id,
    title: row.title,
    docType: row.docType as DocumentDTO['docType'],
    status: row.status as DocumentDTO['status'],
    filePath: toPublicFilePath(row.filePath),
    pageCount: row.pageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.error ? { error: row.error } : {}),
    ...(pages
      ? {
          pages: pages.map((p) => ({
            pageNo: p.pageNo,
            text: p.text,
            sections: parseSections(p.sectionsJson),
          })),
        }
      : {}),
  };
}

export const documentRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CONFIG.UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: DOCUMENT_MAX_BYTES }, // 25MB
});

// POST new document (multipart upload). All validation runs BEFORE any DB row
// is created; rejected uploads leave no row behind (temp file removed best-effort).
documentRouter.post('/', (req, res) => {
  upload.single('file')(req, res, async (multerErr: unknown) => {
    try {
      if (multerErr) {
        if (multerErr instanceof multer.MulterError && multerErr.code === 'LIMIT_FILE_SIZE') {
          res
            .status(400)
            .json({ error: 'File is too large. Documents must be 25 MB or smaller.' });
          return;
        }
        throw multerErr;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No document file provided in multipart upload' });
        return;
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      const docType = resolveDocType(ext);
      if (!docType) {
        removeFileBestEffort(req.file.path);
        res.status(400).json({
          error: 'Unsupported file type. Upload a PDF (.pdf), Word (.docx), or text (.txt) file.',
        });
        return;
      }

      if (req.file.size > DOCUMENT_MAX_BYTES) {
        removeFileBestEffort(req.file.path);
        res.status(400).json({ error: 'File is too large. Documents must be 25 MB or smaller.' });
        return;
      }

      const buffer = await fs.promises.readFile(req.file.path);
      let pages;
      try {
        pages = await documentService.extractFromBuffer(buffer, docType);
        documentService.assertYield(pages, docType, buffer.length);
      } catch (yieldErr) {
        removeFileBestEffort(req.file.path);
        if (yieldErr instanceof YieldError) {
          res.status(400).json({ error: yieldErr.message, cause: yieldErr.cause });
          return;
        }
        throw yieldErr;
      }

      const title =
        (req.body.title as string | undefined)?.trim() ||
        path.parse(req.file.originalname).name ||
        'Untitled Document';

      const created = await prisma.document.create({
        data: {
          title,
          docType,
          filePath: req.file.path,
          status: 'PROCESSING',
          pageCount: pages.length,
          pages: {
            create: pages.map((p) => ({
              pageNo: p.pageNo,
              text: p.text,
              sectionsJson: JSON.stringify(p.sections),
            })),
          },
        },
      });

      // Start background processing pipeline
      documentPipeline.startPipeline(created.id);

      res.status(201).json({ id: created.id, status: created.status });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to create document upload', details: msg });
    }
  });
});

// POST pasted notes as a TXT document (JSON { title, text })
documentRouter.post('/text', async (req, res) => {
  try {
    const { title, text } = req.body as { title?: unknown; text?: unknown };

    if (typeof text !== 'string' || text.trim().length === 0) {
      res
        .status(400)
        .json({ error: 'Notes text is empty. Paste or type some text to create a document.' });
      return;
    }

    const cleanTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Untitled Notes';

    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.txt`;
    const filePath = path.join(CONFIG.UPLOADS_DIR, fileName);
    await fs.promises.writeFile(filePath, text, 'utf-8');

    const buffer = Buffer.from(text, 'utf-8');
    let pages;
    try {
      pages = await documentService.extractFromBuffer(buffer, 'TXT');
      documentService.assertYield(pages, 'TXT', buffer.length);
    } catch (yieldErr) {
      removeFileBestEffort(filePath);
      if (yieldErr instanceof YieldError) {
        res.status(400).json({ error: yieldErr.message, cause: yieldErr.cause });
        return;
      }
      throw yieldErr;
    }

    const created = await prisma.document.create({
      data: {
        title: cleanTitle,
        docType: 'TXT',
        filePath,
        status: 'PROCESSING',
        pageCount: pages.length,
        pages: {
          create: pages.map((p) => ({
            pageNo: p.pageNo,
            text: p.text,
            sectionsJson: JSON.stringify(p.sections),
          })),
        },
      },
    });

    // Start background processing pipeline
    documentPipeline.startPipeline(created.id);

    res.status(201).json({ id: created.id, status: created.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to create document from text', details: msg });
  }
});

// GET document processing progress
documentRouter.get('/:id/progress', async (req, res) => {
  try {
    const progress = await documentPipeline.getProgress(req.params.id);
    res.json(progress);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to retrieve progress', details: msg });
  }
});

// GET all documents (without pages)
documentRouter.get('/', async (_req, res) => {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(documents.map((d) => toDocumentDTO(d)));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to retrieve documents', details: msg });
  }
});

// GET single document with pages
documentRouter.get('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        pages: { orderBy: { pageNo: 'asc' } },
      },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(toDocumentDTO(document, document.pages));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to retrieve document details', details: msg });
  }
});

// DELETE document (cascade deletes pages + chunks; file cleanup best-effort)
documentRouter.delete('/:id', async (req, res) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    await prisma.document.delete({
      where: { id: req.params.id },
    });

    removeFileBestEffort(document.filePath);

    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to delete document', details: msg });
  }
});
