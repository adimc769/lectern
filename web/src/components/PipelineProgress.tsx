'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cpu,
  FileAudio,
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

interface StepItem {
  stage: PipelineStage;
  label: string;
}

const STAGES: StepItem[] = [
  { stage: 'CONVERTING_AUDIO', label: 'Audio Normalize' },
  { stage: 'TRANSCRIBING', label: 'Whisper CUDA' },
  { stage: 'CHUNKING', label: 'Chunk Alignment' },
  { stage: 'GENERATING_EMBEDDINGS', label: 'Vector Index' },
  { stage: 'SUMMARIZING', label: 'LLM Synthesis' },
  { stage: 'EXTRACTING_CARDS', label: 'Flashcards' },
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
    if (progress.stage === 'COMPLETED') return STAGES.length;
    const idx = STAGES.findIndex((s) => s.stage === progress.stage);
    return idx >= 0 ? idx : 0;
  };

  const currentStepIdx = getCurrentStepIndex();

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Pipeline Progress"
      className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 font-mono ${className}`}
    >
      {/* Status Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-850 text-xs">
        <div className="flex items-center gap-2">
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : hasError ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : (
            <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin" />
          )}
          <span className="text-zinc-200">
            {isDone ? 'COMPLETE' : hasError ? 'FAILED' : 'PROCESSING'}
          </span>
          <span className="text-zinc-500">&bull;</span>
          <span className="text-zinc-400">{progress.message}</span>
        </div>

        <span className="text-zinc-200 font-semibold">{progress.progressPercent}%</span>
      </div>

      {/* Clean Linear Progress */}
      <div
        role="progressbar"
        aria-valuenow={progress.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${progress.progressPercent}% - ${progress.stage}`}
        className="w-full h-1.5 rounded-full bg-zinc-950 border border-zinc-850 overflow-hidden"
      >
        <div
          className={`h-full transition-all duration-300 ${
            isDone ? 'bg-emerald-500' : hasError ? 'bg-rose-500' : 'bg-zinc-100'
          }`}
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>

      {/* Stepper Table / Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
        {STAGES.map((s, idx) => {
          const isPassed = isDone || currentStepIdx > idx;
          const isCurrent = !isDone && currentStepIdx === idx;

          return (
            <div
              key={s.stage}
              className={`p-2 rounded border transition-colors ${
                isPassed
                  ? 'border-zinc-800 bg-zinc-950 text-emerald-400'
                  : isCurrent
                  ? 'border-zinc-700 bg-zinc-850 text-zinc-100'
                  : 'border-zinc-900 bg-zinc-950 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-0.5">
                <span>0{idx + 1}</span>
                <span>{isPassed ? '✓' : isCurrent ? '…' : ''}</span>
              </div>
              <div className="truncate font-medium">{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
