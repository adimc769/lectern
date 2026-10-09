'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  Send,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Quote,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import type { CitationItem, LectureDTO } from '@lectern/shared';
import { askQuestion, fetchLectures } from '../../lib/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: CitationItem[];
  unsupported?: boolean;
  timestamp: string;
}

const STARTER_PROMPTS = [
  'Why does Raft use randomized election timers?',
  'What is the formula for scaled dot-product attention?',
  'How do phi-nodes work in SSA form?',
  'What is quantum computing?', // Demonstrates ungrounded state
];

function AskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusedLectureId = searchParams.get('lectureId');

  const [lectures, setLectures] = useState<LectureDTO[]>([]);
  const [focusedLectureTitle, setFocusedLectureTitle] = useState<string | null>(null);

  const [inputQuestion, setInputQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I can answer questions across your lecture library using fully local vector search. Every answer includes timestamped citations to where the professor explained the concept.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [expandedCitationIds, setExpandedCitationIds] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchLectures().then((list) => {
      setLectures(list);
      if (focusedLectureId) {
        const found = list.find((l) => l.id === focusedLectureId);
        if (found) setFocusedLectureTitle(found.title);
      }
    }).catch(() => {});
  }, [focusedLectureId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitting]);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuestion).trim();
    if (!q || isSubmitting) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsSubmitting(true);

    try {
      const res = await askQuestion(q);
      const asstMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        citations: res.citations,
        unsupported: res.unsupported,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, asstMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: 'An error occurred during local inference. Please verify that Ollama is running.',
        unsupported: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimestamp = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleCitationSnippet = (citationKey: string) => {
    setExpandedCitationIds((prev) => {
      const next = new Set(prev);
      if (next.has(citationKey)) {
        next.delete(citationKey);
      } else {
        next.add(citationKey);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5DF] dark:border-[#1E293B] shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              Ask Lectern
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50">
              Local RAG
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Search across your lectures. Every answer is grounded with clickable timestamp citations.
          </p>
        </div>

        {focusedLectureTitle && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF9F5] dark:bg-[#19233C] border border-[#E5E5DF] dark:border-[#1E293B] text-xs">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Focusing:</span>
            <span className="font-semibold text-[#0F172A] dark:text-white truncate max-w-[180px]">
              {focusedLectureTitle}
            </span>
            <Link
              href="/ask"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-1"
            >
              Reset
            </Link>
          </div>
        )}
      </div>

      {/* Starter Queries (when only welcome message exists) */}
      {messages.length === 1 && (
        <div className="space-y-2 p-4 rounded-2xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#131B2E] shadow-xs shrink-0">
          <div className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Try asking:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                className="px-3 py-1.5 rounded-xl bg-[#FAF9F5] hover:bg-[#F4F4F0] dark:bg-[#19233C] dark:hover:bg-[#1E293B] border border-[#E5E5DF] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-white transition-colors cursor-pointer text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1.5 ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] px-1 font-medium">
              <span>{msg.sender === 'user' ? 'You' : 'Lectern Assistant'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            <div
              className={`rounded-2xl p-4 sm:p-5 max-w-[92%] sm:max-w-[85%] text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A] shadow-xs'
                  : 'bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] text-[#1E293B] dark:text-[#CBD5E1] shadow-xs space-y-3'
              }`}
            >
              {/* If unsupported (Not covered in lectures) */}
              {msg.unsupported ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Not covered in your lectures</span>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                    {msg.text}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                    Lectern only cites material from lectures you have uploaded. Check the course syllabus or add additional lecture recordings.
                  </p>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Grounded Citation Chips */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-[#F1F1EC] dark:border-[#1E293B] space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                        Grounded Citations:
                      </div>

                      <div className="space-y-2">
                        {msg.citations.map((cite, cIdx) => {
                          const citeKey = `${msg.id}-cite-${cIdx}`;
                          const isExpanded = expandedCitationIds.has(citeKey);
                          const isDoc = !lectures.some((l) => l.id === cite.lectureId);
                          const targetHref = isDoc
                            ? `/documents/${cite.lectureId}`
                            : `/lectures/${cite.lectureId}?tab=transcript&t=${cite.startTime}`;
                          const locLabel = isDoc
                            ? (cite.startTime > 0 ? `Page ${cite.startTime}` : 'Document')
                            : formatTimestamp(cite.startTime);

                          return (
                            <div
                              key={cIdx}
                              className="rounded-xl border border-[#E5E5DF] dark:border-[#1E293B] bg-[#FAF9F5] dark:bg-[#19233C] p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                {/* Clickable jump link */}
                                <Link
                                  href={targetHref}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <span className="truncate max-w-[220px] sm:max-w-md">
                                    {cite.lectureTitle || (isDoc ? 'Document' : 'Lecture')}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#E5E5DF] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]">
                                    {locLabel}
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-[#94A3B8]" />
                                </Link>

                                {cite.textSnippet && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCitationSnippet(citeKey)}
                                    className="text-[11px] text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{isExpanded ? 'Hide quote' : 'View quote'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>

                              {/* Accordion Quote */}
                              {isExpanded && cite.textSnippet && (
                                <div className="p-2.5 rounded-lg bg-white dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] text-xs italic text-[#475569] dark:text-[#94A3B8] flex items-start gap-2">
                                  <Quote className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-0.5" />
                                  <span className="leading-relaxed">&ldquo;{cite.textSnippet}&rdquo;</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {isSubmitting && (
          <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F172A] dark:text-white" />
            <span>Searching local vector index & generating answer...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-3 border-t border-[#E5E5DF] dark:border-[#1E293B] flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            placeholder="Ask a question about your lectures..."
            className="w-full bg-[#FFFFFF] dark:bg-[#131B2E] border border-[#E5E5DF] dark:border-[#1E293B] rounded-2xl px-4 py-3 text-sm text-[#0F172A] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#38BDF8] shadow-xs"
          />
        </div>

        <button
          type="submit"
          disabled={!inputQuestion.trim() || isSubmitting}
          className="px-5 py-3 rounded-2xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-white dark:hover:bg-slate-100 disabled:opacity-40 text-white dark:text-[#0F172A] text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center space-y-3">
          <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Loading Ask Lectern...</p>
        </div>
      }
    >
      <AskContent />
    </Suspense>
  );
}
