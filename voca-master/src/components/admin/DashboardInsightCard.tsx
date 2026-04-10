'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardInsightCard({
  userId,
  cachedInsight,
  cachedAt,
  isStale,
  stats,
}: {
  userId: string;
  cachedInsight: string | null;
  cachedAt: string | null;
  isStale: boolean;
  stats: {
    totalStudents: number;
    todayActive: number;
    atRiskCount: number;
    recentExamAvg: number | null;
  };
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [insight, setInsight] = useState(cachedInsight);
  const [generatedAt, setGeneratedAt] = useState(cachedAt);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const calledRef = useRef(false);

  // 날짜가 바뀌었거나 캐시가 없으면 최초 접속 시 자동 생성
  useEffect(() => {
    if (isStale && !calledRef.current) {
      calledRef.current = true;
      setAutoTriggered(true);
      generateInsight();
    }
  }, []);

  async function generateInsight() {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/dashboard/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      });
      if (res.ok) {
        const json = await res.json();
        setInsight(json.summary);
        setGeneratedAt(new Date().toISOString());
        router.refresh();
      }
    } finally {
      setIsGenerating(false);
    }
  }

  const timeAgo = generatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(generatedAt).getTime()) / 60000);
        if (mins < 1) return '방금';
        if (mins < 60) return `${mins}분 전`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}시간 전`;
        return `${Math.floor(hrs / 24)}일 전`;
      })()
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#1d1d1f]">AI 학급 인사이트</h2>
          {isGenerating && (
            <span className="text-[11px] text-[#6e6e73] animate-pulse">생성 중...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {timeAgo && !isGenerating && (
            <span className="text-[11px] text-[#6e6e73]">{timeAgo}</span>
          )}
          <button
            onClick={generateInsight}
            disabled={isGenerating}
            className="text-[11px] px-3 py-1.5 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {isGenerating ? '생성 중...' : '재생성'}
          </button>
        </div>
      </div>

      {isGenerating ? (
        <div className="space-y-2 py-1">
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-full" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-4/5" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-3/5" />
        </div>
      ) : insight ? (
        <p className="text-[13px] text-[#1d1d1f] leading-relaxed whitespace-pre-line">{insight}</p>
      ) : (
        <p className="text-[13px] text-[#6e6e73] text-center py-4">
          인사이트를 불러올 수 없습니다. 재생성 버튼을 눌러주세요.
        </p>
      )}
    </div>
  );
}
