'use client';

import { useState, useEffect, useRef } from 'react';

export default function ExamCoachingCard({
  examId,
  score,
  total,
  wrongWords,
}: {
  examId: string;
  score: number;
  total: number;
  wrongWords: string[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      generate();
    }
  }, []);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/exam/${examId}/coaching`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, total, wrongWords }),
      });
      if (!res.ok) throw new Error('생성 실패');
      const json = await res.json();
      setMessage(json.message);
    } catch {
      setError('코칭 메시지를 불러오지 못했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#1d1d1f]">AI 코칭 메시지</h2>
          {isGenerating && (
            <span className="text-[11px] text-[#6e6e73] animate-pulse">분석 중...</span>
          )}
        </div>
        {!isGenerating && (
          <button
            onClick={generate}
            className="text-[11px] px-3 py-1.5 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity"
          >
            재생성
          </button>
        )}
      </div>

      {isGenerating ? (
        <div className="space-y-2 py-1">
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-full" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-5/6" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-4/6" />
        </div>
      ) : error ? (
        <p className="text-[13px] text-[#6e6e73] text-center py-2">{error}</p>
      ) : message ? (
        <p className="text-[13px] text-[#1d1d1f] leading-relaxed whitespace-pre-line">{message}</p>
      ) : null}
    </div>
  );
}
