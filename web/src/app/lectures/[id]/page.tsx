'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, BookOpen } from 'lucide-react';
import type { LectureDTO } from '@lectern/shared';
import { fetchLecture } from '../../../lib/api';
import { LectureWorkspace, type WorkspaceTab } from '../../../components/LectureWorkspace';

export default function LectureDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const tabParam = searchParams.get('tab') as WorkspaceTab | null;
  const timeParam = searchParams.get('t');
  const targetTimestamp = timeParam ? parseFloat(timeParam) : undefined;

  const [lecture, setLecture] = useState<LectureDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetchLecture(id)
      .then((data) => {
        setLecture(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Could not load lecture details.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Opening lecture study workspace...
        </p>
      </div>
    );
  }

  if (error || !lecture) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">
            Lecture Not Found
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {error || `We couldn't locate a lecture with identifier "${id}". It may have been deleted or moved.`}
          </p>
        </div>
        <div>
          <Link
            href="/lectures"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B] dark:bg-white dark:text-[#0F172A] text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to My Lectures</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LectureWorkspace
      initialLecture={lecture}
      initialTab={tabParam || 'summary'}
      initialTimestamp={targetTimestamp}
    />
  );
}
