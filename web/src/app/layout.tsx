import type { Metadata } from 'next';
import './globals.css';
import { OfflineBadge } from '../components/OfflineBadge';

export const metadata: Metadata = {
  title: 'Lectern — Offline Lecture Assistant',
  description: 'Local GPU-powered transcription, summarization, flashcards, and cited Q&A.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        {/* Top Navigation & Offline Hardware Banner */}
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
                L
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight text-white">Lectern</span>
                <span className="ml-2 text-xs text-indigo-400 font-mono font-medium">v0.1.0</span>
              </div>
            </div>

            {/* Prominent Offline & Local GPU Badges */}
            <OfflineBadge />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
          <p>Lectern &bull; 100% Local Inference &bull; Whisper.cpp (CUDA) + Ollama &bull; Built for Local AI Hackathon</p>
        </footer>
      </body>
    </html>
  );
}
