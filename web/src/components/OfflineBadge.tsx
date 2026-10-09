'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Cpu, ShieldCheck, HardDriveDownload } from 'lucide-react';
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
      {/* Network / Privacy Status Badge */}
      <button
        type="button"
        onClick={() => setIsDetailsOpen((prev) => !prev)}
        aria-expanded={isDetailsOpen}
        aria-label={
          isOnline
            ? 'Network active. Local processing: Works either way, nothing leaves your device.'
            : 'Strict offline air-gap active: all AI runs locally on this device.'
        }
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-indigo-500 cursor-pointer ${
          !isOnline
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/50 hover:bg-emerald-900/80'
            : 'bg-slate-900/90 text-slate-300 border-slate-700/70 hover:bg-slate-800/90 hover:text-white'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold">Offline Mode</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            {!compact && (
              <span className="hidden sm:inline text-emerald-400/90 text-[11px] font-normal border-l border-emerald-800/60 pl-2">
                All AI runs on this device
              </span>
            )}
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
            <span className="font-medium text-slate-200">Local Privacy</span>
            {!compact && (
              <span className="hidden sm:inline text-slate-400 text-[11px] border-l border-slate-700/60 pl-2">
                Works either way. Nothing leaves your device.
              </span>
            )}
          </>
        )}
      </button>

      {/* GPU / Local Hardware acceleration tag */}
      <div
        className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono font-medium bg-slate-900/90 text-slate-300 border border-slate-800"
        title="Hardware: RTX 5060 Ti CUDA acceleration"
      >
        <Cpu className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
        <span className="text-slate-400">GPU:</span>
        <span className="text-cyan-300 font-semibold">{systemStatus?.gpuName || 'RTX 5060 Ti'}</span>
      </div>

      {/* Expanded System Info Popover */}
      {isDetailsOpen && (
        <div
          role="region"
          aria-label="Hardware & Model Specs"
          className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-slate-900/95 border border-slate-800 p-4 shadow-2xl z-50 backdrop-blur-md text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-white font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Offline Architecture Specs</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/50">
              Air-Gapped Ready
            </span>
          </div>

          <div className="space-y-2 text-slate-300">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400">Internet Status:</span>
              <span className={!isOnline ? 'text-emerald-400 font-semibold' : 'text-slate-300'}>
                {!isOnline ? 'Fully Offline (Strict Airgap)' : 'Connected (No Cloud AI Used)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400">Speech-to-Text:</span>
              <span className="font-mono text-cyan-300">
                {systemStatus?.activeModels.transcription || 'whisper-large-v3-turbo (CUDA)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400">Synthesis LLM:</span>
              <span className="font-mono text-indigo-300">
                {systemStatus?.activeModels.llm || 'qwen2.5:14b'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
              <span className="text-slate-400">Embedding Model:</span>
              <span className="font-mono text-emerald-300">
                {systemStatus?.activeModels.embeddings || 'nomic-embed-text'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Dedicated VRAM:</span>
              <span className="font-mono text-slate-200">16,283 MB</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800 italic">
            Zero external telemetry or cloud inference. All data stays strictly on your workstation.
          </p>
        </div>
      )}
    </div>
  );
}
