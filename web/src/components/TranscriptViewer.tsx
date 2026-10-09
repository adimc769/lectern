'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Search,
  Copy,
  Check,
  Radio,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import type { TranscriptSegmentDTO } from '@lectern/shared';

type Props = {
  segments: TranscriptSegmentDTO[];
  audioUrl?: string;
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
  className?: string;
};

export function TranscriptViewer({
  segments = [],
  audioUrl,
  initialTime = 0,
  onTimeUpdate,
  className = '',
}: Props) {
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [useSpeechFallback, setUseSpeechFallback] = useState(!audioUrl);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const speechUttRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Calculate total duration from segments or audio element
  const totalDuration = useMemo(() => {
    if (segments.length === 0) return 0;
    const last = segments[segments.length - 1];
    return last.endTime || last.startTime + 10;
  }, [segments]);

  // Find currently active segment
  const activeSegmentIndex = useMemo(() => {
    return segments.findIndex(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );
  }, [segments, currentTime]);

  // Initial time seek if provided
  useEffect(() => {
    if (initialTime > 0 && initialTime !== currentTime) {
      seekToTime(initialTime);
    }
  }, [initialTime]);

  // Keep auto-scroll in view
  useEffect(() => {
    if (autoScroll && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSegmentIndex, autoScroll]);

  // Audio element listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTime = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      // Audio file missing or unplayable; automatically fallback to local speech synthesis
      setUseSpeechFallback(true);
    };

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate]);

  // Speech synthesis fallback loop when audio file is not available
  useEffect(() => {
    if (!useSpeechFallback) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (!isPlaying) {
      window.speechSynthesis.cancel();
      return;
    }

    // When playing in speech synthesis fallback mode
    const activeSeg = segments[activeSegmentIndex >= 0 ? activeSegmentIndex : 0];
    if (activeSeg) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(activeSeg.text);
      utt.rate = playbackRate;
      utt.volume = isMuted ? 0 : volume;

      utt.onend = () => {
        // Advance to next segment
        const nextIdx = (activeSegmentIndex >= 0 ? activeSegmentIndex : 0) + 1;
        if (nextIdx < segments.length) {
          setCurrentTime(segments[nextIdx].startTime);
        } else {
          setIsPlaying(false);
        }
      };

      speechUttRef.current = utt;
      window.speechSynthesis.speak(utt);
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isPlaying, activeSegmentIndex, useSpeechFallback, playbackRate, isMuted, volume, segments]);

  const togglePlay = useCallback(() => {
    if (useSpeechFallback) {
      setIsPlaying((prev) => !prev);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        // Fallback to speech synthesis if browser restricts audio
        setUseSpeechFallback(true);
        setIsPlaying(true);
      });
    }
  }, [isPlaying, useSpeechFallback]);

  const seekToTime = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, totalDuration));
      setCurrentTime(clamped);
      onTimeUpdate?.(clamped);

      if (audioRef.current && !useSpeechFallback) {
        audioRef.current.currentTime = clamped;
      }
    },
    [totalDuration, onTimeUpdate, useSpeechFallback]
  );

  const handleSkip = (deltaSeconds: number) => {
    seekToTime(currentTime + deltaSeconds);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.muted = false;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.muted = true;
    }
  };

  const copyTranscriptText = async () => {
    const fullText = segments
      .map((s) => `[${formatTime(s.startTime)}] ${s.text}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter segments for search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  return (
    <div className={`flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden backdrop-blur-sm ${className}`}>
      {/* Hidden HTML5 Audio Element */}
      {audioUrl && !useSpeechFallback && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          aria-hidden="true"
        />
      )}

      {/* Top Controls Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            aria-label="Filter transcript text"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          {searchQuery && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
              {filteredSegments.length} found
            </span>
          )}
        </div>

        {/* Toolbar items */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll((prev) => !prev)}
            aria-pressed={autoScroll}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              autoScroll
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Narration Mode Badge */}
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
              useSpeechFallback
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-700/40'
            }`}
            title={useSpeechFallback ? 'Narrating with on-device speech synthesis' : 'Playing local audio recording'}
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="text-[11px]">{useSpeechFallback ? 'Device Narration' : 'Audio Sync'}</span>
          </div>

          {/* Copy Transcript Button */}
          <button
            type="button"
            onClick={copyTranscriptText}
            aria-label="Copy entire transcript to clipboard"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Copy full transcript"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Transcript Segments List */}
      <div
        ref={scrollContainerRef}
        role="region"
        aria-label="Synchronized lecture transcript"
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 divide-y divide-slate-800/40 max-h-[500px]"
      >
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            {searchQuery ? 'No matching transcript lines found.' : 'No transcript segments available.'}
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const isActive =
              currentTime >= segment.startTime && currentTime <= segment.endTime;

            return (
              <div
                key={segment.id}
                ref={isActive ? activeLineRef : null}
                onClick={() => {
                  seekToTime(segment.startTime);
                  if (!isPlaying) togglePlay();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    seekToTime(segment.startTime);
                    if (!isPlaying) togglePlay();
                  }
                }}
                aria-current={isActive ? 'time' : undefined}
                className={`pt-2.5 pb-2 px-3 rounded-xl transition-all cursor-pointer group flex items-start gap-3 text-left ${
                  isActive
                    ? 'bg-indigo-950/60 border-l-4 border-indigo-500 shadow-md shadow-indigo-950/50'
                    : 'hover:bg-slate-800/50 border-l-4 border-transparent'
                }`}
              >
                {/* Timestamp Pill */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    seekToTime(segment.startTime);
                    if (!isPlaying) togglePlay();
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 group-hover:text-indigo-300 group-hover:bg-indigo-950/50'
                  }`}
                  aria-label={`Jump to ${formatTime(segment.startTime)}`}
                >
                  {formatTime(segment.startTime)}
                </button>

                {/* Segment Text */}
                <p
                  className={`text-sm leading-relaxed transition-colors flex-1 ${
                    isActive
                      ? 'text-white font-medium'
                      : 'text-slate-300 group-hover:text-white'
                  }`}
                >
                  {segment.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Synchronized Playback Bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md space-y-3">
        {/* Scrubber slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1 relative flex items-center">
            <input
              type="range"
              min={0}
              max={totalDuration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => seekToTime(parseFloat(e.target.value))}
              aria-label="Audio playback seeker"
              aria-valuemin={0}
              aria-valuemax={totalDuration}
              aria-valuenow={currentTime}
              aria-valuetext={formatTime(currentTime)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <span className="text-xs font-mono text-slate-500 w-12">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Player Controls */}
        <div className="flex items-center justify-between">
          {/* Left: Play/Pause and Skip buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSkip(-5)}
              aria-label="Skip backward 5 seconds"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Back 5s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => handleSkip(5)}
              aria-label="Skip forward 5 seconds"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Forward 5s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Speed & Volume Controls */}
          <div className="flex items-center gap-3">
            {/* Playback Speed selector */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {[0.8, 1, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRateChange(rate)}
                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                    playbackRate === rate
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume level"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
