'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Radio,
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

  const formatTime = (totalSec: number) => {
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
        throw new Error('Microphone recording is unavailable in this environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
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
          setLectureTitle(`Lecture Recording (${timestampStr})`);
        }
      };

      mediaRecorder.start(500);
      setIsRecording(true);
      setIsPaused(false);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Microphone error: ${errorMsg}`);
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
      setErrorMessage(`Submission failed: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Audio Recorder"
      className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 ${className}`}
    >
      {/* Device Header & Spec */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <Radio className="w-3.5 h-3.5 text-zinc-400" />
          <span>MICROPHONE CAPTURE</span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Opus 48kHz mono &bull; RAM buffer
        </span>
      </div>

      {/* Counter & VU Meter Display */}
      <div className="py-2 space-y-3">
        <div className="flex items-baseline justify-between font-mono">
          <div className="text-3xl font-semibold tracking-tight text-zinc-100">
            {formatTime(recordingSeconds)}
          </div>
          <div className="text-xs text-zinc-500">
            {isRecording
              ? isPaused
                ? 'PAUSED'
                : 'RECORDING'
              : recordedBlob
              ? 'CAPTURED'
              : 'IDLE'}
          </div>
        </div>

        {/* Minimal Audio Level Meter */}
        <div className="h-1.5 w-full bg-zinc-950 rounded-sm overflow-hidden border border-zinc-850 flex gap-0.5">
          {Array.from({ length: 24 }).map((_, idx) => {
            const isActive = isRecording && !isPaused && (idx < (recordingSeconds % 12) * 2 + 4);
            return (
              <div
                key={idx}
                className={`flex-1 transition-colors duration-75 ${
                  isActive
                    ? idx > 18
                      ? 'bg-rose-500'
                      : idx > 12
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                    : 'bg-zinc-850'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {!isRecording && !recordedBlob && (
          <button
            type="button"
            onClick={startRecording}
            className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Start Recording</span>
          </button>
        )}

        {isRecording && (
          <>
            <button
              type="button"
              onClick={pauseResumeRecording}
              className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Finish</span>
            </button>
          </>
        )}

        {recordedBlob && !isRecording && (
          <button
            type="button"
            onClick={resetRecording}
            className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs font-medium transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3 text-zinc-400" />
            <span>Discard & Re-record</span>
          </button>
        )}
      </div>

      {/* Playback Review & Submission Form */}
      {recordedBlob && previewUrl && !isRecording && (
        <div className="pt-3 border-t border-zinc-850 space-y-3">
          <div className="space-y-1">
            <label htmlFor="rec-title-input" className="block text-[11px] font-mono text-zinc-400">
              Lecture Title
            </label>
            <input
              id="rec-title-input"
              type="text"
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              placeholder="e.g. CS101: Distributed Systems"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
            />
          </div>

          <div className="p-2 rounded bg-zinc-950 border border-zinc-850 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
            <audio src={previewUrl} controls className="w-full h-7 accent-zinc-400" />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={isUploading}
              onClick={handleUpload}
              className="px-4 py-2 rounded-md bg-zinc-100 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              {isUploading ? 'Ingesting...' : 'Ingest Recorded Audio'}
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
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
