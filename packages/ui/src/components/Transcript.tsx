import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  Copy,
  Check,
  Download,
  Scroll,
  Clock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TranscriptSegment } from '../types';

export interface TranscriptProps {
  segments: TranscriptSegment[];
  currentTime?: number;
  onSeek?: (seconds: number) => void;
  audioUrl?: string;
  lectureTitle?: string;
  className?: string;
  initialSeekTo?: number;
}

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const Transcript: React.FC<TranscriptProps> = ({
  segments,
  currentTime: externalCurrentTime,
  onSeek: externalOnSeek,
  audioUrl,
  lectureTitle = 'Lecture',
  className = '',
  initialSeekTo,
}) => {
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(initialSeekTo ?? 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceNarration, setVoiceNarration] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Active audio element ref or synthetic timer ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syntheticTimerRef = useRef<number | null>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenIndexRef = useRef<number | null>(null);

  // Calculate total duration from segments if audio not loaded
  const maxSegmentEnd = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 60;
  const duration =
    audioRef.current?.duration && !isNaN(audioRef.current.duration)
      ? audioRef.current.duration
      : maxSegmentEnd;

  // Sync external current time if controlled from parent
  const activeTime = externalCurrentTime !== undefined ? externalCurrentTime : playbackTime;

  // Find currently active segment
  const activeSegmentIndex = segments.findIndex(
    (seg) => activeTime >= seg.start && activeTime <= seg.end
  );

  // Pre-load available local voices on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const handleVoices = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.onvoiceschanged = handleVoices;
      return () => {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Web Speech API: narrate current line aloud in real time
  useEffect(() => {
    if (!isPlaying || !voiceNarration || isMuted || volume <= 0) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        lastSpokenIndexRef.current = null;
      }
      return;
    }

    // If activeSegmentIndex changed, speak new segment
    if (
      activeSegmentIndex >= 0 &&
      activeSegmentIndex < segments.length &&
      activeSegmentIndex !== lastSpokenIndexRef.current
    ) {
      lastSpokenIndexRef.current = activeSegmentIndex;
      const textToSpeak = segments[activeSegmentIndex].text;

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = playbackSpeed;
        utterance.volume = isMuted ? 0 : volume;

        const voices = window.speechSynthesis.getVoices();
        const enVoice =
          voices.find((v) => v.lang.startsWith('en-US')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];

        if (enVoice) {
          utterance.voice = enVoice;
        }

        window.speechSynthesis.speak(utterance);
      }
    }
  }, [isPlaying, activeSegmentIndex, voiceNarration, isMuted, volume, playbackSpeed, segments]);

  // Clean up speech synthesis on component unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Seek handler
  const handleSeek = (seconds: number) => {
    const clampedTime = Math.max(0, Math.min(seconds, duration));
    setPlaybackTime(clampedTime);
    lastSpokenIndexRef.current = null; // force re-speech on seek

    if (audioRef.current) {
      audioRef.current.currentTime = clampedTime;
    }
    if (externalOnSeek) {
      externalOnSeek(clampedTime);
    }
  };

  // Initial seek if requested
  useEffect(() => {
    if (initialSeekTo !== undefined && initialSeekTo >= 0) {
      handleSeek(initialSeekTo);
    }
  }, [initialSeekTo]);

  // Audio play/pause toggle
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      lastSpokenIndexRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsPlaying(true);
      if (audioRef.current && audioUrl) {
        audioRef.current.play().catch(() => {
          // If browser audio playback fails, fallback to timer + speech synthesis
        });
      }
    }
  };

  // Synthetic playback loop (ensures playback scrubbing & line highlighting works smoothly)
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 250;
      syntheticTimerRef.current = window.setInterval(() => {
        setPlaybackTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
            return 0;
          }
          const next = prev + (intervalMs / 1000) * playbackSpeed;
          if (externalOnSeek) {
            externalOnSeek(next);
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (syntheticTimerRef.current) {
        clearInterval(syntheticTimerRef.current);
        syntheticTimerRef.current = null;
      }
    }

    return () => {
      if (syntheticTimerRef.current) {
        clearInterval(syntheticTimerRef.current);
      }
    };
  }, [isPlaying, duration, playbackSpeed, externalOnSeek]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (!autoScroll || activeSegmentIndex === -1) return;
    const el = segmentRefs.current.get(activeSegmentIndex);
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSegmentIndex, autoScroll]);

  // Playback speed cycle
  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Copy full transcript text
  const handleCopyTranscript = () => {
    const fullText = segments.map((s) => `[${formatTime(s.start)}] ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download transcript
  const handleDownloadTranscript = () => {
    const fullText = segments
      .map((s) => `[${formatTime(s.start)} - ${formatTime(s.end)}]\n${s.text}\n`)
      .join('\n');
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lectureTitle.replace(/\s+/g, '_')}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter segments by search query
  const filteredSegments = segments.filter((seg) =>
    seg.text.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden ${className}`}
    >
      {/* Real audio element if audioUrl exists */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setPlaybackTime(audioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
            }
          }}
        />
      )}

      {/* Floating Audio Player Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
        {/* Scrubber track */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-slate-300 w-11 text-right">
            {formatTime(activeTime)}
          </span>
          <div className="relative flex-1 flex items-center group">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.5}
              value={activeTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-400 w-11">
            {formatTime(duration)}
          </span>
        </div>

        {/* Player controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            {/* Skip back 5s */}
            <button
              type="button"
              onClick={() => handleSeek(activeTime - 5)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Skip back 5s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Main Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/60 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title={isPlaying ? 'Pause' : 'Play audio narration'}
              aria-label={isPlaying ? 'Pause' : 'Play audio narration'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white" />
              ) : (
                <Play className="w-4 h-4 fill-white ml-0.5" />
              )}
            </button>

            {/* Skip forward 5s */}
            <button
              type="button"
              onClick={() => handleSeek(activeTime + 5)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Skip forward 5s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Playback speed selector */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>

            {/* Volume / Mute Controls */}
            <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setIsMuted((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-slate-300" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hidden sm:inline-block"
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>
          </div>

          {/* Right Toolbar & Status Indicators */}
          <div className="flex items-center gap-2">
            {/* Audio Voice Narration Toggle */}
            <button
              type="button"
              onClick={() => setVoiceNarration((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                voiceNarration
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title="Toggle offline spoken narration of transcript lines"
            >
              {isPlaying && voiceNarration && !isMuted ? (
                <span className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-emerald-400 h-2 animate-pulse" />
                  <span className="w-0.5 bg-emerald-400 h-3 animate-pulse delay-75" />
                  <span className="w-0.5 bg-emerald-400 h-1.5 animate-pulse delay-150" />
                </span>
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {voiceNarration ? 'Voice Audio: ON' : 'Voice Audio: OFF'}
              </span>
            </button>

            {/* Auto scroll toggle */}
            <button
              type="button"
              onClick={() => setAutoScroll((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                autoScroll
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle auto-scroll to current speaking line"
            >
              <Scroll className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Auto-scroll</span>
            </button>

            {/* Copy transcript */}
            <button
              type="button"
              onClick={handleCopyTranscript}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Copy transcript text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Download transcript */}
            <button
              type="button"
              onClick={handleDownloadTranscript}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Download transcript (.txt)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Audio Narration Status Bar */}
        {isPlaying && (
          <div className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-indigo-900/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-emerald-300 font-medium">
                {audioUrl
                  ? 'Playing recorded lecture audio file'
                  : 'Narrating lecture aloud using on-device voice synthesis'}
              </span>
            </div>
            <span className="text-slate-400 font-mono text-[10px]">
              {activeSegmentIndex >= 0 ? `Segment #${activeSegmentIndex + 1}` : 'Seeking'}
            </span>
          </div>
        )}
      </div>

      {/* Transcript Search Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within this transcript..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>
        <span className="text-[11px] text-slate-500 font-mono px-2">
          {filteredSegments.length} segments
        </span>
      </div>

      {/* Transcript Lines Scroll View */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[520px] divide-y divide-slate-800/40"
      >
        {filteredSegments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No transcript segments match &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredSegments.map((segment, index) => {
            const isCurrentActive =
              activeTime >= segment.start && activeTime <= segment.end;

            return (
              <div
                key={`${segment.start}-${index}`}
                ref={(el) => {
                  if (el) segmentRefs.current.set(index, el);
                  else segmentRefs.current.delete(index);
                }}
                onClick={() => {
                  handleSeek(segment.start);
                  if (!isPlaying) {
                    setIsPlaying(true);
                  }
                }}
                className={`group p-3 rounded-xl transition-all duration-150 cursor-pointer flex items-start gap-3.5 border ${
                  isCurrentActive
                    ? 'bg-indigo-950/50 border-indigo-500/80 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/30'
                    : 'border-transparent hover:bg-slate-800/40 hover:border-slate-800'
                }`}
              >
                {/* Timestamp Pill */}
                <button
                  type="button"
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                    isCurrentActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-950 text-indigo-400 border border-slate-800 group-hover:bg-slate-800 group-hover:border-slate-700'
                  }`}
                  title={`Jump to ${formatTime(segment.start)}`}
                >
                  <Clock className="w-3 h-3 opacity-70" />
                  <span>{formatTime(segment.start)}</span>
                </button>

                {/* Spoken Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm leading-relaxed ${
                      isCurrentActive
                        ? 'text-white font-medium'
                        : 'text-slate-300 group-hover:text-slate-100'
                    }`}
                  >
                    {segment.text}
                  </p>
                </div>

                {/* Active Indicator Chip */}
                {isCurrentActive && (
                  <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono font-bold text-indigo-300 uppercase px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                    <span>Speaking</span>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Transcript;
