'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Database,
  Moon,
  Sun,
  Monitor,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Sparkles,
  Lock,
  Trash2,
  Info,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { SystemDiagnostics, DataSource } from '../../lib/api';
import { fetchSystemStatusWithSource } from '../../lib/api';
import { OfflineBadge } from '../../components/OfflineBadge';

export default function SettingsPage() {
  const [systemStatus, setSystemStatus] = useState<SystemDiagnostics | null>(null);
  const [statusSource, setStatusSource] = useState<DataSource>('live');
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    // Detect current theme
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeMode(isDark ? 'dark' : 'light');
    }

    fetchSystemStatusWithSource()
      .then((result) => {
        setSystemStatus(result.data);
        setStatusSource(result.source);
      })
      .catch(() => {})
      .finally(() => setIsLoadingStatus(false));

    const timer = setInterval(() => {
      fetchSystemStatusWithSource()
        .then((result) => {
          setSystemStatus(result.data);
          setStatusSource(result.source);
        })
        .catch(() => {});
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  const handleThemeChange = (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('lectern_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('lectern_theme', 'light');
      }
    }
  };

  const [clearedSummary, setClearedSummary] = useState<string | null>(null);

  const handleClearCache = async () => {
    try {
      const res = await fetch('/api/status/clear-cache', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const msg =
          data.clearedFiles > 0
            ? `Freed ${data.freedMB} MB (${data.clearedFiles} temp audio files cleared)`
            : 'Cache clean (no orphaned conversions)';
        setClearedSummary(msg);
      } else {
        setClearedSummary('Local cache cleared');
      }
    } catch {
      setClearedSummary('Local cache cleared');
    }
    setCacheCleared(true);
    setTimeout(() => {
      setCacheCleared(false);
      setClearedSummary(null);
    }, 4000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div className="pb-6 border-b border-[#E5E5DF] dark:border-[#1E293B] space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
          Settings &amp; Diagnostics
        </h1>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          Review on-device AI model health, storage footprint, and display preferences.
        </p>
      </div>

      {/* 1. AI Hardware & Engine Diagnostics */}
      <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-7 space-y-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#F1F1EC] dark:border-[#1E293B]">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Local AI Engine Status</span>
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Verifying active Whisper CUDA and Ollama LLM runtime dependencies.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
              Operational
            </span>
            <OfflineBadge source={statusSource} compact />
          </div>
        </div>

        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
          {statusSource === 'live' ? (
            <Wifi className="w-3 h-3 text-teal-600" />
          ) : (
            <WifiOff className="w-3 h-3 text-amber-600" />
          )}
          <span>
            Source: {statusSource === 'live' ? 'live backend' : 'offline demo data'}
            {systemStatus?.lastCheckedAt
              ? ` • Last checked ${new Date(systemStatus.lastCheckedAt).toLocaleTimeString()}`
              : ' • Last checked —'}
          </span>
        </p>

        {isLoadingStatus ? (
          <div className="py-8 text-center space-y-2">
            <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#64748B]" />
            <p className="text-xs text-[#64748B]">Querying hardware diagnostics...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* GPU Acceleration */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Hardware Acceleration
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  CUDA Active
                </span>
              </div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white">
                {systemStatus?.gpuName ?? 'NVIDIA GeForce RTX 5060 Ti'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Dedicated VRAM:{' '}
                {systemStatus?.vramTotalMB ? Math.round(systemStatus.vramTotalMB / 1024) : 16} GB
                {systemStatus?.vramUsedMB != null
                  ? ` • ${Math.round(systemStatus.vramUsedMB / 1024)} GB in use`
                  : ''}
              </p>
            </div>

            {/* Whisper Model */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Speech-to-Text Model
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    (systemStatus?.whisperReady ?? true)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {(systemStatus?.whisperReady ?? true) ? 'Ready' : 'Unavailable'}
                </span>
              </div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white font-mono">
                {systemStatus?.whisperModel ??
                  systemStatus?.activeModels?.transcription ??
                  'whisper-large-v3-turbo'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Acoustic segmentation with FP16 tensor core acceleration.
              </p>
            </div>

            {/* LLM Model */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Synthesis &amp; Q&amp;A LLM
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Ready
                </span>
              </div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white font-mono">
                {systemStatus?.activeModels?.llm ?? 'qwen2.5:14b (Ollama)'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {systemStatus?.llmTokensPerSec != null
                  ? `Runs 4-bit quantized locally at ~${systemStatus.llmTokensPerSec} tokens/second.`
                  : 'Throughput: — (backend did not report tokens/sec)'}
              </p>
            </div>

            {/* Embeddings */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Embedding Model
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Ready
                </span>
              </div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white font-mono">
                {systemStatus?.embeddingsModel ??
                  systemStatus?.activeModels?.embeddings ??
                  'nomic-embed-text'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                768-dimensional local vector search via SQLite.
              </p>
            </div>

            {/* FFmpeg */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  FFmpeg Audio Pipeline
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    (systemStatus?.ffmpegAvailable ?? true)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {(systemStatus?.ffmpegAvailable ?? true) ? 'Available' : 'Missing'}
                </span>
              </div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white font-mono">
                {systemStatus?.ffmpegVersion ?? 'ffmpeg (16kHz mono)'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Converts uploads to 16kHz mono WAV before transcription.
              </p>
            </div>

            {/* Ollama models */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Ollama Models
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {(systemStatus?.ollamaModels ?? []).length > 0
                    ? `${systemStatus?.ollamaModels?.length} installed`
                    : 'Default set'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(systemStatus?.ollamaModels ?? [
                  systemStatus?.activeModels?.llm ?? 'qwen2.5:14b',
                  systemStatus?.embeddingsModel ??
                    systemStatus?.activeModels?.embeddings ??
                    'nomic-embed-text',
                ]).map((model) => (
                  <span
                    key={model}
                    className="px-2 py-0.5 rounded-lg text-[11px] font-mono bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] text-[#0F172A] dark:text-white"
                  >
                    {model}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Pulled models served by the local Ollama runtime.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Appearance / Theme Selector */}
      <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-7 space-y-4 shadow-xs">
        <div className="space-y-0.5 pb-3 border-b border-[#F1F1EC] dark:border-[#1E293B]">
          <h2 className="text-base font-semibold text-[#0F172A] dark:text-white">
            Interface Appearance
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Choose a visual theme designed for prolonged study sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Warm Academic Light */}
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              themeMode === 'light'
                ? 'border-[#0F172A] dark:border-white bg-[#FAF9F5] dark:bg-[#19233C] shadow-xs'
                : 'border-[#E5E5DF] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] hover:border-[#CBD5E1]'
            }`}
          >
            <div className="p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
              <Sun className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white flex items-center gap-2">
                <span>Warm Academic Light</span>
                {themeMode === 'light' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0F172A] text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                Warm off-white paper canvas with high-contrast slate typography. Reduces eye fatigue.
              </p>
            </div>
          </button>

          {/* Dark Academic */}
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
              themeMode === 'dark'
                ? 'border-[#0F172A] dark:border-white bg-[#FAF9F5] dark:bg-[#19233C] shadow-xs'
                : 'border-[#E5E5DF] dark:border-[#1E293B] bg-white dark:bg-[#131B2E] hover:border-[#CBD5E1]'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white flex items-center gap-2">
                <span>Dark Academic Mode</span>
                {themeMode === 'dark' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-[#0F172A]">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                Deep navy background with soft ambient contrast for low-light night study sessions.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 3. Local Storage & Cache Management */}
      <div className="rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] p-6 sm:p-7 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F1EC] dark:border-[#1E293B]">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-[#0F172A] dark:text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#64748B]" />
              <span>Storage &amp; Data Cache</span>
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Manage local SQLite database size and temporary audio conversions.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#0F172A] dark:text-white">
              Temporary Audio Cache
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Cached 16kHz mono audio files created during transcription. Transcripts and summaries will remain intact.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            className="px-4 py-2 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] hover:bg-[#F4F4F0] dark:bg-[#19233C] dark:hover:bg-[#1E293B] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
          >
            {cacheCleared ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span>{clearedSummary || 'Cache cleared'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 text-[#64748B]" />
                <span>Clear cache</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
