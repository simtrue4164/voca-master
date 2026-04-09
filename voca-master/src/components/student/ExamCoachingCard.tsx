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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-semibold text-blue-800">AI 코칭 메시지</h2>
          {isGenerating && (
            <span className="text-xs text-blue-400 animate-pulse">분석 중...</span>
          )}
        </div>
        {!isGenerating && (
          <button
            onClick={generate}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            재생성
          </button>
        )}
      </div>

      {isGenerating ? (
        <div className="space-y-2 py-1">
          <div className="h-3.5 bg-blue-100 rounded animate-pulse w-full" />
          <div className="h-3.5 bg-blue-100 rounded animate-pulse w-5/6" />
          <div className="h-3.5 bg-blue-100 rounded animate-pulse w-4/6" />
        </div>
      ) : error ? (
        <p className="text-sm text-blue-400 text-center py-2">{error}</p>
      ) : message ? (
        <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">{message}</p>
      ) : null}
    </div>
  );
}
