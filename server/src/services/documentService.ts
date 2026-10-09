import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { extractText } from 'unpdf';
import type { DocumentType } from '@lectern/shared';

export type YieldCause = 'EMPTY' | 'SCANNED' | 'ENCRYPTED';

export class YieldError extends Error {
  readonly cause: YieldCause;

  constructor(cause: YieldCause, message: string) {
    super(message);
    this.name = 'YieldError';
    this.cause = cause;
  }
}

export interface ExtractedPage {
  pageNo: number;
  text: string;
  sections: string[];
}

export interface DocumentChunkInput {
  pageNo: number;
  section: string | null;
  text: string;
}

export interface ChunkingOptions {
  targetWords?: number;
  overlapWords?: number;
}

export const DOCUMENT_ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'] as const;

export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

const WORDS_PER_PAGE = 500;
const MAX_SECTIONS_PER_PAGE = 8;

/**
 * Resolves a file extension (with or without leading dot) to a DocumentType.
 * Returns null when the extension is not in the allowlist.
 */
export function resolveDocType(ext: string): DocumentType | null {
  const normalized = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  if (normalized === '.pdf') return 'PDF';
  if (normalized === '.docx') return 'DOCX';
  if (normalized === '.txt') return 'TXT';
  return null;
}

export class DocumentService {
  /**
   * Extracts per-page text from an in-memory file buffer.
   * Never fabricates headings: pages carry [] when no heading-like lines exist.
   */
  async extractFromBuffer(buffer: Buffer, docType: DocumentType): Promise<ExtractedPage[]> {
    if (docType === 'PDF') {
      return this.extractPdf(buffer);
    }
    if (docType === 'DOCX') {
      return this.extractDocx(buffer);
    }
    return this.extractTxt(buffer);
  }

