import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  ExternalLink,
  BookOpen,
  RotateCcw,
  Bot,
  User,
  Clock,
  Lightbulb,
  SearchX,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { AskCitation, AskResponse, LecternApiClient, LectureListItem } from '../types';
import { formatTime } from './Transcript';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citations?: AskCitation[];
  timestamp: string;
  isNotCovered?: boolean;
}

export interface AskPanelProps {
  api: LecternApiClient;
  lectures?: LectureListItem[];
  onNavigateToCitation?: (lectureId: string, timestampSec: number) => void;
  className?: string;
  initialQuestion?: string;
}

const SUGGESTED_QUESTIONS = [
  'What is the core difference between Raft and Paxos?',
  'Why do Transformers divide dot-products by sqrt(d_k)?',
  'What is the purpose of phi-nodes in SSA form?',
  'How does Raft prevent split-brain during partitions?',
];

export const AskPanel: React.FC<AskPanelProps> = ({
  api,
  lectures = [],
  onNavigateToCitation,
  className = '',
  initialQuestion = '',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        'Hello! I am your local offline lecture assistant. Ask me questions about any concepts discussed in your uploaded lectures, and I will cite exact timestamps.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState(initialQuestion);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAsking]);

  // Sync initial question if changed
  useEffect(() => {
    if (initialQuestion) {
      setInputQuery(initialQuestion);
      inputRef.current?.focus();
    }
  }, [initialQuestion]);

  const handleSend = async (questionText?: string) => {
    const query = (questionText || inputQuery).trim();
    if (!query || isAsking) return;

    setError(null);
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsAsking(true);

    try {
      const response: AskResponse = await api.ask(query);

      const isNotCovered =
        response.answer.toLowerCase().includes('not covered in your lectures') ||
        (response.citations.length === 0 &&
          response.answer.toLowerCase().includes('not covered'));

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        content: response.answer,
        citations: response.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isNotCovered,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to query offline assistant.';
      setError(msg);
    } finally {
      setIsAsking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        content:
          'Conversation reset. Ask any question across your offline lecture corpus.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-xl overflow-hidden h-[640px] ${className}`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Ask Across All Lectures</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/60 font-semibold">
                Offline RAG
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Grounded strictly in your local transcript vectors.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearChat}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Reset conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isUser
                    ? 'bg-slate-800 text-slate-200 border-slate-700'
                    : 'bg-indigo-950 text-indigo-400 border-indigo-700/60'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-[85%] sm:max-w-[75%] space-y-2`}>
                {msg.isNotCovered ? (
                  /* Distinct, friendly state for "Not covered in your lectures" */
                  <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-sm shadow-lg space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                      <SearchX className="w-5 h-5 text-amber-400" />
                      <span>Not covered in your lectures</span>
                    </div>

                    <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
                      We searched across all your local transcripts and couldn&apos;t find this topic.
                      Lectern strictly grounds its answers in your uploaded materials to guarantee zero hallucinations.
                    </p>

                    {lectures.length > 0 && (
                      <div className="pt-2 border-t border-amber-700/30">
                        <div className="text-[11px] font-semibold text-amber-300/90 mb-1.5 flex items-center gap-1">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                          <span>Topics available in your current lectures:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {lectures.map((lec) => (
                            <button
                              key={lec.id}
                              type="button"
                              onClick={() => handleSend(`Tell me about ${lec.title}`)}
                              className="px-2 py-1 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-200 text-[11px] border border-amber-700/50 transition-colors text-left truncate max-w-xs"
                            >
                              {lec.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard response bubble */
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-950/50'
                        : 'bg-slate-950/80 text-slate-100 border border-slate-800 rounded-tl-none shadow-md'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>

                    {/* Citations Chips */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                        <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Sources & Audio Citations:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.citations.map((cite, cIdx) => (
                            <button
                              key={`${cite.lectureId}-${cite.start}-${cIdx}`}
                              type="button"
                              onClick={() =>
                                onNavigateToCitation &&
                                onNavigateToCitation(cite.lectureId, cite.start)
                              }
                              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 hover:border-indigo-500 text-indigo-300 text-xs font-medium transition-all shadow-sm"
                              title={`Jump to ${cite.lectureTitle} at ${formatTime(cite.start)}`}
                            >
                              <Clock className="w-3 h-3 text-indigo-400 group-hover:text-indigo-200" />
                              <span className="font-semibold text-slate-200">
                                {cite.lectureTitle.split(':')[0]} · {formatTime(cite.start)}
                              </span>
                              <ExternalLink className="w-3 h-3 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`text-[10px] text-slate-500 font-mono px-1 ${
                    isUser ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading state while asking */}
        {isAsking && (
          <div className="flex items-start gap-3 animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-700/60 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-xs flex items-center gap-2.5 shadow-md">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>Scanning local transcript vectors & generating answer...</span>
            </div>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSend()}
              className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts if few messages */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/60">
          <div className="text-[11px] text-slate-400 font-medium mb-1.5 flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-indigo-400" />
            <span>Suggested questions:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700 text-left truncate max-w-xs"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Input Box */}
      <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question across all lectures... (e.g., 'What is Raft consensus?')"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!inputQuery.trim() || isAsking}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white shadow-md shadow-indigo-950/60 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Send query"
            aria-label="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AskPanel;
