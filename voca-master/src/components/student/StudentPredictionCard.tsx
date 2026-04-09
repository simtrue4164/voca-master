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
      if (!res.ok) throw new Error('생성 실패');
      const json = await res.json();
      setPrediction(json);
    } catch {
      setError('예측을 불러오지 못했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  function getCompletionColor(prob: number) {
    if (prob >= 80) return 'text-green-600';
    if (prob >= 50) return 'text-blue-600';
    return 'text-orange-500';
  }

  function getScoreColor(score: number) {
    if (score / 50 >= 0.8) return 'text-green-600';
    if (score / 50 >= 0.6) return 'text-blue-600';
    return 'text-orange-500';
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <h2 className="text-sm font-semibold text-indigo-800">AI 성과 예측</h2>
          {isGenerating && (
            <span className="text-xs text-indigo-400 animate-pulse">분석 중...</span>
          )}
        </div>
        {!isGenerating && (
          <button
            onClick={generate}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            재생성
          </button>
        )}
      </div>

      {isGenerating ? (
        <div className="space-y-2 py-1">
          <div className="h-3.5 bg-indigo-100 rounded animate-pulse w-full" />
          <div className="h-3.5 bg-indigo-100 rounded animate-pulse w-5/6" />
          <div className="h-3.5 bg-indigo-100 rounded animate-pulse w-4/6" />
        </div>
      ) : error ? (
        <p className="text-sm text-indigo-400 text-center py-2">{error}</p>
      ) : prediction ? (
        <div className="space-y-3">
          {/* 예측 수치 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">다음 시험 예상</p>
              <p className={`text-xl font-black ${getScoreColor((prediction.next_exam_score_min + prediction.next_exam_score_max) / 2)}`}>
                {prediction.next_exam_score_min}~{prediction.next_exam_score_max}
                <span className="text-sm font-normal text-gray-400">/50점</span>
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">커리큘럼 완주</p>
              <p className={`text-xl font-black ${getCompletionColor(prediction.completion_probability)}`}>
                {prediction.completion_probability}
                <span className="text-sm font-normal text-gray-400">%</span>
              </p>
            </div>
          </div>

          {/* 예측 메시지 */}
          <p className="text-sm text-indigo-900 leading-relaxed">{prediction.message}</p>

          {/* 실천 행동 */}
          <div className="bg-indigo-600 text-white rounded-lg px-3 py-2">
            <p className="text-xs font-medium opacity-80 mb-0.5">지금 바로 할 일</p>
            <p className="text-sm font-medium">{prediction.action}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
