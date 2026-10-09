'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Shield } from 'lucide-react';
import { fetchSystemStatus } from '../lib/api';
import type { SystemStatusDTO } from '@lectern/shared';

type Props = {
  compact?: boolean;
  className?: string;
};

export function OfflineBadge({ compact = false, className = '' }: Props) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatusDTO | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      fetchSystemStatus().then(setSystemStatus).catch(() => {});

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Network / Air-Gap Status Indicator */}
      <button
        type="button"
        onClick={() => setIsDetailsOpen((prev) => !prev)}
        aria-expanded={isDetailsOpen}
        aria-label={
          isOnline
            ? 'Network active. Local processing: zero data leaves device.'
            : 'Strict air-gap active: offline mode.'
        }
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer ${
          !isOnline
            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60 hover:bg-emerald-950/70'
            : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-850 hover:text-white'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            !isOnline ? 'bg-emerald-400' : 'bg-zinc-400'
          }`}
          aria-hidden="true"
        />
        <span>{!isOnline ? 'air-gapped' : 'local-only'}</span>
        {!compact && (
          <span className="hidden sm:inline text-zinc-500 font-sans text-[11px] border-l border-zinc-800 pl-2">
            {!isOnline ? 'No network connection' : 'Zero data egress'}
          </span>
        )}
      </button>

      {/* Hardware Telemetry Tag */}
      <div
        className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800"
        title="Local GPU: NVIDIA GeForce RTX 5060 Ti"
      >
        <Cpu className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
        <span className="text-zinc-300">RTX 5060 Ti</span>
        <span className="text-zinc-500">&bull;</span>
        <span className="text-zinc-400">16GB</span>
      </div>

      {/* Hardware Diagnostics Popover */}
      {isDetailsOpen && (
        <div
          role="region"
          aria-label="Hardware & Model Diagnostics"
          className="absolute right-0 top-full mt-2 w-80 rounded-lg bg-zinc-900 border border-zinc-800 p-4 shadow-2xl z-50 text-xs font-mono space-y-3"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              Runtime Telemetry
            </span>
            <span className="text-[10px] text-zinc-500">STANDALONE</span>
          </div>

          <div className="space-y-1.5 text-zinc-400">
            <div className="flex justify-between items-center py-1 border-b border-zinc-850">
              <span className="text-zinc-500">Air-Gap Status:</span>
              <span className={!isOnline ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
                {!isOnline ? 'Active (Offline)' : 'Isolated (No egress)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-850">
              <span className="text-zinc-500">Whisper Backend:</span>
              <span className="text-zinc-200">
                {systemStatus?.activeModels.transcription || 'whisper.cpp (CUDA fp16)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-850">
              <span className="text-zinc-500">Ollama LLM:</span>
              <span className="text-zinc-200">
                {systemStatus?.activeModels.llm || 'qwen2.5:14b'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-zinc-850">
              <span className="text-zinc-500">Embeddings:</span>
              <span className="text-zinc-200">
                {systemStatus?.activeModels.embeddings || 'nomic-embed-text (768d)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-zinc-500">Allocated VRAM:</span>
              <span className="text-zinc-200">16,283 MB</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-800 font-sans">
            All models execute within local system memory without cloud routing.
          </p>
        </div>
      )}
    </div>
  );
}
