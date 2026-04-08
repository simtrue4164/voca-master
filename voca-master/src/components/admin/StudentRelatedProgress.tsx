'use client';

import { useState } from 'react';

type DayRow = {
  day: number;
  vocabDone: boolean;
  synonym: { studied: number; total: number };
  similar:  { studied: number; total: number };
  antonym:  { studied: number; total: number };
};

export default function StudentRelatedProgress({
  days,
  totalSynonym,
  totalSimilar,
  totalAntonym,
  studiedSynonym,
  studiedSimilar,
  studiedAntonym,
}: {
  days: DayRow[];
  totalSynonym: number;
  totalSimilar: number;
  totalAntonym: number;
  studiedSynonym: number;
  studiedSimilar: number;
  studiedAntonym: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const totalAll = totalSynonym + totalSimilar + totalAntonym;
  const studiedAll = studiedSynonym + studiedSimilar + studiedAntonym;
  const overallRate = totalAll > 0 ? Math.round((studiedAll / totalAll) * 100) : 0;

  const displayed = showAll ? days : days.slice(0, 20);

  function pct(s: number, t: number) {
    return t === 0 ? null : Math.round((s / t) * 100);
  }

  function ProgressBar({ studied, total, color }: { studied: number; total: number; color: string }) {
    if (total === 0) return <span className="text-xs text-gray-300">-</span>;
    const p = Math.round((studied / total) * 100);
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="w-12 bg-gray-100 rounded-full h-1.5 shrink-0">
          <div className={`${color} h-1.5 rounded-full`} style={{ width: `${p}%` }} />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">{studied}/{total}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 전체 요약 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '전체', studied: studiedAll, total: totalAll, color: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
          { label: '동의어', studied: studiedSynonym, total: totalSynonym, color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
          { label: '유의어', studied: studiedSimilar, total: totalSimilar, color: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50' },
          { label: '반의어', studied: studiedAntonym, total: totalAntonym, color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.text}`}>
              {s.total > 0 ? `${Math.round((s.studied / s.total) * 100)}%` : '-'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{s.studied}/{s.total}개</p>
          </div>
        ))}
      </div>

      {/* DAY별 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-gray-600 font-medium w-16">DAY</th>
              <th className="text-center px-3 py-2.5 text-gray-600 font-medium w-16">어휘</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">동의어</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">유의어</th>
              <th className="text-left px-3 py-2.5 text-gray-600 font-medium">반의어</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.map((row) => (
              <tr key={row.day} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-700">Day {row.day}</td>
                <td className="px-3 py-2 text-center">
                  {row.vocabDone
                    ? <span className="text-green-600 font-bold">✓</span>
                    : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-3 py-2">
                  <ProgressBar studied={row.synonym.studied} total={row.synonym.total} color="bg-blue-500" />
                </td>
                <td className="px-3 py-2">
                  <ProgressBar studied={row.similar.studied} total={row.similar.total} color="bg-teal-500" />
                </td>
                <td className="px-3 py-2">
                  <ProgressBar studied={row.antonym.studied} total={row.antonym.total} color="bg-orange-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {days.length > 20 && (
        <button onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-xl">
          {showAll ? '접기' : `나머지 ${days.length - 20}일 더 보기`}
        </button>
      )}
    </div>
  );
}
