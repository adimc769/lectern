'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  ExternalLink,
  RefreshCw,
  Search,
  BookOpen,
} from 'lucide-react';
import { askQuestion } from '../lib/api';
import type { CitationItem } from '@lectern/shared';

type Props = {
  onCitationClick?: (lectureId: string, timestamp: number) => void;
  className?: string;
};

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: CitationItem[];
  unsupported?: boolean;
  timeString: string;
}

const SAMPLE_QUERIES = [
  'Why does Raft use randomized election timers?',
  'What is the formula for scaled dot-product attention?',
  'How do phi-nodes work in SSA form?',
  'What is quantum computing?', // Demonstrates ungrounded state
];

export function QnAChat({ onCitationClick, className = '' }: Props) {
  const [inputQuestion, setInputQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Ask questions across your ingested lectures. Answers are grounded in local SQLite vector chunks with timestamp citations.',
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomScrollRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isSubmitting]);

  const handleSend = async (e?: React.FormEvent, directText?: string) => {
    if (e) e.preventDefault();
    const query = (directText || inputQuestion).trim();
    if (!query || isSubmitting) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion('');
    setIsSubmitting(true);

    try {
      const response = await askQuestion(query);
      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        citations: response.citations,
        unsupported: response.unsupported,
        timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Inference error: local Ollama pipeline did not return a response.',
        unsupported: true,
        timeString: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      role="region"
      aria-label="Cross-lecture Q&A"
      className={`flex flex-col h-full rounded-lg border border-zinc-800 bg-zinc-900/40 shadow-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-3 border-b border-zinc-850 bg-zinc-950/60 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-300">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold">CROSS-LECTURE Q&A</span>
        </div>
        <span className="text-[10px] text-zinc-500">OLLAMA RAG &bull; SQLITE-VEC</span>
      </div>

      {/* Query Suggestion Pills */}
      <div className="px-3 py-2 bg-zinc-950/40 border-b border-zinc-850 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] font-mono">
        <span className="text-zinc-600 shrink-0">examples:</span>
        {SAMPLE_QUERIES.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(undefined, q)}
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-200 text-zinc-400 border border-zinc-800 shrink-0 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[460px] text-xs"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1 ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 px-1">
              <span>{msg.sender === 'user' ? 'YOU' : 'ASSISTANT'}</span>
              <span>&bull;</span>
              <span>{msg.timeString}</span>
            </div>

            <div
              className={`rounded-md p-3 max-w-[90%] leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'bg-zinc-950 text-zinc-300 border border-zinc-850 space-y-2.5'
              }`}
            >
              {msg.unsupported ? (
                <div className="space-y-1.5 text-zinc-400 font-mono text-[11px]">
                  <p className="text-zinc-300 font-sans">{msg.text}</p>
                  <p className="text-zinc-500 pt-1 border-t border-zinc-850">
                    Hint: Only topics discussed in your uploaded lectures can be cited.
                  </p>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Scholarly Citation Chips */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-zinc-850 space-y-1.5 font-mono text-[11px]">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                        Citations:
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((cite, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() =>
                              onCitationClick?.(cite.lectureId, cite.startTime)
                            }
                            aria-label={`Jump to ${cite.lectureTitle} at timestamp ${formatSeconds(cite.startTime)}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-100 text-zinc-400 border border-zinc-800 transition-colors cursor-pointer"
                            title={`Quote: "${cite.textSnippet}"`}
                          >
                            <span className="text-zinc-300">
                              {cite.lectureTitle ? cite.lectureTitle.split(':')[0] : 'Lecture'}
                            </span>
                            <span className="text-zinc-500">&bull;</span>
                            <span className="text-zinc-400 font-medium">
                              {formatSeconds(cite.startTime)}
                            </span>
                            <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {isSubmitting && (
          <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Scanning SQLite vector embeddings...</span>
          </div>
        )}

        <div ref={bottomScrollRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="p-2.5 border-t border-zinc-850 bg-zinc-950/70 flex items-center gap-2"
      >
        <input
          id="qna-search-input"
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          placeholder="Query course knowledge base..."
          aria-label="Query course knowledge base"
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-mono"
        />

        <button
          type="submit"
          disabled={!inputQuestion.trim() || isSubmitting}
          aria-label="Submit query"
          className="p-2 rounded bg-zinc-100 hover:bg-white disabled:bg-zinc-850 disabled:text-zinc-600 text-zinc-950 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
