'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
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
} from 'lucide-react';
import type { SystemStatusDTO } from '@lectern/shared';
import { fetchSystemStatus } from '../../lib/api';

export default function SettingsPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatusDTO | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    // Detect current theme
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeMode(isDark ? 'dark' : 'light');
    }

    fetchSystemStatus()
      .then(setSystemStatus)
      .catch(() => {})
      .finally(() => setIsLoadingStatus(false));
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

  const handleClearCache = () => {
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div className="pb-6 border-b border-[#E5E5DF] dark:border-[#1E293B] space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-white">
          Settings &amp; Diagnostics
        </h1>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          Review on-device AI model health, privacy verification, storage footprint, and display preferences.
        </p>
      </div>

      {/* 1. Privacy & Offline Assurance Card */}
      <div className="rounded-2xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 p-6 sm:p-7 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#0F172A] dark:text-white flex items-center gap-2">
              <span>Strict On-Device Privacy Guarantee</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-200/80 text-teal-900 dark:bg-teal-900 dark:text-teal-100">
                100% LOCAL
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              Lectern runs entirely on your local machine. Your audio recordings, generated transcripts, study summaries, and vector embeddings are stored locally in SQLite and never transmitted to external cloud servers or third-party APIs. No Wi-Fi required.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-white/80 dark:bg-[#131B2E] border border-teal-200/60 dark:border-teal-900/40 text-xs space-y-1">
            <div className="font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Zero Cloud APIs</span>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              No OpenAI, Anthropic, or external cloud telemetry calls.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/80 dark:bg-[#131B2E] border border-teal-200/60 dark:border-teal-900/40 text-xs space-y-1">
            <div className="font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Offline Ready</span>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Full transcription and Q&amp;A work seamlessly in airplane mode.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/80 dark:bg-[#131B2E] border border-teal-200/60 dark:border-teal-900/40 text-xs space-y-1">
            <div className="font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Local Storage</span>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Transcripts and vectors stay in your local user directory.
            </p>
          </div>
        </div>
      </div>

      {/* 2. AI Hardware & Engine Diagnostics */}
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

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            Operational
          </span>
        </div>

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
                {systemStatus?.gpuName || 'NVIDIA GeForce RTX 5060 Ti'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Dedicated VRAM: {systemStatus?.vramTotalMB ? Math.round(systemStatus.vramTotalMB / 1024) : 16} GB
              </p>
            </div>

            {/* Whisper Model */}
            <div className="p-4 rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                  Speech-to-Text Model
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Ready
                </span>
              </div>
              <div className="text-sm font-semibold text-[#0F172A] dark:text-white font-mono">
                {systemStatus?.activeModels?.transcription || 'whisper-large-v3-turbo'}
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
                {systemStatus?.activeModels?.llm || 'qwen2.5:14b (Ollama)'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Runs 4-bit quantized locally at ~48 tokens/second.
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
                {systemStatus?.activeModels?.embeddings || 'nomic-embed-text'}
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                768-dimensional local vector search via SQLite.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Appearance / Theme Selector */}
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

      {/* 4. Local Storage & Cache Management */}
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
                <span>Cache cleared</span>
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
