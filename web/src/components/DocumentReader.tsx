'use client';

import React, { useMemo } from 'react';
import type { DocumentDTO, DocumentPageDTO } from '../lib/documents';

type Props = {
  document: DocumentDTO;
  className?: string;
};

/** Splits raw page text into readable paragraphs; never returns an empty array for non-empty text. */
function splitParagraphs(text: string): string[] {
  const parts = text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .flatMap((block) => block.split(/\n/))
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [text.trim()].filter((p) => p.length > 0);
}

function coerceSections(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim().length > 0) {
      out.push(item.trim());
    } else if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const heading = rec.heading ?? rec.title ?? rec.text;
      if (typeof heading === 'string' && heading.trim().length > 0) out.push(heading.trim());
    }
  }
  return out;
}

function coercePages(raw: unknown): DocumentPageDTO[] {
  if (!Array.isArray(raw)) return [];
  const pages: DocumentPageDTO[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.text !== 'string') continue;
    pages.push({
      pageNo: typeof rec.pageNo === 'number' ? rec.pageNo : pages.length + 1,
      text: rec.text,
      sections: coerceSections(rec.sections),
    });
  }
  return pages;
}

/**
 * Extracted-text reader for a READY document source.
 * PDF renders Page N dividers, DOCX renders styled headings and paragraphs in-place,
 * TXT renders paragraph breaks with positional labels.
 */
export function DocumentReader({ document, className = '' }: Props) {
  const pages = useMemo(
    () =>
      coercePages((document as unknown as { pages?: unknown }).pages).sort(
        (a, b) => a.pageNo - b.pageNo
      ),
    [document]
  );

  const docType = (document as unknown as { docType?: string }).docType ?? 'TXT';
  const pageCount = (document as unknown as { pageCount?: number }).pageCount;
  const meta =
    typeof pageCount === 'number'
      ? `${docType} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} · READY`
      : `${docType} · READY`;

  return (
    <article className={`space-y-4 ${className}`} aria-label={`Extracted text of ${document.title}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
        <span>Extracted Document Content</span>
        <span className="font-mono text-[11px]">{meta}</span>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] p-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
          This document has no readable pages yet.
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-8 space-y-6 shadow-xs">
          {pages.map((page) => {
            const sections = page.sections;
            const paragraphs = splitParagraphs(page.text);

            if (docType === 'DOCX') {
              // Normalize sections set for fast in-place heading matching
              const normalizedSections = new Set(sections.map((s) => s.toLowerCase().trim()));

              return (
                <section key={`page-${page.pageNo}`} aria-label={`Page ${page.pageNo}`} className="space-y-4">
                  {pages.length > 1 && (
                    <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                      <div className="h-px flex-1 bg-[#E5E5DF] dark:bg-[#1E293B]" />
                      <span>Page {page.pageNo}</span>
                      <div className="h-px flex-1 bg-[#E5E5DF] dark:bg-[#1E293B]" />
                    </div>
                  )}

                  <div className="space-y-3.5">
                    {paragraphs.map((para, pIdx) => {
                      const isHeading =
                        normalizedSections.has(para.toLowerCase()) ||
                        sections.some(
                          (s) =>
                            s.length > 3 &&
                            (para.toLowerCase().startsWith(s.toLowerCase()) ||
                              s.toLowerCase().startsWith(para.toLowerCase()))
                        );

                      if (isHeading) {
                        return (
                          <h2
                            key={`page-${page.pageNo}-h-${pIdx}`}
                            className={`text-base sm:text-lg font-bold text-[#0F172A] dark:text-white leading-snug pb-1 border-b border-[#E5E5DF]/60 dark:border-[#1E293B] ${
                              pIdx > 0 ? 'pt-4' : 'pt-0'
                            }`}
                          >
                            {para}
                          </h2>
                        );
                      }

                      return (
                        <p
                          key={`page-${page.pageNo}-p-${pIdx}`}
                          className="text-sm font-normal text-[#0F172A] dark:text-slate-200 leading-relaxed break-words"
                        >
                          {para}
                        </p>
                      );
                    })}
                  </div>
                </section>
              );
            }

            if (docType === 'TXT') {
              return (
                <section key={`page-${page.pageNo}`} aria-label={`Section ${page.pageNo}`} className="space-y-4">
                  <div className="space-y-3.5">
                    {paragraphs.map((para, pIdx) => (
                      <div key={`page-${page.pageNo}-p-${pIdx}`} className="space-y-1">
                        <p className="text-[11px] font-semibold text-[#94A3B8] dark:text-[#64748B] font-mono">
                          ¶ {pIdx + 1}
                        </p>
                        <p className="text-sm font-normal text-[#0F172A] dark:text-slate-200 leading-relaxed break-words">
                          {para}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            // PDF
            return (
              <section key={`page-${page.pageNo}`} aria-label={`Page ${page.pageNo}`} className="space-y-4">
                <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  <div className="h-px flex-1 bg-[#E5E5DF] dark:bg-[#1E293B]" />
                  <span>Page {page.pageNo}</span>
                  <div className="h-px flex-1 bg-[#E5E5DF] dark:bg-[#1E293B]" />
                </div>
                <div className="space-y-3.5">
                  {paragraphs.map((para, idx) => (
                    <p
                      key={`page-${page.pageNo}-p-${idx}`}
                      className="text-sm font-normal text-[#0F172A] dark:text-slate-200 leading-relaxed break-words"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default DocumentReader;
