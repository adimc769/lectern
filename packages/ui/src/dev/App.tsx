import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  BookOpen,
  MessageSquare,
  Upload,
  Cpu,
  RefreshCw,
  Sliders,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { createMockApiClient } from '../mockApi';
import type { LectureDetail, LectureListItem, LectureProgress } from '../types';
import { OfflineBadge } from '../components/OfflineBadge';
import { UploadPanel } from '../components/UploadPanel';
import { LectureList } from '../components/LectureList';
import { LecturePage } from '../components/LecturePage';
import { AskPanel } from '../components/AskPanel';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { FailedState } from '../components/FailedState';
import { JobProgressState } from '../components/JobProgressState';

type ActiveView = 'lectures' | 'ask' | 'upload' | 'states-demo';

export const App: React.FC = () => {
  // Initialize mock API client
  const mockApi = useMemo(() => createMockApiClient({ simulatedProgressSpeedMs: 900 }), []);

  // UI Navigation State
  const [activeView, setActiveView] = useState<ActiveView>('lectures');
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>('lec-1');
  const [seekToTimestamp, setSeekToTimestamp] = useState<number | undefined>(undefined);

  // Data state
  const [lectures, setLectures] = useState<LectureListItem[]>([]);
  const [activeLectureDetail, setActiveLectureDetail] = useState<LectureDetail | null>(null);
  const [isLoadingLectures, setIsLoadingLectures] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [lecturesError, setLecturesError] = useState<string | null>(null);

  // Dev tools state
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [showDevControls, setShowDevControls] = useState(false);
  const [demoStateMode, setDemoStateMode] = useState<'loading' | 'empty' | 'failed' | 'progress'>('progress');

  // Long running job demo state
  const [demoProgress, setDemoProgress] = useState<LectureProgress>({
    status: 'transcribing',
    percent: 48,
  });

  // Fetch lectures list
  const loadLectures = async () => {
    setIsLecturesError(null);
    setIsLoadingLectures(true);
    try {
      const data = await mockApi.getLectures();
      setLectures(data);
      if (!selectedLectureId && data.length > 0) {
        setSelectedLectureId(data[0].id);
      }
    } catch (err) {
      setLecturesError(err instanceof Error ? err.message : 'Failed to load lectures.');
    } finally {
      setIsLoadingLectures(false);
    }
  };

  const setIsLecturesError = (err: string | null) => setLecturesError(err);

  // Fetch active lecture detail
  const loadLectureDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const data = await mockApi.getLecture(id);
      setActiveLectureDetail(data);
    } catch (err) {
      console.error('Failed to load lecture detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadLectures();
  }, []);

  useEffect(() => {
    if (selectedLectureId) {
      loadLectureDetail(selectedLectureId);
    } else {
      setActiveLectureDetail(null);
    }
  }, [selectedLectureId]);

  // Handle citation chip navigation from AskPanel
  const handleNavigateToCitation = (lectureId: string, timestampSec: number) => {
    setSelectedLectureId(lectureId);
    setSeekToTimestamp(timestampSec);
    setActiveView('lectures');
  };

  // Handle upload completion
  const handleUploadSuccess = async (newLectureId: string) => {
    await loadLectures();
    setSelectedLectureId(newLectureId);
    setActiveView('lectures');
  };

  // Reset mock data
  const handleResetData = async () => {
    mockApi.reset();
    await loadLectures();
    setSelectedLectureId('lec-1');
    setActiveView('lectures');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-950/60 ring-1 ring-indigo-400/30">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">Lectern</span>
                <span className="text-[10px] font-mono uppercase bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/60 font-semibold">
                  Local AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Offline Lecture Assistant</p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveView('lectures');
                setSeekToTimestamp(undefined);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'lectures'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lectures</span>
              <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 bg-slate-950 rounded-full text-slate-400">
                {lectures.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('ask')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'ask'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ask AI Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('upload')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'upload'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add / Record</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('states-demo')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'states-demo'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>State Gallery</span>
            </button>
          </nav>

          {/* Right Header: Offline Badge & Dev Simulation Controls */}
          <div className="flex items-center gap-3">
            <OfflineBadge forceOffline={simulateOffline} />

            <button
              type="button"
              onClick={() => setShowDevControls((prev) => !prev)}
              className={`p-2 rounded-xl border text-xs font-medium transition-colors ${
                showDevControls
                  ? 'bg-indigo-950 border-indigo-700 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Dev Simulation Toolbar"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Dev Simulation Toolbar (Collapsible) */}
      {showDevControls && (
        <aside aria-label="Dev controls toolbar" className="bg-slate-900/90 border-b border-indigo-900/50 px-4 py-2 text-xs animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-slate-300">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-indigo-400 flex items-center gap-1 font-mono text-[11px]">
                <Cpu className="w-3.5 h-3.5" />
                <span>DEV SIMULATION TOOLBAR:</span>
              </span>

              {/* Force Offline toggle */}
              <button
                type="button"
                onClick={() => setSimulateOffline((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  simulateOffline
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {simulateOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                <span>Simulate Offline: {simulateOffline ? 'ON' : 'OFF'}</span>
              </button>

              {/* Reset seed data button */}
              <button
                type="button"
                onClick={handleResetData}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-300 transition-colors"
              >
                <RefreshCw className="w-3 h-3 text-indigo-400" />
                <span>Reset Seed Lectures</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 italic">
              All UI interactions run against local MockLecternApi with realistic delays.
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Navigation bar */}
      <div className="flex md:hidden border-b border-slate-800 bg-slate-950 p-2 overflow-x-auto gap-1">
        <button
          type="button"
          onClick={() => setActiveView('lectures')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeView === 'lectures' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Lectures ({lectures.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveView('ask')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeView === 'ask' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Ask AI
        </button>
        <button
          type="button"
          onClick={() => setActiveView('upload')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeView === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Add / Record
        </button>
        <button
          type="button"
          onClick={() => setActiveView('states-demo')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            activeView === 'states-demo' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          States Demo
        </button>
      </div>

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* VIEW 1: Lectures Library & Detail */}
        {activeView === 'lectures' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Sidebar: Lecture List */}
            <div className="lg:col-span-4 xl:col-span-4">
              <LectureList
                lectures={lectures}
                selectedLectureId={selectedLectureId}
                onSelectLecture={(id) => {
                  setSelectedLectureId(id);
                  setSeekToTimestamp(undefined);
                }}
                onNewLecture={() => setActiveView('upload')}
                isLoading={isLoadingLectures}
                error={lecturesError}
                onRetry={loadLectures}
              />
            </div>

            {/* Right Main Area: Lecture Page */}
            <div className="lg:col-span-8 xl:col-span-8">
              {isLoadingDetail ? (
                <LoadingState
                  message="Loading lecture details..."
                  submessage="Reading local vector indices and transcript data from disk."
                />
              ) : activeLectureDetail ? (
                <LecturePage
                  lecture={activeLectureDetail}
                  initialSeekTo={seekToTimestamp}
                  onAskAboutLecture={(_title) => {
                    setActiveView('ask');
                  }}
                />
              ) : (
                <EmptyState
                  title="No Lecture Selected"
                  description="Choose a lecture from the list on the left, or upload a new lecture audio file to get started."
                  actionLabel="Add New Lecture"
                  onAction={() => setActiveView('upload')}
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Global Cross-Lecture Q&A Panel */}
        {activeView === 'ask' && (
          <div className="max-w-4xl mx-auto">
            <AskPanel
              api={mockApi}
              lectures={lectures}
              onNavigateToCitation={handleNavigateToCitation}
            />
          </div>
        )}

        {/* VIEW 3: Add / Record Lecture Panel */}
        {activeView === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <UploadPanel
              api={mockApi}
              onUploadSuccess={handleUploadSuccess}
            />
          </div>
        )}

        {/* VIEW 4: States Gallery (For Judges & Developers to inspect every state) */}
        {activeView === 'states-demo' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <span>State Gallery & Edge Case Inspector</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Test every component state required by the hackathon contract (Loading, Empty, Failed with retry, Long-running jobs).
                </p>
              </div>

              {/* Selector */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { id: 'progress', label: 'Long-running Job Progress' },
                  { id: 'loading', label: 'Loading State' },
                  { id: 'empty', label: 'Empty State' },
                  { id: 'failed', label: 'Failed State (with Retry)' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setDemoStateMode(st.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      demoStateMode === st.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* State Previews */}
            {demoStateMode === 'progress' && (
              <div className="space-y-4">
                <JobProgressState
                  title="Lecture 4: Quantum Computing Fundamentals"
                  progress={demoProgress}
                  onCancel={() => alert('Job cancelled')}
                  onRetry={() =>
                    setDemoProgress({ status: 'transcribing', percent: 20 })
                  }
                />

                {/* Progress control slider for testing */}
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Simulate Job Stage:</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {demoProgress.status} ({demoProgress.percent}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { status: 'converting', percent: 15 },
                      { status: 'transcribing', percent: 45 },
                      { status: 'embedding', percent: 68 },
                      { status: 'summarizing', percent: 85 },
                      { status: 'flashcards', percent: 95 },
                      { status: 'done', percent: 100 },
                      { status: 'failed', percent: 40 },
                    ].map((step) => (
                      <button
                        key={step.status}
                        type="button"
                        onClick={() =>
                          setDemoProgress({
                            status: step.status as any,
                            percent: step.percent,
                          })
                        }
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono"
                      >
                        {step.status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {demoStateMode === 'loading' && (
              <LoadingState
                message="Transcribing local audio with Whisper C++ GPU kernel..."
                submessage="All computations are isolated on your machine with zero external network access."
              />
            )}

            {demoStateMode === 'empty' && (
              <EmptyState
                icon={BookOpen}
                title="Your Offline Library is Clean"
                description="No lecture recordings or transcripts found on this workstation. Drag and drop audio files or record a live class to start studying."
                actionLabel="Upload Audio Lecture"
                onAction={() => setActiveView('upload')}
                secondaryActionLabel="Record with Microphone"
                onSecondaryAction={() => setActiveView('upload')}
              />
            )}

            {demoStateMode === 'failed' && (
              <FailedState
                title="Whisper GPU Out-of-Memory Error"
                message="The local transcription model failed to allocate GPU VRAM for the 32-bit float matrix. You can retry with CPU fallback or quantization."
                errorDetails="CUDA error: out of memory (attempted to allocate 1024MiB). Falling back to INT8 quantized engine on retry."
                onRetry={() => {
                  alert('Retry triggered successfully!');
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <span>Lectern Local Assistant</span>
          <span>·</span>
          <span>Offline Hackathon Edition</span>
        </div>
        <div className="text-[11px] text-slate-600 mt-1 sm:mt-0">
          Strictly local inference · No CDNs · No telemetry · No external Google Fonts
        </div>
      </footer>
    </div>
  );
};

export default App;
