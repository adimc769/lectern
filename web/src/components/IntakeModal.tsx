'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Mic,
  X,
  FileAudio,
  FileText,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  AlertCircle,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { uploadLecture } from '../lib/api';
import { createTextDocument, uploadDocument } from '../lib/documents';

const DOC_MAX_BYTES = 25 * 1024 * 1024;
const DOC_EXTENSIONS = ['pdf', 'docx', 'txt'];

/**
 * Validates a candidate document file in SPEC order: extension → size → empty.
 * Returns the exact SPEC copy for the first failure, or null when valid.
 */
function validateDocumentFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!DOC_EXTENSIONS.includes(ext)) {
    return 'That file type is not supported. Only PDF, DOCX, and TXT files are accepted — choose a different file.';
  }
  if (file.size > DOC_MAX_BYTES) {
    return 'File exceeds the 25 MB limit. Split the document or use a smaller file, then try again.';
  }
  if (file.size === 0) {
    return 'This file contains no readable text. Check the file contents and try again.';
  }
  return null;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'upload' | 'record' | 'document';
};

export function IntakeModal({ isOpen, onClose, initialTab }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upload' | 'record' | 'document'>(
    initialTab ?? 'upload'
  );

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Document Upload State (single file XOR pasted notes, never both)
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docText, setDocText] = useState('');
  const [isDocDragOver, setIsDocDragOver] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  // Microphone Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordTitle, setRecordTitle] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close on Escape key — on the document tab this discards without storing anything
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (activeTab === 'document') {
          setDocFile(null);
          setDocText('');
          setErrorMessage(null);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, activeTab]);

  // Open directly on the requested tab when the caller asks for one
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
      setErrorMessage(null);
    }
  }, [isOpen, initialTab]);

  // Clean up streams & URLs
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

  if (!isOpen) return null;

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|webm|ogg|flac|aac)$/i.test(file.name)) {
        setSelectedFile(file);
        if (!uploadTitle) {
          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        setErrorMessage(null);
      } else {
        setErrorMessage('Please select a valid audio file (MP3, WAV, M4A, WebM, FLAC).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      setErrorMessage(null);
    }
  };

  // Document intake handlers (single file XOR pasted notes)
  const acceptDocFile = (file: File) => {
    const violation = validateDocumentFile(file);
    if (violation) {
      setErrorMessage(violation);
      return;
    }
    setDocFile(file);
    setDocText('');
    setErrorMessage(null);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      acceptDocFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleDocDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!docText.trim()) setIsDocDragOver(true);
  };

  const handleDocDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDocDragOver(false);
  };

  const handleDocDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDocDragOver(false);
    if (docText.trim()) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      acceptDocFile(e.dataTransfer.files[0]);
    }
  };

  const handleDocTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDocText(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const removeDocFile = () => {
    setDocFile(null);
    setErrorMessage(null);
  };

  /** Clears document inputs with no library trace (pre-upload discard). */
  const discardDocument = () => {
    setDocFile(null);
    setDocText('');
    setDocTitle('');
    setErrorMessage(null);
  };

  // Recording handlers
  const startRecording = async () => {
    setErrorMessage(null);
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setRecordSeconds(0);
    audioChunksRef.current = [];

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      audioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        if (!recordTitle) {
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setRecordTitle(`Lecture Recording (${time})`);
        }
      };

      mediaRecorder.start(500);
      setIsRecording(true);
      setIsPaused(false);

      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Microphone error: ${msg}`);
      setIsRecording(false);
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
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
    setRecordSeconds(0);
    setErrorMessage(null);
  };

  // Document submit — navigates to the source view on success
  const handleDocumentSubmit = async () => {
    const trimmedText = docText.trim();
    const hasFile = docFile !== null;
    const hasText = trimmedText.length > 0;
    if ((hasFile && hasText) || (!hasFile && !hasText)) return;
    if (docFile) {
      const violation = validateDocumentFile(docFile);
      if (violation) {
        setErrorMessage(violation);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const finalTitle =
        docTitle.trim() ||
        (docFile ? docFile.name.replace(/\.[^/.]+$/, '') : 'Pasted Notes');
      const res = docFile
        ? await uploadDocument(docFile, finalTitle)
        : await createTextDocument(finalTitle, trimmedText);
      discardDocument();
      onClose();
      // Land on the document source view with live extraction progress
      router.push(`/documents/${res.id}`);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please retry.');
    }
  };

  const hasDocFile = docFile !== null;
  const hasDocText = docText.trim().length > 0;
  const canSubmitDocument =
    !isSubmitting && ((hasDocFile && !hasDocText) || (!hasDocFile && hasDocText)) && !errorMessage;

  // Submit & Navigate to /lectures/[id]
  const handleSubmit = async () => {
    if (activeTab === 'document') {
      await handleDocumentSubmit();
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let fileOrBlob: File | Blob;
      let finalTitle: string;

      if (activeTab === 'upload') {
        if (!selectedFile) return;
        fileOrBlob = selectedFile;
        finalTitle = uploadTitle.trim() || selectedFile.name.replace(/\.[^/.]+$/, '');
      } else {
        if (!recordedBlob) return;
        fileOrBlob = recordedBlob;
        finalTitle = recordTitle.trim() || 'Recorded Lecture';
      }

      const res = await uploadLecture(fileOrBlob, finalTitle);
      onClose();
      // Navigate directly to the lecture workspace to view 5-step progress
      router.push(`/lectures/${res.id}`);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed. Please retry.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intake-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E5DF] dark:border-[#1E293B] flex items-center justify-between">
          <div>
            <h2 id="intake-title" className="text-base font-semibold text-[#0F172A] dark:text-white">
              Add Study Material
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Transcribed and summarized on your device
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={activeTab === 'document' ? 'Close document upload' : 'Close dialog'}
            title={activeTab === 'document' ? 'Close document upload' : 'Close dialog'}
            className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F4F4F0] dark:hover:bg-[#1E293B] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div role="tablist" aria-label="Study material intake" className="flex border-b border-[#E5E5DF] dark:border-[#1E293B] px-6 bg-[#FAF9F5] dark:bg-[#101827]">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upload'}
            onClick={() => {
              setActiveTab('upload');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-[#0F172A] dark:border-white text-[#0F172A] dark:text-white'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'record'}
            onClick={() => {
              setActiveTab('record');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'record'
                ? 'border-[#0F172A] dark:border-white text-[#0F172A] dark:text-white'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Record Live</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'document'}
            onClick={() => {
              setActiveTab('document');
              setErrorMessage(null);
            }}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'document'
                ? 'border-[#0F172A] dark:border-white text-[#0F172A] dark:text-white'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {activeTab === 'upload' ? (
            /* Upload File Form */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-upload-title" className="block text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  Lecture Title <span className="text-[#94A3B8] font-normal">(Optional)</span>
                </label>
                <input
                  id="modal-upload-title"
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Biology 101: Cell Respiration"
                  className="w-full bg-[#FFFFFF] dark:bg-[#0B0F19] border border-[#CBD5E1] dark:border-[#1E293B] rounded-lg px-3.5 py-2 text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8]"
                />
              </div>

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-[#0F172A] dark:border-white bg-[#FAF9F5] dark:bg-[#19233C]'
                    : selectedFile
                    ? 'border-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/10'
                    : 'border-[#CBD5E1] dark:border-[#1E293B] hover:border-[#94A3B8] bg-[#FAF9F5] dark:bg-[#0B0F19]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="modal-file-input"
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {selectedFile ? (
                  <div className="flex items-center justify-between text-left px-2">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center shrink-0">
                        <FileAudio className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-[#0F172A] dark:text-white truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-2">
                    <div className="w-9 h-9 rounded-full bg-[#E2E8F0] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-[#0F172A] dark:text-white">
                      Drop audio file here, or <span className="text-[#2563EB] dark:text-[#60A5FA] underline">browse files</span>
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Supports MP3, WAV, M4A, WebM, FLAC (up to 2 GB)
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'record' ? (
            /* Microphone Record Form */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-record-title" className="block text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  Lecture Title <span className="text-[#94A3B8] font-normal">(Optional)</span>
                </label>
                <input
                  id="modal-record-title"
                  type="text"
                  value={recordTitle}
                  onChange={(e) => setRecordTitle(e.target.value)}
                  placeholder="e.g. Calculus II: Integration by Parts"
                  className="w-full bg-[#FFFFFF] dark:bg-[#0B0F19] border border-[#CBD5E1] dark:border-[#1E293B] rounded-lg px-3.5 py-2 text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              {/* Record Stage Box */}
              <div className="border border-[#E5E5DF] dark:border-[#1E293B] rounded-xl p-6 bg-[#FAF9F5] dark:bg-[#0B0F19] text-center space-y-3">
                <div className="text-3xl font-mono font-semibold text-[#0F172A] dark:text-white">
                  {formatTimer(recordSeconds)}
                </div>

                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {isRecording
                    ? isPaused
                      ? 'Recording paused'
                      : 'Recording microphone stream...'
                    : recordedBlob
                    ? 'Audio recorded successfully'
                    : 'Click start to begin capturing class audio'}
                </p>

                {/* Record buttons */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  {!isRecording && !recordedBlob && (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-4 py-2 rounded-lg bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Mic className="w-3.5 h-3.5 text-rose-400" />
                      <span>Start Recording</span>
                    </button>
                  )}

                  {isRecording && (
                    <>
                      <button
                        type="button"
                        onClick={pauseResumeRecording}
                        className="px-3.5 py-1.5 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B] text-[#0F172A] dark:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        <span>{isPaused ? 'Resume' : 'Pause'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Finish</span>
                      </button>
                    </>
                  )}

                  {recordedBlob && !isRecording && (
                    <button
                      type="button"
                      onClick={resetRecording}
                      className="px-3 py-1.5 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B] text-[#0F172A] dark:text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Discard & Re-record</span>
                    </button>
                  )}
                </div>

                {/* Preview audio player */}
                {recordedBlob && previewUrl && !isRecording && (
                  <div className="pt-2">
                    <audio src={previewUrl} controls className="w-full h-8" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Document Upload Form — single file XOR pasted notes */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="modal-doc-title" className="block text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  Document Title <span className="text-[#94A3B8] font-normal">(Optional)</span>
                </label>
                <input
                  id="modal-doc-title"
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Biology 101: Cell Respiration notes"
                  className="w-full bg-[#FFFFFF] dark:bg-[#0B0F19] border border-[#CBD5E1] dark:border-[#1E293B] rounded-lg px-3.5 py-2 text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8]"
                />
              </div>

              {/* Document dropzone */}
              <div
                role="button"
                tabIndex={hasDocText ? -1 : 0}
                aria-label="Upload a document (PDF, DOCX, or TXT)"
                aria-disabled={hasDocText}
                onDragOver={handleDocDragOver}
                onDragLeave={handleDocDragLeave}
                onDrop={handleDocDrop}
                onClick={() => {
                  if (!hasDocText) docFileInputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (hasDocText) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    docFileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  hasDocText
                    ? 'border-[#E5E5DF] dark:border-[#1E293B] bg-[#F4F4F0] dark:bg-[#0B0F19] opacity-60 cursor-not-allowed'
                    : isDocDragOver
                    ? 'border-[#0F172A] dark:border-white bg-[#FAF9F5] dark:bg-[#19233C] cursor-pointer'
                    : docFile
                    ? 'border-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/10 cursor-pointer'
                    : 'border-[#CBD5E1] dark:border-[#1E293B] hover:border-[#94A3B8] bg-[#FAF9F5] dark:bg-[#0B0F19] cursor-pointer'
                }`}
              >
                <input
                  ref={docFileInputRef}
                  id="modal-doc-file-input"
                  type="file"
                  accept=".pdf,.docx,.txt"
                  disabled={hasDocText}
                  className="hidden"
                  onChange={handleDocFileChange}
                />

                {docFile ? (
                  <div className="flex items-center justify-between text-left px-2">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg bg-[#0D9488]/20 text-[#0D9488] flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p
                          title={docFile.name}
                          className="text-xs font-semibold text-[#0F172A] dark:text-white truncate"
                        >
                          {docFile.name}
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {(docFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDocFile();
                      }}
                      aria-label="Remove selected document"
                      title="Remove selected document"
                      className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white p-2.5 -m-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-2">
                    <div className="w-9 h-9 rounded-full bg-[#E2E8F0] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] flex items-center justify-center mx-auto mb-2">
                      <FileText className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-medium text-[#0F172A] dark:text-white">
                      Drop a document here, or{' '}
                      <span className="text-[#2563EB] dark:text-[#60A5FA] underline">browse files</span>
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Accepts PDF, DOCX, TXT up to 25 MB. Single file per upload.
                    </p>
                    {hasDocText && (
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Pasted notes active — clear the text to choose a file instead.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Paste-text box, mutually exclusive with file selection */}
              <div className="space-y-1.5">
                <label htmlFor="modal-doc-text" className="block text-xs font-medium text-[#0F172A] dark:text-slate-200">
                  Or paste notes
                </label>
                <textarea
                  id="modal-doc-text"
                  value={docText}
                  onChange={handleDocTextChange}
                  disabled={hasDocFile}
                  rows={5}
                  placeholder="Paste your notes here… (TXT-equivalent plain text, stored as a TXT source)"
                  className="w-full min-h-32 bg-[#FFFFFF] dark:bg-[#0B0F19] border border-[#CBD5E1] dark:border-[#1E293B] rounded-lg px-3.5 py-2 text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8] disabled:opacity-60 resize-y"
                />
                {hasDocFile && (
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    File selected — remove the file to paste notes instead.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Local Processing Guarantee Note */}
          <div className="p-3 rounded-lg bg-[#FAF9F5] dark:bg-[#101827] border border-[#E5E5DF] dark:border-[#1E293B] flex items-center gap-2.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0" />
            <span>Processed locally on your device. Zero internet or cloud APIs needed.</span>
          </div>

          {/* Error notice */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#FAF9F5] dark:bg-[#101827] border-t border-[#E5E5DF] dark:border-[#1E293B] flex items-center justify-end gap-3">
          {activeTab === 'document' ? (
            <button
              type="button"
              onClick={() => {
                discardDocument();
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
            >
              Discard Document
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={
              activeTab === 'document'
                ? !canSubmitDocument
                : isSubmitting ||
                  (activeTab === 'upload' && !selectedFile) ||
                  (activeTab === 'record' && (!recordedBlob || isRecording))
            }
            onClick={handleSubmit}
            className="px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-[#0F172A] dark:disabled:hover:bg-white text-white dark:text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
          >
            {isSubmitting
              ? 'Starting local processing...'
              : activeTab === 'document'
              ? 'Process Document'
              : 'Process Lecture'}
          </button>
        </div>
      </div>
    </div>
  );
}
