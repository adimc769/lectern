'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileAudio,
  X,
  AlertCircle,
  CheckCircle2,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { uploadLecture, fetchProgress } from '../lib/api';
import type { JobProgressDTO, PipelineStage } from '@lectern/shared';

type Props = {
  onUploadSuccess?: (lectureId: string) => void;
  className?: string;
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  IDLE: 'Standby',
  CONVERTING_AUDIO: 'Audio normalization (16kHz WAV mono via FFmpeg)',
  TRANSCRIBING: 'Whisper.cpp transcription (CUDA fp16)',
  CHUNKING: 'Acoustic sentence chunking & alignment',
  GENERATING_EMBEDDINGS: 'SQLite vector embedding (nomic-embed-text)',
  SUMMARIZING: 'Topic synthesis (Ollama qwen2.5:14b)',
  EXTRACTING_CARDS: 'Flashcard & key term extraction',
  PROCESSING: 'Processing document',
  COMPLETED: 'Pipeline execution complete',
  FAILED: 'Execution failed',
};

export function AudioUploader({ onUploadSuccess, className = '' }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<JobProgressDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedId, setCompletedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|webm|ogg|flac|aac)$/i.test(file.name)) {
        setSelectedFile(file);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        setErrorMessage(null);
      } else {
        setErrorMessage('Unsupported format. Please select an audio file (WAV, MP3, M4A, FLAC, WebM).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    setProgress({
      lectureId: '',
      stage: 'CONVERTING_AUDIO',
      progressPercent: 15,
      message: 'Converting audio stream...',
    });

    try {
      const finalTitle = title.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
      const res = await uploadLecture(selectedFile, finalTitle);
      const lectureId = res.id;

      let isDone = false;
      const poll = async () => {
        try {
          const p = await fetchProgress(lectureId);
          setProgress(p);

          if (p.stage === 'COMPLETED') {
            isDone = true;
            setIsUploading(false);
            setCompletedId(lectureId);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            onUploadSuccess?.(lectureId);
          } else if (p.stage === 'FAILED') {
            isDone = true;
            setIsUploading(false);
            setErrorMessage(p.error || 'Pipeline execution failed.');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        } catch {
          // Continue polling
        }
      };

      pollIntervalRef.current = setInterval(() => {
        if (!isDone) poll();
      }, 800);

      poll();
    } catch (err: unknown) {
      setIsUploading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setIsUploading(false);
    setProgress(null);
    setErrorMessage(null);
    setCompletedId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      role="region"
      aria-label="Audio File Uploader"
      className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <Upload className="w-3.5 h-3.5 text-zinc-400" />
          <span>AUDIO FILE INTAKE</span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Max: 2 GB &bull; Local FFmpeg + CUDA
        </span>
      </div>

      {/* Uploading Progress */}
      {isUploading && progress && (
        <div
          role="region"
          aria-live="polite"
          className="py-3 space-y-3 font-mono"
        >
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              <span>{STAGE_LABELS[progress.stage] || progress.message}</span>
            </div>
            <span className="font-semibold text-zinc-200">
              {progress.progressPercent}%
            </span>
          </div>

          {/* Clean Linear Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={progress.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${progress.progressPercent}% - ${progress.stage}`}
            className="w-full h-1.5 rounded-full bg-zinc-950 border border-zinc-850 overflow-hidden"
          >
            <div
              className="h-full bg-zinc-100 transition-all duration-300"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed Success State */}
      {!isUploading && completedId && (
        <div className="py-4 text-center space-y-3 font-mono">
          <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-zinc-200">Ingestion complete: {completedId}</p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1 font-sans">
            <button
              type="button"
              onClick={() => onUploadSuccess?.(completedId)}
              className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors"
            >
              Open Lecture &rarr;
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-medium transition-colors"
            >
              Ingest Another
            </button>
          </div>
        </div>
      )}

      {/* Form & Dropzone */}
      {!isUploading && !completedId && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="file-title-input" className="block text-[11px] font-mono text-zinc-400">
              Lecture Title
            </label>
            <input
              id="file-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. CS101: Lecture 4 - Consensus"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          {/* Minimal Clean Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-zinc-500 bg-zinc-850/50'
                : selectedFile
                ? 'border-emerald-800/80 bg-emerald-950/20'
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/50'
            }`}
          >
            <input
              ref={fileInputRef}
              id="file-upload-dialog"
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
              className="hidden"
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div className="flex items-center justify-between font-mono text-xs text-left px-2">
                <div className="flex items-center gap-2 truncate">
                  <FileAudio className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-zinc-200 truncate">{selectedFile.name}</span>
                  <span className="text-zinc-500">
                    ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-zinc-300">
                  Drop audio file or <span className="text-indigo-400 underline">select file</span>
                </p>
                <p className="text-[11px] font-mono text-zinc-500">
                  Supported: WAV, MP3, M4A, FLAC, WebM
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleUpload}
              className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Start Local Ingestion
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
