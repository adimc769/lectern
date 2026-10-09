'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cpu,
  FileAudio,
  Sparkles,
  Scissors,
  Brain,
  FileText,
  CreditCard,
} from 'lucide-react';
import { fetchProgress } from '../lib/api';
import type { JobProgressDTO, PipelineStage } from '@lectern/shared';

type Props = {
  lectureId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  pollIntervalMs?: number;
  className?: string;
};

interface StageStep {
  stage: PipelineStage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGE_STEPS: StageStep[] = [
  { stage: 'CONVERTING_AUDIO', label: 'Audio Normalize', icon: FileAudio },
  { stage: 'TRANSCRIBING', label: 'Whisper CUDA', icon: Cpu },
  { stage: 'CHUNKING', label: 'Chunking', icon: Scissors },
  { stage: 'GENERATING_EMBEDDINGS', label: 'Embeddings', icon: Brain },
  { stage: 'SUMMARIZING', label: 'Summary', icon: FileText },
  { stage: 'EXTRACTING_CARDS', label: 'Flashcards', icon: CreditCard },
];

export function PipelineProgress({
  lectureId,
  onComplete,
  onError,
  pollIntervalMs = 800,
  className = '',
}: Props) {
  const [progress, setProgress] = useState<JobProgressDTO>({
    lectureId,
    stage: 'CONVERTING_AUDIO',
    progressPercent: 10,
    message: 'Starting local ingestion pipeline on GPU...',
  });
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const data = await fetchProgress(lectureId);
        if (!active) return;
        setProgress(data);

        if (data.stage === 'COMPLETED') {
          setIsDone(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          onComplete?.();
        } else if (data.stage === 'FAILED') {
          setHasError(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          onError?.(data.error || 'Pipeline execution failed.');
        }
      } catch (err) {
        // Continue polling
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      active = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [lectureId, pollIntervalMs, onComplete, onError]);

  const getCurrentStepIndex = () => {
    if (progress.stage === 'COMPLETED') return STAGE_STEPS.length;
    const idx = STAGE_STEPS.findIndex((s) => s.stage === progress.stage);
    return idx >= 0 ? idx : 0;
  };

  const currentStepIdx = getCurrentStepIndex();

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Offline pipeline progress"
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6 ${className}`}
    >
      {/* Top Banner Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDone
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/50'
                : hasError
                ? 'bg-rose-950 text-rose-400 border border-rose-600/50'
                : 'bg-indigo-950 text-indigo-400 border border-indigo-700/60 animate-spin'
            }`}
          >
            {isDone ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : hasError ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-400">
              {isDone
                ? 'Pipeline Finished'
                : hasError
                ? 'Execution Interrupted'
                : 'On-Device Pipeline Active'}
            </span>
            <h3 className="text-base font-bold text-white">
              {progress.message || 'Processing lecture audio...'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
          <span className="text-2xl font-black text-indigo-400">
            {progress.progressPercent}%
          </span>
        </div>
      </div>

      {/* Accessible Progress Bar */}
      <div className="space-y-2">
        <div
          role="progressbar"
          aria-valuenow={progress.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${progress.progressPercent}% - ${progress.stage}`}
          className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out shadow-sm ${
              isDone
                ? 'bg-emerald-500'
                : hasError
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400'
            }`}
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>RTX 5060 Ti CUDA</span>
          </span>
          <span>Target ID: {lectureId}</span>
        </div>
      </div>

      {/* Pipeline Stages Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
        {STAGE_STEPS.map((step, idx) => {
          const isPassed = isDone || currentStepIdx > idx;
          const isCurrent = !isDone && currentStepIdx === idx;
          const StepIcon = step.icon;

          return (
            <div
              key={step.stage}
              className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between min-h-[76px] ${
                isPassed
                  ? 'border-emerald-600/40 bg-emerald-950/20 text-emerald-300'
                  : isCurrent
                  ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm'
                  : 'border-slate-800/80 bg-slate-950/50 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <StepIcon
                  className={`w-4 h-4 ${
                    isPassed
                      ? 'text-emerald-400'
                      : isCurrent
                      ? 'text-indigo-400 animate-pulse'
                      : 'text-slate-600'
                  }`}
                />
                <span className="text-[10px] font-mono">#{idx + 1}</span>
              </div>

              <div className="font-semibold truncate mt-1">
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hardware Guarantee Note */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Local Whisper.cpp + Ollama RAG pipeline</span>
        </span>
        <span className="text-emerald-400 font-mono text-[11px]">Strict Air-Gap</span>
      </div>
    </div>
  );
}
