'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type RiskStudent = {
  id: string;
  name: string;
  exam_no: string | null;
  className: string;
  missedDays: number;
};

type RecommendResult = {
  student_id: string;
  risk_score: number;
  reason: string;
};

export default function DashboardRiskCard({
  atRiskStudents,
}: {
  atRiskStudents: RiskStudent[];
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<RecommendResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleRecommend() {
    if (atRiskStudents.length === 0) return;
    setIsGenerating(true);
    setError(null);
    setDone(false);

    try {
      const res = await fetch('/api/admin/counseling/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: atRiskStudents.map((s) => s.id) }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? '요청 실패');
      }

      const json = await res.json();
      setResults(json.recommendations ?? []);
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? '오류가 발생했습니다');
    } finally {
      setIsGenerating(false);
    }
  }

  function getRiskLabel(score: number) {
    if (score >= 0.8) return { label: '심각', color: 'bg-red-100 text-red-700' };
    if (score >= 0.6) return { label: '위험', color: 'bg-orange-100 text-orange-700' };
    if (score >= 0.3) return { label: '주의', color: 'bg-yellow-100 text-yellow-700' };
    return { label: '정상', color: 'bg-green-100 text-green-700' };
  }

  const resultMap = Object.fromEntries(results.map((r) => [r.student_id, r]));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">위험 학생</h2>
          <p className="text-xs text-gray-400 mt-0.5">3일 이상 미학습</p>
        </div>
        {atRiskStudents.length > 0 && (
          <button
            onClick={handleRecommend}
            disabled={isGenerating}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? 'AI 분석 중...' : 'AI 상담 추천'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {done && results.length > 0 && (
        <div className="mb-3 text-xs bg-indigo-50 text-indigo-700 rounded-lg px-3 py-2">
          AI 분석 완료 — {results.filter((r) => r.risk_score > 0.5).length}명 상담 요청 생성됨
          <Link href="/admin/counseling" className="ml-2 underline">상담 관리 보기</Link>
        </div>
      )}

      {atRiskStudents.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">위험 학생 없음</p>
      ) : (
        <div className="space-y-2">
          {atRiskStudents.slice(0, 5).map((s) => {
            const rec = resultMap[s.id];
            const riskInfo = rec ? getRiskLabel(rec.risk_score) : null;

            return (
              <div key={s.id} className="py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600"
                    >
                      {s.name}
                    </Link>
                    <p className="text-xs text-gray-400">{s.className} · {s.exam_no}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {riskInfo ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskInfo.color}`}>
                        {riskInfo.label} {Math.round(rec!.risk_score * 100)}%
                      </span>
                    ) : (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                        {s.missedDays}일+ 미학습
                      </span>
                    )}
                  </div>
                </div>
                {rec && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{rec.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
