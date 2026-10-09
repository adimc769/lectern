'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileAudio,
  X,
  Sparkles,
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

const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  IDLE: 'Ready for upload',
  CONVERTING_AUDIO: 'Converting audio to 16kHz WAV with FFmpeg...',
  TRANSCRIBING: 'Transcribing speech on GPU with Whisper.cpp (CUDA)...',
  CHUNKING: 'Segmenting acoustic chunks and aligning timestamps...',
  GENERATING_EMBEDDINGS: 'Generating vector embeddings locally (nomic-embed-text)...',
  SUMMARIZING: 'Synthesizing lecture summary via Ollama (qwen2.5:14b)...',
  EXTRACTING_CARDS: 'Extracting key terms and study flashcards...',
  COMPLETED: 'Lecture processing complete!',
  FAILED: 'Processing failed',
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
        setErrorMessage('Please select a valid audio file (MP3, WAV, M4A, WebM, OGG, FLAC).');
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
      message: 'Initializing local audio conversion...',
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
      aria-label="Lecture Audio Uploader"
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Upload Audio Recording</h3>
            <p className="text-xs text-slate-400">
              Drag and drop lecture audio files for offline GPU transcription.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Local Whisper CUDA</span>
        </div>
      </div>

      {/* Uploading & Pipeline Progress State */}
      {isUploading && progress && (
        <div
          role="region"
          aria-live="polite"
          aria-label="Upload and transcription progress"
          className="space-y-6 py-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 animate-spin">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-400">
                  Stage: {progress.stage}
                </span>
                <h4 className="text-sm font-bold text-white">
                  {STAGE_DESCRIPTIONS[progress.stage] || progress.message}
                </h4>
              </div>
            </div>
            <span className="text-2xl font-black font-mono text-indigo-400">
              {progress.progressPercent}%
            </span>
          </div>

          {/* Progress Bar */}
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
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>Local Offline Pipeline</span>
              <span>100% on-device</span>
            </div>
          </div>
        </div>
      )}

      {/* Completed Success State */}
      {!isUploading && completedId && (
        <div className="py-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Audio Processed Successfully!</h4>
            <p className="text-xs text-slate-400 mt-1">
              Synchronized transcript and flashcards are ready for offline study.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onUploadSuccess?.(completedId)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              Open Lecture &rarr;
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Main Drag & Drop Zone (when not uploading and not completed) */}
      {!isUploading && !completedId && (
        <div className="space-y-5">
          {/* Title Input */}
          <div className="space-y-1.5">
            <label htmlFor="audio-upload-title" className="block text-xs font-semibold text-slate-300">
              Lecture Title <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="audio-upload-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Systems: Raft Consensus"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Drag & Drop Target Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-950/30 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-500/60 bg-emerald-950/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              id="file-upload-hidden-input"
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
              className="hidden"
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-600/50 flex items-center justify-center mx-auto text-emerald-400">
                  <FileAudio className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready to transcribe
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 pt-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Choose different file</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Drag and drop your audio file here, or{' '}
                    <span className="text-indigo-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports MP3, WAV, M4A, WebM, OGG up to 2 hours
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleUpload}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start GPU Transcription</span>
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Notice: </span>
            {errorMessage}
          </div>
        </div>
      )}
    </div>
  );
}
