'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  FileText,
} from 'lucide-react';
import type { JobProgressDTO } from '@lectern/shared';
import {
  fetchDocument,
  fetchDocumentProgress,
  type DocumentDTO,
} from '../../../lib/documents';
import { isBackendUnreachableError } from '../../../lib/api';
import { DocumentReader } from '../../../components/DocumentReader';

type ViewState = 'loading' | 'processing' | 'ready' | 'failed' | 'unreachable' | 'missing';

const DOC_STEPS = ['Reading file', 'Extracting text', 'Preparing chunks', 'Ready'];

function stepIndexFor(percent: number, stage: string): number {
  if (stage === 'COMPLETED') return DOC_STEPS.length - 1;
  if (percent >= 95) return 2;
  if (percent >= 55) return 1;
  if (percent >= 20) return 1;
  return 0;
}

export default function DocumentSourceViewPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [document, setDocument] = useState<DocumentDTO | null>(null);
  const [progress, setProgress] = useState<JobProgressDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) {
      setViewState('missing');
      return;
    }

    let active = true;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const pollProgress = async () => {
      try {
        const data = await fetchDocumentProgress(id);
        if (!active) return;
        setProgress(data);

        if (data.stage === 'COMPLETED') {
          stopPolling();
          try {
            const full = await fetchDocument(id);
            if (!active) return;
            setDocument(full);
            setViewState('ready');
          } catch (err) {
            if (!active) return;
            setErrorMessage(err instanceof Error ? err.message : 'Could not load this document.');
            setViewState('failed');
          }
        } else if (data.stage === 'FAILED') {
          stopPolling();
          setErrorMessage(data.error || 'Extraction failed.');
          setViewState('failed');
        }
      } catch {
        // Backend progress route may not be answering yet; keep polling honestly.
      }
    };

    const load = async () => {
      try {
        const doc = await fetchDocument(id);
        if (!active) return;
        setDocument(doc);
        const status = (doc as unknown as { status?: string }).status;
        if (status === 'COMPLETED') {
          setViewState('ready');
        } else if (status === 'FAILED') {
          const cause = (doc as unknown as { error?: string }).error;
          setErrorMessage(cause || 'Extraction failed.');
          setViewState('failed');
        } else {
          setViewState('processing');
          await pollProgress();
          pollTimerRef.current = setInterval(pollProgress, 800);
        }
      } catch (err) {
        if (!active) return;
        if (isBackendUnreachableError(err)) {
          setErrorMessage(err instanceof Error ? err.message : 'Document service unreachable.');
          setViewState('unreachable');
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Could not load this document.');
          setViewState('failed');
        }
      }
    };

    load();

    return () => {
      active = false;
      stopPolling();
    };
  }, [id, retryNonce]);

  if (!id) {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white">Document not found</h1>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          No document id was provided in the URL.
        </p>
        <Link
          href="/lectures"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to library</span>
        </Link>
      </div>
    );
  }

  if (viewState === 'loading') {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Loading your document…</p>
      </div>
    );
  }

  if (viewState === 'unreachable') {
    return (
      <div className="space-y-4 py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#FAF9F5] dark:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#334155] flex items-center justify-center mx-auto text-[#64748B]">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold text-[#0F172A] dark:text-white">
          Document service unreachable
        </h1>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto">
          {errorMessage ?? 'The backend is not answering. Your file was not lost — try again once the backend is running.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setViewState('loading');
              setErrorMessage(null);
              setRetryNonce((n) => n + 1);
            }}
            className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
          <Link
            href="/lectures"
            className="px-4 py-2 rounded-xl border border-[#E5E5DF] text-xs font-semibold text-[#0F172A] dark:text-white"
          >
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  const title = document?.title ?? 'Document';
  const isFailed = viewState === 'failed';
  const isReady = viewState === 'ready' && document;

  const percent = progress?.progressPercent ?? 10;
  const currentStepIdx = progress ? stepIndexFor(percent, progress.stage) : 0;
  const pageCount = (document as unknown as { pageCount?: number } | null)?.pageCount;
  const readyCopy =
    typeof pageCount === 'number'
      ? `READY — ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} available for study`
      : 'READY — available for study';
  const failedCause =
    errorMessage ??
    (document as unknown as { error?: string } | null)?.error ??
    'unknown cause';
  const failedCopy = `Extraction failed: ${failedCause}. Your file was not stored — try again or use a different file.`;

  return (
    <div className="space-y-6">
      <Link
        href="/lectures"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to library</span>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1
          title={title}
          className="text-xl font-semibold text-[#0F172A] dark:text-white line-clamp-2 break-words flex-1 min-w-0"
        >
          {title}
        </h1>
        {isReady ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
            Ready
          </span>
        ) : isFailed ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 shrink-0">
            Failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-[#1E293B] dark:text-[#94A3B8] border border-[#E5E5DF] dark:border-[#334155] shrink-0">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            Processing
          </span>
        )}
      </div>

      {isReady && document ? (
        <div className="space-y-3">
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]" aria-live="polite">
            {readyCopy}
          </p>
          <DocumentReader document={document} />
        </div>
      ) : isFailed ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-5 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Processing failed</span>
          </div>
          <p className="text-sm text-rose-700 dark:text-rose-300">{failedCopy}</p>
          <p className="text-xs text-rose-600/80 dark:text-rose-300/70">
            Accepts PDF, DOCX, TXT up to 25 MB. Single file per upload.
          </p>
          <Link
            href="/lectures"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold"
          >
            <span>Try again</span>
          </Link>
        </div>
      ) : (
        <div
          role="region"
          aria-live="polite"
          aria-label="Document extraction progress"
          className="rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw className="w-4 h-4 text-[#64748B] animate-spin shrink-0" />
              <span className="text-[#0F172A] dark:text-white font-medium truncate">
                {progress?.message ?? 'Starting local document extraction…'}
              </span>
            </div>
            <span className="text-[#0F172A] dark:text-white font-semibold shrink-0">{percent}%</span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${percent}% - ${progress?.stage ?? 'PROCESSING'}`}
            className="w-full h-1.5 rounded-full bg-[#F4F4F0] dark:bg-[#0B0F19] border border-[#ECECE8] dark:border-[#1E293B] overflow-hidden"
          >
            <div
              className="h-full bg-[#0D9488] transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            {DOC_STEPS.map((label, idx) => {
              const isPassed = currentStepIdx > idx;
              const isCurrent = currentStepIdx === idx;
              return (
                <div
                  key={label}
                  className={`p-2 rounded border transition-colors ${
                    isPassed
                      ? 'border-[#0D9488]/30 bg-[#F0FDFA] dark:bg-[#0D9488]/10 text-[#0D9488]'
                      : isCurrent
                      ? 'border-[#CBD5E1] dark:border-[#334155] bg-[#FAF9F5] dark:bg-[#19233C] text-[#0F172A] dark:text-white'
                      : 'border-[#ECECE8] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0B0F19] text-[#94A3B8]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] mb-0.5">
                    <span>0{idx + 1}</span>
                    <span>{isPassed ? <CheckCircle2 className="w-3 h-3" /> : isCurrent ? '…' : ''}</span>
                  </div>
                  <div className="truncate font-medium">{label}</div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-[#94A3B8] dark:text-[#64748B] flex items-center gap-1.5">
            <FileText className="w-3 h-3 shrink-0" />
            <span>Processed locally on your device. Zero internet or cloud APIs needed.</span>
          </p>
        </div>
      )}
    </div>
  );
}
