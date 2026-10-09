import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Cpu,
  Layers,
  Sparkles,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import type { LecternApiClient, LectureProgress, LectureStatus } from '../types';

export interface UploadPanelProps {
  api: LecternApiClient;
  onUploadSuccess?: (lectureId: string) => void;
  className?: string;
}

export const STAGE_DESCRIPTIONS: Record<LectureStatus, { label: string; icon: React.ReactNode; color: string }> = {
  converting: {
    label: 'Extracting and converting audio stream...',
    icon: <Cpu className="w-4 h-4 text-amber-400 animate-pulse" />,
    color: 'from-amber-500 to-amber-600',
  },
  transcribing: {
    label: 'Transcribing on your GPU with Whisper...',
    icon: <Cpu className="w-4 h-4 text-indigo-400 animate-spin" />,
    color: 'from-indigo-500 to-indigo-600',
  },
  embedding: {
    label: 'Generating semantic vector embeddings locally...',
    icon: <Layers className="w-4 h-4 text-blue-400 animate-pulse" />,
    color: 'from-blue-500 to-blue-600',
  },
  summarizing: {
    label: 'Synthesizing core takeaways with local LLM...',
    icon: <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />,
    color: 'from-purple-500 to-purple-600',
  },
  flashcards: {
    label: 'Extracting key terms and study flashcards...',
    icon: <HelpCircle className="w-4 h-4 text-emerald-400 animate-pulse" />,
    color: 'from-emerald-500 to-emerald-600',
  },
  done: {
    label: 'Processing complete! Ready to study.',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    color: 'from-emerald-500 to-emerald-600',
  },
  failed: {
    label: 'Processing failed. Please retry.',
    icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
    color: 'from-rose-500 to-rose-600',
  },
};

