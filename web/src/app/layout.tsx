import type { Metadata } from 'next';
import './globals.css';
import { OfflineBadge } from '../components/OfflineBadge';

export const metadata: Metadata = {
  title: 'Lectern — Offline Lecture Workstation',
  description: 'Local GPU-accelerated lecture transcription, summarization, flashcards, and cited cross-lecture Q&A.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-zinc-100 antialiased">
        {/* Top Header */}
        <header className="border-b border-zinc-850 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            {/* Brand Logo & Workstation Indicator */}
            <div className="flex items-center space-x-3">
              <div className="w-7 h-7 rounded-md bg-zinc-900 border border-zinc-750 flex items-center justify-center font-mono font-bold text-xs text-zinc-200">
                L
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm tracking-tight text-zinc-100">Lectern</span>
                <span className="text-[11px] font-mono text-zinc-500 border-l border-zinc-800 pl-2">
                  offline workstation
                </span>
              </div>
            </div>

            {/* Offline Hardware Status */}
            <OfflineBadge />
          </div>
        </header>

        {/* Main Workspace Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-zinc-900 py-4 text-center text-[11px] font-mono text-zinc-600">
          <p>Local Runtime: Whisper.cpp (CUDA) · Ollama (qwen2.5) · SQLite Vector · Zero Network Egress</p>
        </footer>
      </body>
    </html>
  );
}
