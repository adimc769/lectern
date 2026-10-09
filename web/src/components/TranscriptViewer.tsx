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

  const totalDuration = useMemo(() => {
    if (segments.length === 0) return 0;
    const last = segments[segments.length - 1];
    return last.endTime || last.startTime + 10;
  }, [segments]);

  const activeSegmentIndex = useMemo(() => {
    return segments.findIndex(
      (s) => currentTime >= s.startTime && currentTime <= s.endTime
    );
  }, [segments, currentTime]);

  useEffect(() => {
    if (initialTime > 0 && initialTime !== currentTime) {
      seekToTime(initialTime);
    }
  }, [initialTime]);

  useEffect(() => {
    if (autoScroll && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeSegmentIndex, autoScroll]);

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

  // Speech synthesis fallback
  useEffect(() => {
    if (!useSpeechFallback) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (!isPlaying) {
      window.speechSynthesis.cancel();
      return;
    }

    const activeSeg = segments[activeSegmentIndex >= 0 ? activeSegmentIndex : 0];
    if (activeSeg) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(activeSeg.text);
      utt.rate = playbackRate;
      utt.volume = isMuted ? 0 : volume;

      utt.onend = () => {
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

  const filteredSegments = useMemo(() => {
    const rawList = segments || [];
    const clampedList = totalDuration > 0
      ? rawList
          .filter((s) => s.startTime < totalDuration)
          .map((s) => ({
            ...s,
            startTime: Math.min(s.startTime, Math.max(0, totalDuration - 0.2)),
            endTime: Math.min(s.endTime, totalDuration),
          }))
      : rawList;

    if (!searchQuery.trim()) return clampedList;
    const q = searchQuery.toLowerCase();
    return clampedList.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, searchQuery, totalDuration]);

  return (
    <div
      role="region"
      aria-label="Synchronized Transcript"
      className={`flex flex-col h-full rounded-lg border border-zinc-800 bg-zinc-900/40 shadow-sm overflow-hidden ${className}`}
    >
      {audioUrl && !useSpeechFallback && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" aria-hidden="true" />
      )}

      {/* Toolbar */}
      <div className="p-3 border-b border-zinc-850 bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript..."
            aria-label="Search transcript"
            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 pl-8 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
          />
          {searchQuery && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-mono">
              {filteredSegments.length} hits
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto font-mono text-[11px]">
          <button
            type="button"
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`px-2 py-1 rounded border transition-colors ${
              autoScroll
                ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
          >
            auto-scroll: {autoScroll ? 'on' : 'off'}
          </button>

          <span className="px-2 py-1 rounded border border-zinc-800 bg-zinc-900 text-zinc-400">
            {useSpeechFallback ? 'tts narration' : 'audio sync'}
          </span>

          <button
            type="button"
            onClick={copyTranscriptText}
            aria-label="Copy entire transcript text"
            className="p-1.5 rounded border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Copy transcript text"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Transcript Rows */}
      <div
        ref={scrollContainerRef}
        role="feed"
        aria-label="Transcript lines"
        className="flex-1 overflow-y-auto p-4 space-y-1 divide-y divide-zinc-850/40 max-h-[500px]"
      >
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs font-mono">
            {searchQuery ? 'No lines matching filter query.' : 'No transcript data.'}
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const isActive = currentTime >= segment.startTime && currentTime <= segment.endTime;

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
                className={`pt-2 pb-1.5 px-3 rounded transition-colors cursor-pointer flex items-start gap-3 text-left ${
                  isActive
                    ? 'bg-zinc-850 border-l-2 border-indigo-400 text-zinc-100'
                    : 'hover:bg-zinc-900 border-l-2 border-transparent text-zinc-300'
                }`}
              >
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-850 shrink-0 select-none">
                  {formatTime(segment.startTime)}
                </span>
                <p className="text-xs leading-relaxed flex-1 select-text">
                  {segment.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Clean Audio Transport Bar */}
      <div className="p-3 border-t border-zinc-850 bg-zinc-950/80 space-y-2 font-mono">
        {/* Scrubber */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={totalDuration || 100}
            step={0.5}
            value={currentTime}
            onChange={(e) => seekToTime(parseFloat(e.target.value))}
            aria-label="Seek audio"
            className="flex-1 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-200"
          />
          <span className="w-10 text-zinc-600">{formatTime(totalDuration)}</span>
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSkip(-5)}
              aria-label="Rewind 5 seconds"
              className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="px-3 py-1 rounded bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSkip(5)}
              aria-label="Forward 5 seconds"
              className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Speed pills */}
            <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[10px]">
              {[0.8, 1, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleRateChange(rate)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    playbackRate === rate
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="text-zinc-500 hover:text-zinc-300"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume"
                className="w-14 h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-zinc-200"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
