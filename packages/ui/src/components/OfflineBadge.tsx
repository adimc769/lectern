import React, { useState, useEffect } from 'react';
import { WifiOff, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

export interface OfflineBadgeProps {
  forceOffline?: boolean;
  className?: string;
  showDetails?: boolean;
}

export const OfflineBadge: React.FC<OfflineBadgeProps> = ({
  forceOffline,
  className = '',
  showDetails = false,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (forceOffline !== undefined) return !forceOffline;
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    if (forceOffline !== undefined) {
      setIsOnline(!forceOffline);
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [forceOffline]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${
          !isOnline
            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/80 hover:border-emerald-400 focus:ring-emerald-500 shadow-sm shadow-emerald-950/50'
            : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600 focus:ring-slate-500'
        }`}
        title={
          !isOnline
            ? 'Offline mode: all AI runs on this device'
            : 'Works either way. Nothing leaves your device.'
        }
        aria-label={
          !isOnline
            ? 'Offline mode: all AI runs on this device'
            : 'Works either way. Nothing leaves your device.'
        }
        aria-expanded={isPopoverOpen}
        aria-haspopup="dialog"
      >
        {/* Pulsing Status Dot */}
        <span className="relative flex h-2 w-2">
          {!isOnline ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
          )}
        </span>

        {/* Icon */}
        {!isOnline ? (
          <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}

        {/* Text description */}
        <span className="font-semibold tracking-wide">
          {!isOnline ? (
            <span className="text-emerald-300">Offline mode: all AI runs on this device</span>
          ) : (
            <span className="text-slate-300">Works either way. Nothing leaves your device.</span>
          )}
        </span>

        {/* Badge detail pill */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
            !isOnline
              ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-700/50'
              : 'bg-slate-800 text-slate-400 border border-slate-700/60'
          }`}
        >
          {!isOnline ? 'Air-gapped' : 'Local AI'}
        </span>
      </button>

      {/* Popover explaining device privacy */}
      {(isPopoverOpen || showDetails) && (
        <div
          role="dialog"
          aria-label="Offline privacy details"
          className="absolute top-full right-0 mt-2 w-80 p-4 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% On-Device Privacy</span>
            </div>
            {!showDetails && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPopoverOpen(false);
                }}
                className="text-slate-400 hover:text-white p-0.5"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>

          <div className="space-y-2 text-slate-300 leading-relaxed">
            <p className="text-slate-300">
              {!isOnline
                ? 'Your device is disconnected from the internet. Lectern continues executing transcription and semantic search seamlessly.'
                : 'Even with an active internet connection, Lectern never communicates with external cloud APIs or servers.'}
            </p>

            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Inference: Local Whisper & Local LLM</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                <span>Storage: Local Vector SQLite on device</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Zero network telemetry, zero third-party CDNs, zero cloud tokens required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineBadge;
