'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Mic,
  Square,
  AlertCircle,
  CheckCircle2,
  Cpu,
  FileAudio,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react';
import { uploadLecture, fetchProgress } from '../lib/api';
import type { JobProgressDTO, PipelineStage } from '@lectern/shared';

type Props = {
  onUploadComplete?: (lectureId: string) => void;
  className?: string;
};

type UploadMode = 'file' | 'record';

const STAGE_LABELS: Record<PipelineStage, { label: string; icon: string }> = {
  IDLE: { label: 'Ready', icon: '⏳' },
  CONVERTING_AUDIO: { label: 'Converting audio to 16kHz WAV (FFmpeg)...', icon: '⚙️' },
  TRANSCRIBING: { label: 'Transcribing speech on GPU (Whisper.cpp CUDA)...', icon: '🎙️' },
  CHUNKING: { label: 'Chunking transcript and aligning timestamps...', icon: '✂️' },
  GENERATING_EMBEDDINGS: { label: 'Generating nomic-embed-text embeddings...', icon: '🧠' },
  SUMMARIZING: { label: 'Synthesizing lecture summary (qwen2.5:14b)...', icon: '📝' },
  EXTRACTING_CARDS: { label: 'Extracting key terms & flashcards...', icon: '🗂️' },
  COMPLETED: { label: 'Processing complete! Ready for offline study.', icon: '✅' },
  FAILED: { label: 'Processing failed', icon: '❌' },
};

