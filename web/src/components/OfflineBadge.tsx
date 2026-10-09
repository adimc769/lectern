'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { DataSource } from '../lib/api';

type Props = {
  source: DataSource;
  compact?: boolean;
  className?: string;
};

export function OfflineBadge({ source = 'live', compact = false, className = '' }: Props) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isLive = source === 'live';

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setIsDetailsOpen((prev) => !prev)}
        aria-expanded={isDetailsOpen}
        aria-label={
          isLive
            ? 'Backend live. Processing locally on your device.'
            : 'Backend unreachable. Showing seeded offline demo data.'
        }
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide transition-colors border focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40 cursor-pointer ${
          isLive
            ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100/70 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'
            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
        }`}
      >
        {isLive ? (
          <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-600 dark:bg-teal-400" />
          </span>
        ) : (
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>{isLive ? 'LOCAL • LIVE' : 'OFFLINE DEMO DATA'}</span>
        {!compact && (
          <span
            className={`hidden sm:inline font-medium text-[11px] border-l pl-2 ${
              isLive
                ? 'text-teal-700/80 border-teal-200 dark:text-teal-400/80 dark:border-teal-800/60'
                : 'text-amber-700/80 border-amber-200 dark:text-amber-400/80 dark:border-amber-800/60'
            }`}
          >
            {isLive ? 'Zero data egress' : 'Seeded — no backend'}
          </span>
        )}
      </button>

      {isDetailsOpen && (
        <div
          role="region"
          aria-label={isLive ? 'Live backend details' : 'Offline demo data details'}
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] p-4 shadow-xs z-50 text-xs space-y-2"
        >
          <div className="font-semibold text-[#0F172A] dark:text-white">
            {isLive ? 'Connected to local backend' : 'Offline demo mode'}
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
            {isLive
              ? 'Lectures, transcripts, and answers are served live from your local backend. No data leaves this machine.'
              : 'The backend is unreachable, so this view renders explicit seeded demo content. Reconnect to resume live local processing.'}
          </p>
        </div>
      )}
    </div>
  );
}
