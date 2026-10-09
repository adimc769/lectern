'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import { uploadLecture } from '../lib/api';

type Props = {
  onRecordingComplete?: (blob: Blob, title: string) => void;
  onUploadSuccess?: (lectureId: string) => void;
  className?: string;
};

export function AudioRecorder({
  onRecordingComplete,
  onUploadSuccess,
  className = '',
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lectureTitle, setLectureTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const formatSeconds = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio recording is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(finalBlob);
        const url = URL.createObjectURL(finalBlob);
        setPreviewUrl(url);

        if (!lectureTitle) {
          const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLectureTitle(`Recorded Lecture (${timestampStr})`);
        }
      };

      mediaRecorder.start(500); // 500ms chunk slice
      setIsRecording(true);
      setIsPaused(false);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Microphone access error: ${errorMsg}`);
      setIsRecording(false);
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  };

  const resetRecording = () => {
    stopRecording();
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordingSeconds(0);
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!recordedBlob) return;

    const title = lectureTitle.trim() || 'Recorded Lecture';
    onRecordingComplete?.(recordedBlob, title);

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await uploadLecture(recordedBlob, title);
      onUploadSuccess?.(result.id);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(`Failed to submit recording: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Live Audio Recorder"
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Live Microphone Recording</h3>
            <p className="text-xs text-slate-400">
              Record classroom lectures directly inside your browser. 100% on-device capture.
            </p>
          </div>
        </div>

        {/* Live Status Pill */}
        {isRecording && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-xs font-semibold text-rose-300 animate-pulse shadow-sm shadow-rose-950"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{isPaused ? 'PAUSED' : 'RECORDING LIVE'}</span>
          </div>
        )}
      </div>

      {/* Main Recording Display */}
      <div className="text-center py-4 space-y-4">
        {/* Animated Microphone Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording
                ? isPaused
                  ? 'bg-amber-950/70 border-2 border-amber-500 text-amber-400'
                  : 'bg-rose-950/90 border-2 border-rose-500 text-rose-400 shadow-xl shadow-rose-900/40 animate-pulse'
                : recordedBlob
                ? 'bg-emerald-950/80 border-2 border-emerald-500/60 text-emerald-400'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Mic className="w-10 h-10" />
          </div>

          {/* Concentric sound wave pulses when active */}
          {isRecording && !isPaused && (
            <div className="absolute inset-0 rounded-full border border-rose-500/30 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Elapsed Timer Display */}
        <div className="space-y-1">
          <p
            className="text-4xl font-black font-mono tracking-tight text-white"
            aria-live="polite"
          >
            {formatSeconds(recordingSeconds)}
          </p>
          <p className="text-xs text-slate-500 font-mono">
            {isRecording
              ? isPaused
                ? 'Recording paused — click resume to continue'
                : 'Microphone stream active (Opus 48kHz)'
              : recordedBlob
              ? `Capture duration: ${formatSeconds(recordingSeconds)}`
              : 'Click start to begin capturing lecture audio'}
          </p>
        </div>

        {/* Audio Waveform Bars Simulation */}
        {isRecording && !isPaused && (
          <div className="flex items-center justify-center gap-1.5 h-8">
            {[40, 75, 55, 90, 60, 30, 80, 65, 95, 50, 85, 45].map((height, idx) => (
              <div
                key={idx}
                className="w-1 bg-rose-500 rounded-full animate-pulse"
                style={{
                  height: `${height}%`,
                  animationDelay: `${(idx % 4) * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {!isRecording && !recordedBlob && (
            <button
              type="button"
              onClick={startRecording}
              className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          )}

          {isRecording && (
            <>
              <button
                type="button"
                onClick={pauseResumeRecording}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors flex items-center gap-2"
              >
                {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                onClick={stopRecording}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Recording</span>
              </button>
            </>
          )}

          {recordedBlob && !isRecording && (
            <button
              type="button"
              onClick={resetRecording}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-record</span>
            </button>
          )}
        </div>
      </div>

      {/* Audio Playback Preview & Title Input (after recording stops) */}
      {recordedBlob && previewUrl && !isRecording && (
        <div className="space-y-4 pt-4 border-t border-slate-800">
          {/* Lecture Title Input */}
          <div className="space-y-1.5">
            <label htmlFor="recorded-title-input" className="block text-xs font-semibold text-slate-300">
              Lecture Title <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              id="recorded-title-input"
              type="text"
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              placeholder="e.g. CS101: Distributed Systems"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Native Audio Preview */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-indigo-400 shrink-0" />
            <audio
              src={previewUrl}
              controls
              className="w-full h-8 accent-indigo-500"
              aria-label="Recorded lecture preview audio"
            />
          </div>

          {/* Submit / Upload Button */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isUploading}
              onClick={handleUpload}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isUploading ? 'Submitting to Local GPU...' : 'Process Recorded Audio'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Recording Notice: </span>
            {errorMessage}
          </div>
        </div>
      )}
    </div>
  );
}
