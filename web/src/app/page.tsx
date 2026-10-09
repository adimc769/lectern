import { Mic, Upload, BookOpen, Search, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-10">
      {/* Top Banner / Hero */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/80 to-slate-950 p-6 sm:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700/40 text-xs font-medium text-indigo-300">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Local Hardware Acceleration Active</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Study smarter with private, offline lecture intelligence.
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Record or drop lecture audio to generate GPU-transcribed timestamps, section summaries, key terms, 
            interactive flashcards, and cited cross-lecture Q&A—completely off the grid.
          </p>
        </div>
      </div>

      {/* Primary Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Audio Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Upload Audio Recording</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Upload MP3, WAV, M4A, or WebM lecture files. Audio is normalized via FFmpeg and transcribed locally by Whisper.cpp.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
            <span>Supports up to 2-hour audio</span>
            <span className="font-semibold text-indigo-400 cursor-pointer hover:underline">Select File &rarr;</span>
          </div>
        </div>

        {/* Live In-Browser Record Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-lg bg-rose-950 border border-rose-700/50 flex items-center justify-center text-rose-400">
              <Mic className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Record Classroom Lecture</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Record live audio directly inside the browser using your microphone. Processed immediately with zero cloud transmission.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
            <span>Built-in MediaRecorder</span>
            <span className="font-semibold text-rose-400 cursor-pointer hover:underline">Start Recording &rarr;</span>
          </div>
        </div>
      </div>

      {/* Cross-Lecture Search Bar Placeholder */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-4">
        <div className="flex items-center space-x-2 text-white font-semibold">
          <Search className="w-4 h-4 text-indigo-400" />
          <span>Cross-Lecture Semantic Search & Q&A</span>
        </div>
        <div className="relative">
          <input
            type="text"
            readOnly
            placeholder="Ask a question across all your lectures (e.g. 'What is the second law of thermodynamics?')"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 cursor-not-allowed"
          />
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Grounded in top 5 semantic chunks with exact timestamp citations [Lecture N, mm:ss]</span>
        </div>
      </div>

      {/* Recent Lectures Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Your Lectures</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">0 Total</span>
        </div>

        <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto text-slate-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-medium text-slate-300">No lectures processed yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload an audio recording or record a live class to view automated transcripts, section summaries, and flashcards.
          </p>
        </div>
      </div>
    </div>
  );
}
