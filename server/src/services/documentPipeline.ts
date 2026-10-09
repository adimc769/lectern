import fs from 'node:fs';
import { prisma } from '../db.js';
import { documentService } from './documentService.js';
import { embeddingService } from './embeddingService.js';
import type { JobProgressDTO, PipelineStage } from '@lectern/shared';

export class DocumentPipeline {
  private progressMap = new Map<string, JobProgressDTO>();

  /**
   * Returns current progress for a given document.
   * Note: JobProgressDTO.lectureId carries the document id (shared DTO reuse).
   */
  async getProgress(documentId: string): Promise<JobProgressDTO> {
    const memory = this.progressMap.get(documentId);
    if (memory) {
      return memory;
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
      return {
        lectureId: documentId,
        stage: 'IDLE',
        progressPercent: 0,
        message: 'Document not found',
      };
    }

    if (document.status === 'COMPLETED') {
      return {
        lectureId: documentId,
        stage: 'COMPLETED',
        progressPercent: 100,
        message: 'Document processing completed successfully',
      };
    }

    if (document.status === 'FAILED') {
      return {
        lectureId: documentId,
        stage: 'FAILED',
        progressPercent: 0,
        message: document.error || 'Processing failed',
      };
    }

    return {
      lectureId: documentId,
      stage: 'PROCESSING',
      progressPercent: 50,
      message: 'Processing in progress',
    };
  }

  private updateProgress(
    documentId: string,
    stage: PipelineStage,
    progressPercent: number,
    message: string,
    error?: string,
  ): void {
    const dto: JobProgressDTO = {
      lectureId: documentId,
      stage,
      progressPercent,
      message,
      ...(error ? { error } : {}),
    };
    this.progressMap.set(documentId, dto);
  }

  /**
   * Coordinates the full background document pipeline. Never throws unhandled errors.
   * Pre-validation (type/size/yield) already ran during intake; failures here
   * (missing file, embedding service down, DB errors) mark the row FAILED.
   */
  async runPipeline(documentId: string): Promise<void> {
    try {
      const document = await prisma.document.findUnique({ where: { id: documentId } });
      if (!document) {
        throw new Error('Document not found');
      }

      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING', error: null },
      });

      // Stage 1: Reading (15)
      this.updateProgress(documentId, 'PROCESSING', 15, 'Reading document from storage');
      if (!fs.existsSync(document.filePath)) {
        throw new Error('Document file is missing from storage');
      }
      const buffer = await fs.promises.readFile(document.filePath);
      const docType = document.docType as 'PDF' | 'DOCX' | 'TXT';

      // Stage 2: Extracting (45)
      this.updateProgress(documentId, 'PROCESSING', 45, 'Extracting text from document');
      const pages = await documentService.extractFromBuffer(buffer, docType);
      documentService.assertYield(pages, docType, buffer.length);

      await prisma.documentPage.deleteMany({ where: { documentId } });
      for (const page of pages) {
        await prisma.documentPage.create({
          data: {
            documentId,
            pageNo: page.pageNo,
            text: page.text,
            sectionsJson: JSON.stringify(page.sections),
          },
        });
      }
      await prisma.document.update({
        where: { id: documentId },
        data: { pageCount: pages.length },
      });

      // Stage 3: Chunking (70)
      this.updateProgress(documentId, 'PROCESSING', 70, 'Chunking document with overlap');
      const chunks = documentService.chunkDocumentPages(pages);

      // Stage 4: Embedding (90) — sequential per-chunk, mirroring lecture pipeline style
      this.updateProgress(documentId, 'PROCESSING', 90, 'Generating nomic-embed-text embeddings');
      await prisma.documentChunk.deleteMany({ where: { documentId } });
      for (const [idx, chunk] of chunks.entries()) {
        const embedding = await embeddingService.getEmbedding(chunk.text);
        await prisma.documentChunk.create({
          data: {
            id: `${documentId}-chunk-${idx + 1}`,
            documentId,
            pageNo: chunk.pageNo,
            section: chunk.section,
            text: chunk.text,
            embeddingJson: JSON.stringify(embedding),
          },
        });
      }

      // Stage 5: Completed (100)
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED', error: null },
      });

      this.updateProgress(documentId, 'COMPLETED', 100, 'Processing completed successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Document Pipeline Error] Document ${documentId} failed:`, errorMsg);

      await prisma.document
        .update({
          where: { id: documentId },
          data: { status: 'FAILED', error: errorMsg },
        })
        .catch(() => {});

      this.updateProgress(documentId, 'FAILED', 0, 'Processing failed', errorMsg);
    }
  }

  /**
   * Starts document processing asynchronously in the background.
   */
  startPipeline(documentId: string): void {
    queueMicrotask(() => {
      void this.runPipeline(documentId);
    });
  }
}

export const documentPipeline = new DocumentPipeline();
