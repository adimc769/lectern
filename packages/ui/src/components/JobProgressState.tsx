import React from 'react';
import { Cpu, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { LectureProgress, LectureStatus } from '../types';
import { STAGE_DESCRIPTIONS } from './UploadPanel';

export interface JobProgressStateProps {
  progress: LectureProgress;
  title?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const JobProgressState: React.FC<JobProgressStateProps> = ({
  progress,
  title = 'Processing Lecture',
  onCancel,
  onRetry,
  className = '',
}) => {
  const stageInfo = STAGE_DESCRIPTIONS[progress.status] || {
    label: 'Processing offline job...',
    icon: <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />,
    color: 'from-indigo-500 to-indigo-600',
  };

  const isFailed = progress.status === 'failed';
  const isDone = progress.status === 'done';

  return (
    <div
      className={`p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Offline job executing on local hardware (Whisper & Local LLM)
          </p>
        </div>

        <span className="font-mono text-sm font-bold text-indigo-400">
          {Math.round(progress.percent)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800/90 rounded-full h-3 overflow-hidden border border-slate-700/50 p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${stageInfo.color}`}
          style={{ width: `${Math.min(100, Math.max(5, progress.percent))}%` }}
        />
      </div>

      {/* Stage Status */}
      <div className="flex items-center justify-between text-xs bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2.5">
          {stageInfo.icon}
          <span className="font-semibold text-slate-200">{stageInfo.label}</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-slate-500 text-[11px]">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local GPU</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && !isDone && !isFailed && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel Job
          </button>
        )}

        {onRetry && isFailed && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            Retry Job
          </button>
        )}
      </div>
    </div>
  );
};

export default JobProgressState;