export function UploadPanel({ onUploadComplete, className = '' }: Props) {
  const [mode, setMode] = useState<UploadMode>('file');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lectureTitle, setLectureTitle] = useState('');

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Upload & Progress state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<JobProgressDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedLectureId, setCompletedLectureId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up media recorder stream and intervals on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|webm|ogg|flac|aac)$/i.test(file.name)) {
        setSelectedFile(file);
        if (!lectureTitle) {
          setLectureTitle(file.name.replace(/\.[^/.]+$/, ''));
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
      if (!lectureTitle) {
        setLectureTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage(null);
    }
  };

  // Recording Handlers
  const startRecording = async () => {
    setErrorMessage(null);
    setRecordedBlob(null);
    setRecordingSeconds(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio recording is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        setRecordedBlob(audioBlob);
        if (!lectureTitle) {
          const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLectureTitle(`Recorded Lecture (${dateStr})`);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const errorStr = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Microphone access failed: ${errorStr}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  // Start processing and polling
  const startUploadPipeline = async (fileOrBlob: File | Blob) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgress({
      lectureId: '',
      stage: 'CONVERTING_AUDIO',
      progressPercent: 15,
      message: 'Initializing local pipeline and audio extraction...',
    });

    try {
      const finalTitle = lectureTitle.trim() || 'Untitled Lecture';
      const result = await uploadLecture(fileOrBlob, finalTitle);
      const lectureId = result.id;

      // Poll progress endpoint
      let isDone = false;
      const pollProgress = async () => {
        try {
          const p = await fetchProgress(lectureId);
          setProgress(p);

          if (p.stage === 'COMPLETED') {
            isDone = true;
            setIsProcessing(false);
            setCompletedLectureId(lectureId);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            onUploadComplete?.(lectureId);
          } else if (p.stage === 'FAILED') {
            isDone = true;
            setIsProcessing(false);
            setErrorMessage(p.error || 'Pipeline execution failed during offline processing.');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        } catch {
          // Continue polling
        }
      };

      // Poll every 800ms
      pollIntervalRef.current = setInterval(() => {
        if (!isDone) pollProgress();
      }, 800);

      // Trigger first poll immediately
      pollProgress();
    } catch (err: unknown) {
      setIsProcessing(false);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const handleStartProcessing = () => {
    if (mode === 'file' && selectedFile) {
      startUploadPipeline(selectedFile);
    } else if (mode === 'record' && recordedBlob) {
      startUploadPipeline(recordedBlob);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setRecordedBlob(null);
    setLectureTitle('');
    setIsProcessing(false);
    setProgress(null);
    setErrorMessage(null);
    setCompletedLectureId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl relative backdrop-blur-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <span>Process New Lecture</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Transcribe with Whisper.cpp (CUDA), generate summaries with Qwen 2.5, and extract flashcards—100% offline.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        {!isProcessing && !completedLectureId && (
          <div
            role="tablist"
            aria-label="Upload method selection"
            className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 self-start sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'file'}
              onClick={() => {
                setMode('file');
                setErrorMessage(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'file'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Audio</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'record'}
              onClick={() => {
                setMode('record');
                setErrorMessage(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === 'record'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Live</span>
            </button>
          </div>
        )}
      </div>

      {/* Progressing State */}
      {isProcessing && progress && (
        <div
          role="region"
          aria-live="polite"
          aria-label="Lecture processing progress"
          className="space-y-6 py-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 animate-spin">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">
                  Offline Pipeline Active
                </span>
                <h3 className="text-base font-bold text-white">
                  {STAGE_LABELS[progress.stage]?.label || progress.message}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-indigo-400">
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
              aria-valuetext={`${progress.progressPercent}% - ${STAGE_LABELS[progress.stage]?.label}`}
              className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-cyan-400 transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>NVIDIA RTX 5060 Ti CUDA</span>
              </span>
              <span>Stage: {progress.stage}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Zero Cloud Network Requests</span>
            </div>
            <p>
              Audio is decoded into 16kHz float PCM, streamed through Whisper.cpp weights, and embedded locally into your SQLite vector store.
            </p>
          </div>
        </div>
      )}

      {/* Completed Success State */}
      {!isProcessing && completedLectureId && (
        <div className="py-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Lecture Successfully Processed!</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Timestamps, summary, key terms, and flashcards are ready for offline study.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onUploadComplete?.(completedLectureId)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              Open Lecture &rarr;
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-all"
            >
              Process Another File
            </button>
          </div>
        </div>
      )}

      {/* Main Upload / Record Form (when not processing and not completed) */}
      {!isProcessing && !completedLectureId && (
        <div className="space-y-6">
          {/* Lecture Title Input */}
          <div className="space-y-1.5">
            <label htmlFor="lecture-title-input" className="block text-xs font-semibold text-slate-300">
              Lecture Title <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="lecture-title-input"
              type="text"
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              placeholder="e.g. Distributed Systems: Raft Consensus"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Mode 1: File Upload Drag and Drop */}
          {mode === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-950/30 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-500/60 bg-emerald-950/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  id="audio-file-upload-input"
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
                      <span>Remove</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Drop your lecture audio here, or{' '}
                        <span className="text-indigo-400 underline">browse files</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        MP3, WAV, M4A, WebM, OGG up to 2 hours
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={handleStartProcessing}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Local GPU Transcription</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: In-Browser Live Microphone Recording */}
          {mode === 'record' && (
            <div className="space-y-4">
              <div className="border border-slate-800 rounded-2xl p-8 bg-slate-950/40 text-center space-y-4">
                <div className="space-y-2">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
                      isRecording
                        ? 'bg-rose-950 border-2 border-rose-500 text-rose-400 animate-pulse shadow-lg shadow-rose-900/50'
                        : recordedBlob
                        ? 'bg-emerald-950 border border-emerald-500/50 text-emerald-400'
                        : 'bg-slate-900 border border-slate-800 text-rose-400'
                    }`}
                  >
                    <Mic className="w-8 h-8" />
                  </div>

                  {isRecording ? (
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-600/40 text-xs font-semibold text-rose-300">
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        <span>LIVE RECORDING</span>
                      </div>
                      <p className="text-3xl font-mono font-black text-white pt-1">
                        {formatSeconds(recordingSeconds)}
                      </p>
                      <p className="text-xs text-slate-400">Capturing audio via browser microphone...</p>
                    </div>
                  ) : recordedBlob ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-emerald-400">Recording Captured!</p>
                      <p className="text-xs text-slate-400">
                        Duration: {formatSeconds(recordingSeconds)} &bull; Ready to transcribe locally
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">Ready to Record Classroom Lecture</p>
                      <p className="text-xs text-slate-400">
                        Click below to start live microphone capture. No audio leaves your computer.
                      </p>
                    </div>
                  )}
                </div>

                {/* Record Controls */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      <span>{recordedBlob ? 'Re-record Audio' : 'Start Recording'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold border border-rose-500/50 shadow-lg transition-all flex items-center gap-2"
                    >
                      <Square className="w-4 h-4 text-rose-400 fill-current" />
                      <span>Stop Recording</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Upload Recorded Audio Button */}
              {recordedBlob && !isRecording && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleStartProcessing}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Process Recorded Lecture</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-300 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Error: </span>
                {errorMessage}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
