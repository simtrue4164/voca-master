'use client';

import { useState, useEffect, useRef } from 'react';

type Prediction = {
  next_exam_score_min: number;
  next_exam_score_max: number;
  completion_probability: number;
  message: string;
  action: string;
};

export default function StudentPredictionCard({
  progressRate,
  learningRate,
  streakDays,
  currentDay,
  failedCount,
  cached,
  isStale,
}: {
  progressRate: number;
  learningRate: number;
  streakDays: number;
  currentDay: number;
  failedCount: number;
  cached: Prediction | null;
  isStale: boolean;
}) {
  const [prediction, setPrediction] = useState<Prediction | null>(cached);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (isStale && !calledRef.current) {
      calledRef.current = true;
      generate();
    }
  }, []);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/student/dashboard/prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressRate, learningRate, streakDays, currentDay, failedCount }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? '생성 실패');
      }
      const json = await res.json();
      setPrediction(json);
    } catch {
      setError('예측을 불러오지 못했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl mb-3 shadow-sm border border-violet-100 overflow-hidden">
      {/* AI 강조 상단 바 */}
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-400" />
      <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-[11px] font-bold rounded-full">✦ AI</span>
          <p className="text-[13px] font-semibold text-[#1d1d1f]">성과 예측</p>
        </div>
        {!isGenerating && (
          <button
            onClick={generate}
            className="text-[12px] text-violet-600 hover:opacity-70 transition-opacity"
          >
            새로 분석
          </button>
        )}
      </div>

      {isGenerating ? (
        <div className="space-y-2.5 py-2">
          <div className="h-8 bg-[#f5f5f7] rounded-lg animate-pulse w-1/2" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-full mt-4" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-4/5" />
          <div className="h-3 bg-[#f5f5f7] rounded animate-pulse w-3/5" />
        </div>
      ) : error ? (
        <p className="text-[13px] text-[#6e6e73] py-2">{error}</p>
      ) : prediction ? (
        <div>
          {/* 핵심 수치 */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <p className="text-[32px] font-semibold text-[#1d1d1f] leading-none">
                {prediction.next_exam_score_min}
                <span className="text-lg font-normal text-[#6e6e73]">~{prediction.next_exam_score_max}</span>
              </p>
              <p className="text-[12px] text-[#6e6e73] mt-1">예상 점수 / 50점</p>
            </div>
            <div>
              <p className="text-[32px] font-semibold text-[#1d1d1f] leading-none">
                {prediction.completion_probability}
                <span className="text-lg font-normal text-[#6e6e73]">%</span>
              </p>
              <p className="text-[12px] text-[#6e6e73] mt-1">완주 가능성</p>
            </div>
          </div>

          {/* 메시지 */}
          <p className="text-[13px] text-[#1d1d1f] leading-relaxed mb-4">
            {prediction.message}
          </p>

          {/* 실천 행동 */}
          <div className="border-t border-[#f5f5f7] pt-4">
            <p className="text-[11px] text-[#6e6e73] mb-1">지금 바로 할 일</p>
            <p className="text-[13px] font-semibold text-[#1d1d1f]">{prediction.action}</p>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
