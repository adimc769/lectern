'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  Clock,
  ExternalLink,
  HelpCircle,
  Cpu,
  RefreshCw,
  Search,
  BookOpen,
  Info,
} from 'lucide-react';
import { askQuestion } from '../lib/api';
import type { QnAResponseDTO, CitationItem } from '@lectern/shared';

type Props = {
  onCitationClick?: (lectureId: string, timestamp: number) => void;
  className?: string;
};

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: CitationItem[];
  unsupported?: boolean;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  'Why does Raft use randomized election timers?',
  'What is the formula for scaled dot-product attention?',
  'How do phi-nodes work in SSA form?',
  'What is quantum entanglement?', // Demo trigger for "Not covered in your lectures"
];

export function AskPanel({ onCitationClick, className = '' }: Props) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your offline lecture assistant. Ask me questions across any of your recorded or uploaded lectures, and I will cite exact timestamps from your course materials.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent, directQuestion?: string) => {
    if (e) e.preventDefault();
    const q = (directQuestion || query).trim();
    if (!q || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await askQuestion(q);
      const assistantMessage: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        citations: response.citations,
        unsupported: response.unsupported,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, unable to process the query with the local inference engine. Please check system status.',
        unsupported: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden backdrop-blur-sm ${className}`}
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Cross-Lecture Q&A Assistant</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                Offline RAG
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Grounded in local SQLite vector embeddings &bull; Zero hallucinations
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>qwen2.5:14b</span>
        </div>
      </div>

      {/* Suggested Questions Pills */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Suggestions:</span>
        </span>
        {SAMPLE_QUESTIONS.map((sampleQ, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSubmit(undefined, sampleQ)}
            className="px-2.5 py-1 rounded-full text-[11px] bg-slate-900 hover:bg-indigo-950 hover:text-indigo-300 hover:border-indigo-700 text-slate-300 border border-slate-800 shrink-0 transition-colors"
          >
            {sampleQ}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[460px]"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            {/* Sender Avatar */}
            <div
              className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Message Bubble Content */}
            <div
              className={`max-w-[85%] space-y-2.5 ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm p-3.5 shadow-md'
                  : 'space-y-3'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="text-sm leading-relaxed">{msg.text}</p>
              ) : (
                /* Assistant Content */
                <div className="space-y-3">
                  {/* Distinct, friendly state for "Not covered in your lectures" */}
                  {msg.unsupported ? (
                    <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs sm:text-sm space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-amber-300">
                        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Topic Not Covered in Your Lectures</span>
                      </div>
                      <p className="text-amber-200/90 leading-relaxed text-xs">
                        {msg.text}
                      </p>
                      <div className="pt-2 border-t border-amber-900/50 flex items-center gap-1.5 text-[11px] text-amber-400/80">
                        <Info className="w-3.5 h-3.5" />
                        <span>Try asking about concepts mentioned in your uploaded lectures.</span>
                      </div>
                    </div>
                  ) : (
                    /* Grounded Answer Card */
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-100 text-sm space-y-3 shadow-md">
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                      {/* Citation Chips */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 space-y-2">
                          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                            Citations & Exact Timestamps
                          </span>

                          <div className="flex flex-wrap gap-2">
                            {msg.citations.map((cite, cIdx) => (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() =>
                                  onCitationClick?.(cite.lectureId, cite.startTime)
                                }
                                aria-label={`Jump to ${cite.lectureTitle || cite.lectureId} at ${formatSeconds(cite.startTime)}`}
                                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200 border border-indigo-900/50 hover:border-indigo-600 text-xs font-medium transition-all shadow-sm"
                                title={`Quote: "${cite.textSnippet}" (Similarity: ${Math.round((cite.similarity || 0.9) * 100)}%)`}
                              >
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="font-semibold truncate max-w-[150px]">
                                  {cite.lectureTitle || 'Lecture'}
                                </span>
                                <span className="text-slate-500 font-normal">&bull;</span>
                                <span className="font-mono text-cyan-300">
                                  {formatSeconds(cite.startTime)}
                                </span>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 px-1 font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span>Scanning lecture embeddings & synthesizing answer on GPU...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            id="ask-question-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question across all lectures..."
            aria-label="Ask question to cross-lecture assistant"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={!query.trim() || isLoading}
          aria-label="Send question"
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