  /**
   * Reads a file from disk and extracts per-page text.
   */
  async extractFromFile(filePath: string, docType: DocumentType): Promise<ExtractedPage[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Document file does not exist: ${filePath}`);
    }
    const buffer = await fs.promises.readFile(filePath);
    return this.extractFromBuffer(buffer, docType);
  }

  /**
   * Yield-gate: throws YieldError when extraction produced no usable text.
   * Call BEFORE creating any DB row so rejected uploads persist nothing.
   */
  assertYield(pages: ExtractedPage[], docType: DocumentType, rawBytes = 0): void {
    const totalText = pages
      .map((p) => p.text)
      .join('')
      .trim();
    if (totalText.length > 0) {
      return;
    }

    if (docType === 'PDF') {
      if (rawBytes > 1024 && pages.length > 0) {
        throw new YieldError(
          'SCANNED',
          'This PDF appears to be a scanned document with no selectable text. ' +
            'Upload a text-based PDF or paste the notes as text instead.',
        );
      }
      throw new YieldError(
        'EMPTY',
        'The PDF contains no readable text. Upload a file with selectable text and try again.',
      );
    }

    throw new YieldError(
      'EMPTY',
      'The document contains no readable text. Upload a file with selectable text and try again.',
    );
  }

  /**
   * Chunks extracted pages into ~250-word overlapping chunks (mirroring
   * ChunkingService), carrying pageNo and the nearest preceding section.
   * Chunks with no detected heading fall back to the positional 'Page N' label.
   */
  chunkDocumentPages(
    pages: ExtractedPage[],
    options: ChunkingOptions = {},
  ): DocumentChunkInput[] {
    const units = this.flattenToParagraphUnits(pages);
    if (units.length === 0) {
      return [];
    }

    const targetWords = options.targetWords ?? 250;
    const overlapWords = options.overlapWords ?? 40;

    const chunks: DocumentChunkInput[] = [];
    let startIdx = 0;

    while (startIdx < units.length) {
      let currentWords = 0;
      let endIdx = startIdx;

      while (endIdx < units.length) {
        const paraWords = this.countWords(units[endIdx].text);
        currentWords += paraWords;
        if (currentWords >= targetWords) {
          break;
        }
        if (endIdx + 1 < units.length) {
          endIdx++;
        } else {
          break;
        }
      }

      const slice = units.slice(startIdx, endIdx + 1);
      const text = slice.map((u) => u.text.trim()).join('\n\n');
      const first = slice[0];
      const section = first.section ?? `Page ${first.pageNo}`;

      chunks.push({ pageNo: first.pageNo, section, text });

      if (endIdx >= units.length - 1) {
        break;
      }

      if (overlapWords <= 0) {
        startIdx = endIdx + 1;
      } else {
        let overlapCount = 0;
        let nextStart = endIdx;

        for (let k = endIdx; k > startIdx; k--) {
          const words = this.countWords(units[k].text);
          if (overlapCount + words <= overlapWords || k === endIdx) {
            overlapCount += words;
            nextStart = k;
            if (overlapCount >= overlapWords) {
              break;
            }
          } else {
            break;
          }
        }

        if (nextStart <= startIdx) {
          startIdx = startIdx + 1;
        } else {
          startIdx = nextStart;
        }
      }
    }

    return chunks;
  }

  /**
   * Extracts per-page text from a PDF buffer via unpdf.
   * Encrypted PDFs surface as YieldError with the ENCRYPTED cause.
   */
  private async extractPdf(buffer: Buffer): Promise<ExtractedPage[]> {
    let texts: string[];
    try {
      const result = await extractText(new Uint8Array(buffer), { mergePages: false });
      texts = Array.isArray(result.text) ? result.text : [result.text];
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? '';
      const msg = err instanceof Error ? err.message : String(err);
      if (name === 'PasswordException' || /password|encrypt|decrypt/i.test(msg)) {
        throw new YieldError(
          'ENCRYPTED',
          'This PDF is encrypted or password-protected. Remove the password protection and upload the file again.',
        );
      }
      throw err;
    }

    return texts.map((raw, idx) => {
      const text = (raw ?? '').replace(/\r\n/g, '\n').trim();
      return {
        pageNo: idx + 1,
        text,
        sections: this.detectSections(text),
      };
    });
  }

  /**
   * Extracts text from a DOCX buffer via mammoth extractRawText.
   * Headings come from convertToHtml (h1-h6) where reliable; pages without
   * headings carry [] and chunks fall back to positional section labels.
   */
  private async extractDocx(buffer: Buffer): Promise<ExtractedPage[]> {
    let rawText: string;
    try {
      const raw = await mammoth.extractRawText({ buffer });
      rawText = (raw.value ?? '').replace(/\r\n/g, '\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read Word document: ${msg}`);
    }

    let htmlHeadings: string[] = [];
    try {
      const html = await mammoth.convertToHtml({ buffer });
      htmlHeadings = this.extractHtmlHeadings(html.value ?? '');
    } catch {
      // ignore — heading-line detection on raw text still applies below
    }

    const paragraphs = rawText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      return [{ pageNo: 1, text: '', sections: [] }];
    }

    return this.paginateParagraphs(paragraphs, htmlHeadings);
  }

  /**
   * Passes TXT buffers through with paragraph splits.
   */
  private async extractTxt(buffer: Buffer): Promise<ExtractedPage[]> {
    const rawText = buffer.toString('utf-8').replace(/\r\n/g, '\n');

    const paragraphs = rawText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      const fallback = rawText.trim();
      return [{ pageNo: 1, text: fallback, sections: this.detectSections(fallback) }];
    }

    return this.paginateParagraphs(paragraphs, []);
  }

  /**
   * Groups paragraphs into ~500-word pages, attributing style-mapped HTML
   * headings to the page whose text contains them.
   */
  private paginateParagraphs(paragraphs: string[], htmlHeadings: string[]): ExtractedPage[] {
    const pages: ExtractedPage[] = [];
    let current: string[] = [];
    let currentWords = 0;

    const flush = () => {
      if (current.length === 0) {
        return;
      }
      const text = current.join('\n\n');
      const detected = this.detectSections(text);
      const attributed = htmlHeadings.filter((h) =>
        text.toLowerCase().includes(h.toLowerCase().slice(0, 80)),
      );
      const sections = [...attributed, ...detected.filter((d) => !attributed.includes(d))].slice(
        0,
        MAX_SECTIONS_PER_PAGE,
      );
      pages.push({ pageNo: pages.length + 1, text, sections });
      current = [];
      currentWords = 0;
    };

    for (const para of paragraphs) {
      const words = this.countWords(para);
      if (current.length > 0 && currentWords + words > WORDS_PER_PAGE) {
        flush();
      }
      current.push(para);
      currentWords += words;
    }
    flush();

    return pages.length > 0 ? pages : [{ pageNo: 1, text: '', sections: [] }];
  }

  /**
   * Pulls h1-h6 texts from mammoth HTML output in document order.
   */
  private extractHtmlHeadings(html: string): string[] {
    const headings: string[] = [];
    const re = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const text = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      if (text.length > 0 && text.length <= 200) {
        headings.push(text);
      }
      if (headings.length >= 50) {
        break;
      }
    }
    return headings;
  }

  /**
   * Detects heading-like lines within a page of text. Conservative by design:
   * returns [] when nothing matches — headings are never fabricated.
   */
  private detectSections(pageText: string): string[] {
    const lines = pageText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const sections: string[] = [];
    for (const line of lines) {
      if (sections.length >= MAX_SECTIONS_PER_PAGE) {
        break;
      }
      if (line.length > 80) {
        continue;
      }
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length === 0 || words.length > 10) {
        continue;
      }
      // Skip sentence-like lines; colon-terminated lines are often headings.
      if (/[.!?;,]$/.test(line)) {
        continue;
      }
      const mdMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (mdMatch) {
        sections.push(mdMatch[2].trim());
        continue;
      }
      if (/^(chapter|section|part|appendix)\s+\d+/i.test(line)) {
        sections.push(line);
        continue;
      }
      if (/^\d+(\.\d+)*[.)]?\s+\S/.test(line) && words.length <= 8) {
        sections.push(line);
        continue;
      }
      if (line.length >= 4 && words.length <= 8 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
        sections.push(line);
      }
    }
    return sections;
  }

  private flattenToParagraphUnits(pages: ExtractedPage[]): Array<{
    pageNo: number;
    section: string | null;
    text: string;
  }> {
    const units: Array<{ pageNo: number; section: string | null; text: string }> = [];

    for (const page of pages) {
      let currentSection: string | null = null;
      const paragraphs = page.text
        .split(/\n\s*\n/)
        .flatMap((block) =>
          block.length > 1200
            ? block
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
            : [block.trim()],
        )
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      for (const para of paragraphs) {
        const hit = page.sections.find(
          (s) => para === s || para.startsWith(s) || (para.length > 60 && s.startsWith(para.slice(0, 60))),
        );
        if (hit) {
          currentSection = hit;
        }
        if (this.countWords(para) === 0) {
          continue;
        }
        units.push({ pageNo: page.pageNo, section: currentSection, text: para });
      }
    }

    return units;
  }

  private countWords(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Best-effort mapping from an original filename to a DocumentType.
   */
  docTypeFromFilename(filename: string): DocumentType | null {
    return resolveDocType(path.extname(filename || ''));
  }
}

export const documentService = new DocumentService();