export const UploadPanel: React.FC<UploadPanelProps> = ({
  api,
  onUploadSuccess,
  className = '',
}) => {
  const [mode, setMode] = useState<'upload' | 'record'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lectureTitle, setLectureTitle] = useState('');

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Upload & Progress state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  const [progress, setProgress] = useState<LectureProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up recorded audio object URL
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, [recordedAudioUrl]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    if (!lectureTitle) {
      // Auto-suggest cleaned title from filename
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setLectureTitle(cleanName);
    }
  };

  // Recording Handlers
  const startRecording = async () => {
    setRecordingError(null);
    audioChunksRef.current = [];
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 500);

      if (!lectureTitle) {
        const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLectureTitle(`Lecture Recording (${dateStr})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied or unavailable.';
      setRecordingError(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const resetRecording = () => {
    stopRecording();
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    setRecordingError(null);
  };

  // Submit and Track Progress
  const handleSubmit = async () => {
    const fileToUpload = mode === 'upload' ? selectedFile : recordedAudioBlob;
    if (!fileToUpload) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setProgress({ status: 'converting', percent: 5 });

    try {
      const res = await api.uploadLecture(fileToUpload, lectureTitle || 'Untitled Lecture');
      setActiveLectureId(res.id);

      // Poll progress endpoint
      let isDone = false;
      while (!isDone) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        try {
          const currentProgress = await api.getLectureProgress(res.id);
          setProgress(currentProgress);

          if (currentProgress.status === 'done') {
            isDone = true;
            setIsSubmitting(false);
            if (onUploadSuccess) {
              onUploadSuccess(res.id);
            }
            break;
          } else if (currentProgress.status === 'failed') {
            isDone = true;
            setIsSubmitting(false);
            setErrorMessage('Processing failed during offline analysis.');
            break;
          }
        } catch (pollErr) {
          console.error('Error polling progress:', pollErr);
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to upload lecture.';
      setErrorMessage(msg);
    }
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden ${className}`}
    >
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <span>Add Lecture</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Process audio locally on your GPU. No cloud transmission.
          </p>
        </div>

        {/* Mode selector */}
        {!isSubmitting && (
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'upload'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setMode('record')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'record'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Record Live</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-6">
        {/* If currently submitting or processing, show the active Progress Panel */}
        {isSubmitting && progress ? (
          <div className="space-y-6 py-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5">
                {STAGE_DESCRIPTIONS[progress.status]?.icon ?? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                )}
                <span className="font-semibold text-slate-200">
                  {STAGE_DESCRIPTIONS[progress.status]?.label ?? 'Processing on your local GPU...'}
                </span>
              </div>
              <span className="font-mono text-sm font-bold text-indigo-400">
                {Math.round(progress.percent)}%
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-800/90 rounded-full h-3 overflow-hidden border border-slate-700/50 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                  STAGE_DESCRIPTIONS[progress.status]?.color ?? 'from-indigo-500 to-indigo-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, progress.percent))}%` }}
              />
            </div>

            {/* Stages overview */}
            <div className="grid grid-cols-5 gap-2 pt-2 text-[11px] text-center font-medium">
              {[
                { key: 'converting', label: 'Audio Extract' },
                { key: 'transcribing', label: 'Whisper GPU' },
                { key: 'embedding', label: 'Embeddings' },
                { key: 'summarizing', label: 'Summary' },
                { key: 'flashcards', label: 'Flashcards' },
              ].map((step, idx) => {
                const stageOrder = ['converting', 'transcribing', 'embedding', 'summarizing', 'flashcards', 'done'];
                const currentIdx = stageOrder.indexOf(progress.status);
                const stepIdx = stageOrder.indexOf(step.key);
                const isPassed = currentIdx > stepIdx || progress.status === 'done';
                const isCurrent = progress.status === step.key;

                return (
                  <div
                    key={step.key}
                    className={`p-2 rounded-lg border transition-all ${
                      isCurrent
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 font-semibold shadow-sm'
                        : isPassed
                        ? 'border-slate-800 bg-slate-950/60 text-slate-400'
                        : 'border-slate-900 bg-slate-950/30 text-slate-600'
                    }`}
                  >
                    <div className="text-[10px] text-slate-500 mb-0.5 font-mono">0{idx + 1}</div>
                    <div>{step.label}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>Local GPU acceleration active</span>
              </span>
              <span className="text-slate-500 font-mono">0 bytes transmitted externally</span>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Lecture Title Input */}
            <div>
              <label
                htmlFor="lecture-title-input"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Lecture Title
              </label>
              <input
                id="lecture-title-input"
                type="text"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                placeholder="e.g., Computer Systems — Cache Architecture"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Mode 1: Drag & Drop Upload */}
            {mode === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.webm,.mp4,.ogg,.flac"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
                    isDragging
                      ? 'border-indigo-400 bg-indigo-950/30 scale-[1.01]'
                      : selectedFile
                      ? 'border-indigo-500/60 bg-indigo-950/15'
                      : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/40 bg-slate-950/40'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      selectedFile ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedFile ? (
                      <FileAudio className="w-6 h-6" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>

                  <div>
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-semibold text-white break-all">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatFileSize(selectedFile.size)} · Click or drop another file to replace
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          Drop audio or video lecture here, or <span className="text-indigo-400 underline">browse</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          MP3, WAV, M4A, AAC, WEBM, MP4 (Up to 2GB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Live Microphone Recording */}
            {mode === 'record' && (
              <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl space-y-4 text-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Timer Display */}
                  <div
                    className={`text-3xl font-mono font-bold tracking-wider ${
                      isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                    }`}
                  >
                    {formatTimer(recordingSeconds)}
                  </div>

                  {/* Pulsing indicator when recording */}
                  {isRecording && (
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                      </span>
                      <span>Recording lecture audio via browser microphone...</span>
                    </div>
                  )}

                  {/* Recording controls */}
                  <div className="flex items-center gap-3 pt-2">
                    {!isRecording && !recordedAudioBlob && (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-rose-950/50 transition-all"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Recording</span>
                      </button>
                    )}

                    {isRecording && (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-all"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        <span>Stop Recording</span>
                      </button>
                    )}

                    {!isRecording && recordedAudioBlob && (
                      <>
                        <button
                          type="button"
                          onClick={resetRecording}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Re-record</span>
                        </button>
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Audio captured ({formatTimer(recordingSeconds)})</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Audio preview playback */}
                  {recordedAudioUrl && !isRecording && (
                    <div className="w-full pt-2">
                      <audio controls src={recordedAudioUrl} className="w-full h-9 rounded-lg" />
                    </div>
                  )}

                  {recordingError && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{recordingError}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded text-xs font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={
                  (mode === 'upload' && !selectedFile) ||
                  (mode === 'record' && (!recordedAudioBlob || isRecording))
                }
                onClick={handleSubmit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold shadow-lg shadow-indigo-950/50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <Cpu className="w-4 h-4" />
                <span>Process Lecture Offline</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPanel;
