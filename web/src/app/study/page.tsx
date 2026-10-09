'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchLecture, fetchLectures, getFallbackLectures, notifyBackendFallback } from '../../lib/api';
import { StudyHome } from '../../../../packages/ui/src/study/StudyHome';
import { MASTERED_BOX } from '../../../../packages/ui/src/study/srs';
import { getAllBoxes as getBoxes, getStreak } from '../../../../packages/ui/src/study/studyStore';

interface HomeRow {
  id: string;
  title: string;
  cardCount: number;
  masteredCount: number;
  quizCount: number;
}

async function fetchQuizCount(id: string): Promise<number> {
  try {
    const res = await fetch(`/api/lectures/${encodeURIComponent(id)}/quiz`, { cache: 'no-store' });
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

export default function StudyHomePage() {
  const router = useRouter();
  const [rows, setRows] = useState<HomeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list;
      try {
        list = await fetchLectures();
      } catch {
        list = getFallbackLectures();
        notifyBackendFallback();
      }
      const built = await Promise.all(
        list.map(async (l) => {
          try {
            const detail = await fetchLecture(l.id);
            const cards = detail.flashcards ?? [];
            const boxes = getBoxes(l.id);
            const mastered = cards.filter((c) => (boxes[c.id] ?? 1) >= MASTERED_BOX).length;
            return {
              id: l.id,
              title: l.title,
              cardCount: cards.length,
              masteredCount: mastered,
              quizCount: await fetchQuizCount(l.id),
            };
          } catch {
            return { id: l.id, title: l.title, cardCount: 0, masteredCount: 0, quizCount: 0 };
          }
        })
      );
      if (!cancelled) {
        setRows(built);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#0F172A] dark:border-white border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Opening Study Circuit...</p>
      </div>
    );
  }

  const totalMastered = rows.reduce((sum, r) => sum + r.masteredCount, 0);

  return (
    <StudyHome
      lectures={rows}
      streak={getStreak()}
      totalMastered={totalMastered}
      onOpenLecture={(id) => router.push(`/study/${encodeURIComponent(id)}`)}
      onStudyAll={() => {
        const next = rows.find((r) => r.masteredCount < r.cardCount && r.cardCount > 0) ?? rows[0];
        if (next) router.push(`/study/${encodeURIComponent(next.id)}`);
      }}
    />
  );
}
