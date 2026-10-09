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
 * PDF renders Page N dividers, DOCX renders section headings with anchors,
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

  const renderParagraphs = (text: string, keyPrefix: string) =>
    splitParagraphs(text).map((para, idx) => (
      <p
        key={`${keyPrefix}-p-${idx}`}
        className="text-sm font-normal text-[#0F172A] dark:text-slate-200 break-words"
        style={{ lineHeight: 1.7 }}
      >
        {para}
      </p>
    ));

  return (
    <article className={`space-y-6 ${className}`} aria-label={`Extracted text of ${document.title}`}>
      <header className="space-y-1">
        <h1
          title={document.title}
          className="text-xl font-semibold text-[#0F172A] dark:text-white break-words"
          style={{ lineHeight: 1.2 }}
        >
          {document.title}
        </h1>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
          {meta}
        </p>
      </header>

      {pages.length === 0 ? (
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          This document has no readable pages yet.
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 space-y-8">
          {pages.map((page) => {
            const sections = page.sections;
            const paragraphs = splitParagraphs(page.text);

            if (docType === 'DOCX' && sections.length > 0) {
              return (
                <section key={`page-${page.pageNo}`} aria-label={`Page ${page.pageNo}`}>
                  {sections.map((heading, sIdx) => (
                    <div
                      key={`page-${page.pageNo}-section-${sIdx}`}
                      className="sticky top-0 z-10 bg-[#FFFFFF] dark:bg-[#131B2E] py-2 -my-2"
                    >
                      <h2
                        id={`page-${page.pageNo}-section-${sIdx}`}
                        title={heading}
                        className="text-base font-semibold text-[#1E293B] dark:text-white line-clamp-2 break-words"
                        style={{ lineHeight: 1.2 }}
                      >
                        {heading}
                      </h2>
                    </div>
                  ))}
                  <div className="mt-4 space-y-4">
                    {paragraphs.map((para, pIdx) => (
                      <p
                        key={`page-${page.pageNo}-p-${pIdx}`}
                        className="text-sm font-normal text-[#0F172A] dark:text-slate-200 break-words"
                        style={{ lineHeight: 1.7 }}
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                </section>
              );
            }

            if (docType === 'TXT') {
              return (
                <section key={`page-${page.pageNo}`} aria-label={`Section ${page.pageNo}`}>
                  <div className="space-y-4">
                    {paragraphs.map((para, pIdx) => (
                      <div key={`page-${page.pageNo}-p-${pIdx}`} className="space-y-1">
                        <p className="text-xs font-semibold text-[#94A3B8] dark:text-[#64748B]">
                          ¶ {pIdx + 1}
                        </p>
                        <p
                          className="text-sm font-normal text-[#0F172A] dark:text-slate-200 break-words"
                          style={{ lineHeight: 1.7 }}
                        >
                          {para}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            }

            return (
              <section key={`page-${page.pageNo}`} aria-label={`Page ${page.pageNo}`}>
                <div className="sticky top-0 z-10 bg-[#FFFFFF] dark:bg-[#131B2E] py-2 -my-2 border-b border-[#ECECE8] dark:border-[#1E293B]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                    Page {page.pageNo}
                  </p>
                </div>
                <div className="mt-4 space-y-4">{renderParagraphs(page.text, `page-${page.pageNo}`)}</div>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}
