import React from 'react';
import { Loader2, Cpu } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  submessage?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  submessage,
  size = 'md',
  className = '',
}) => {
  const isFullscreen = size === 'fullscreen';

  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
    fullscreen: 'w-12 h-12',
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 rounded-2xl ${
        isFullscreen
          ? 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50'
          : 'bg-slate-900/60 border border-slate-800'
      } ${className}`}
    >
      <div className="relative mb-3 flex items-center justify-center">
        <Loader2 className={`${spinnerSizes[size]} text-indigo-500 animate-spin`} />
        <span className="absolute w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
      </div>

      <p className="text-sm font-semibold text-slate-200">{message}</p>
      {submessage && <p className="text-xs text-slate-400 mt-1 max-w-sm">{submessage}</p>}

      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-950/80 px-2.5 py-1 rounded-full border border-slate-800">
        <Cpu className="w-3 h-3 text-emerald-400" />
        <span>Executing locally on device</span>
      </div>
    </div>
  );
};

export default LoadingState;
