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
    if (score >= 0.8) return { label: '심각', style: 'bg-[#1d1d1f] text-white' };
    if (score >= 0.6) return { label: '위험', style: 'bg-[#f5f5f7] text-[#ff3b30]' };
    if (score >= 0.3) return { label: '주의', style: 'bg-[#f5f5f7] text-[#6e6e73]' };
    return { label: '정상', style: 'bg-[#f5f5f7] text-[#34c759]' };
  }

  const resultMap = Object.fromEntries(results.map((r) => [r.student_id, r]));

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[#1d1d1f]">위험 학생</h2>
          <p className="text-[12px] text-[#6e6e73] mt-0.5">3일 이상 미학습</p>
        </div>
        {atRiskStudents.length > 0 && (
          <button
            onClick={handleRecommend}
            disabled={isGenerating}
            className="text-[11px] px-3 py-1.5 bg-[#1d1d1f] text-white rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {isGenerating ? 'AI 분석 중...' : 'AI 상담 추천'}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-[#ff3b30] bg-[#fff5f5] rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      {done && results.length > 0 && (
        <div className="mb-3 text-[12px] bg-[#f5f5f7] text-[#1d1d1f] rounded-xl px-3 py-2">
          AI 분석 완료 — {results.filter((r) => r.risk_score > 0.5).length}명 상담 요청 생성됨
          <Link href="/admin/counseling" className="ml-2 text-[#0071e3]">상담 관리 보기</Link>
        </div>
      )}

      {atRiskStudents.length === 0 ? (
        <p className="text-[13px] text-[#6e6e73] text-center py-6">위험 학생 없음</p>
      ) : (
        <div className="space-y-2">
          {atRiskStudents.slice(0, 5).map((s) => {
            const rec = resultMap[s.id];
            const riskInfo = rec ? getRiskLabel(rec.risk_score) : null;

            return (
              <div key={s.id} className="py-2 border-b border-[#f5f5f7] last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="text-[13px] font-medium text-[#1d1d1f] hover:text-[#0071e3]"
                    >
                      {s.name}
                    </Link>
                    <p className="text-[12px] text-[#6e6e73]">{s.className} · {s.exam_no}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {riskInfo ? (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${riskInfo.style}`}>
                        {riskInfo.label} {Math.round(rec!.risk_score * 100)}%
                      </span>
                    ) : (
                      <span className="text-[11px] bg-[#f5f5f7] text-[#6e6e73] px-2 py-0.5 rounded-full">
                        {s.missedDays}일+ 미학습
                      </span>
                    )}
                  </div>
                </div>
                {rec && (
                  <p className="text-[12px] text-[#6e6e73] mt-1 leading-relaxed line-clamp-2">{rec.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
