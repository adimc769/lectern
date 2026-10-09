'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, X } from 'lucide-react';
import { AppSidebar } from './AppSidebar';

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
          className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-40 flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-2xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] shadow-xs text-xs font-medium text-[#0F172A] dark:text-white max-w-[calc(100vw-2rem)]"
        >
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <span className="truncate">{toast}</span>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss notification"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#FAF9F5] dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
