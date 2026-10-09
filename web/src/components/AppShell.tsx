'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { WifiOff, X } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { fetchSystemStatus } from '../lib/api';

type Props = {
  children: React.ReactNode;
};

const FALLBACK_EVENT = 'lectern:backend-fallback';

export function AppShell({ children }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handler = (e: Event) => {
      const message =
        (e as CustomEvent<{ message?: string }>).detail?.message ??
        'Backend unreachable — showing seeded demo data';
      setToast(message);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 5000);
    };

    window.addEventListener(FALLBACK_EVENT, handler);
    return () => {
      window.removeEventListener(FALLBACK_EVENT, handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <div className="min-h-screen bg-[#FBFBF9] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col md:flex-row font-sans selection:bg-[#0D9488]/20 selection:text-[#0F172A] dark:selection:text-white">
      {/* Sidebar Navigation */}
      <AppSidebar />

      {/* Main Study Workspace Area */}
      <main
        role="main"
        className="flex-1 min-w-0 overflow-y-auto"
      >
        {/* Persistent shell top bar: Offline GPU status pill (every page, mobile + desktop) */}
        <div className="sticky top-0 z-30 bg-[#FBFBF9]/95 dark:bg-[#0B0F19]/95 backdrop-blur-sm border-b border-[#E5E5DF] dark:border-[#1E293B]">
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-end">
            <GpuStatusPill />
          </div>
        </div>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>

      {/* Global backend-fallback toast slot (5s auto-dismiss, no new deps).
          Bottom-right on md+ so it never covers the bottom-left sidebar
          Offline-ready card; z-40 sits below the sidebar drawer (z-50). */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-40 flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-2xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] shadow-xs text-sm font-medium text-[#0F172A] dark:text-white max-w-[calc(100vw-2rem)]"
        >
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{toast}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="p-1.5 rounded-lg text-[#475569] hover:text-[#0F172A] hover:bg-[#FAF9F5] dark:text-[#CBD5E1] dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

type GpuStatus = Awaited<ReturnType<typeof fetchSystemStatus>> | null;

function GpuStatusPill() {
  const [status, setStatus] = useState<GpuStatus>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (typeof fetchSystemStatus === 'function') {
          const data = await fetchSystemStatus();
          if (!cancelled) setStatus(data ?? null);
        } else {
          // Fallback when the helper is missing: direct status fetch.
          const res = await fetch('/api/status', { cache: 'no-store' });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const data = await res.json();
          if (!cancelled) setStatus(data ?? null);
        }
      } catch {
        // Direct fallback so the pill degrades to amber instead of crashing.
        try {
          const res = await fetch('/api/status', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setStatus(data ?? null);
            return;
          }
        } catch {
          // ignore — mark unreachable below
        }
        if (!cancelled) setStatus(null);
      }
    };

    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const whisperReady = status?.whisperReady === true;
  const ollamaReady = status?.ollamaReady === true;
  const fromFallback = (status as { source?: string } | null)?.source === 'fallback';
  const isGreen = status !== null && !fromFallback && whisperReady && ollamaReady;

  let reason = 'All local models ready';
  if (status === null) {
    reason = 'Backend unreachable';
  } else if (fromFallback) {
    reason = 'Backend unreachable';
  } else if (!whisperReady && !ollamaReady) {
    reason = 'Whisper + Ollama offline';
  } else if (!whisperReady) {
    const modelMissing = (status as { details?: { whisperModel?: boolean } } | null)?.details?.whisperModel === false;
    reason = modelMissing ? 'Whisper model missing' : 'Whisper offline';
  } else if (!ollamaReady) {
    reason = 'Ollama offline';
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={isGreen ? 'Offline. Running on your GPU. All local models ready.' : `Offline. Running on your GPU. ${reason}. Activate to expand details.`}
        title={isGreen ? 'All local models ready' : reason}
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-colors border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40 ${
          isGreen
            ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100/70 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'
            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
        }`}
      >
        {isGreen ? (
          <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-600 dark:bg-teal-400" />
          </span>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
        )}
        <span>Offline · running on your GPU</span>
      </button>

      {expanded && !isGreen && (
        <div
          role="status"
          className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] p-3 shadow-xs z-30 text-left space-y-1.5"
        >
          <div className="text-sm font-semibold text-[#0F172A] dark:text-white">{reason}</div>
          <p className="text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            Local GPU pipeline is degraded. Check Whisper and Ollama services.
          </p>
          <Link
            href="/settings"
            className="inline-block text-sm font-medium text-[#0D9488] hover:underline"
          >
            Open Settings diagnostics
          </Link>
        </div>
      )}
    </div>
  );
}
