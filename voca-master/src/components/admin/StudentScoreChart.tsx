'use client';

type ScoreEntry = { label: string; score: number; date: string };

export default function StudentScoreChart({ data }: { data: ScoreEntry[] }) {
  const MAX = 50;
  const maxScore = Math.max(...data.map((d) => d.score), 10);

  return (
    <div>
      {/* 바 차트 */}
      <div className="flex items-end gap-3 h-40">
        {data.map((d, i) => {
          const height = Math.max(4, Math.round((d.score / MAX) * 100));
          const pct = Math.round((d.score / MAX) * 100);
          const color =
            pct >= 80 ? 'bg-green-400' :
            pct >= 60 ? 'bg-blue-400' :
            pct >= 40 ? 'bg-yellow-400' : 'bg-red-400';

          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-xs font-semibold text-gray-700">{d.score}</span>
              <div className="w-full flex items-end" style={{ height: '120px' }}>
                <div
                  className={`w-full rounded-t-md ${color} transition-all`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 truncate w-full text-center">{d.date}</span>
            </div>
          );
        })}
      </div>

      {/* 점수 목록 */}
      <div className="mt-4 space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-gray-600 truncate flex-1 mr-4">{d.label}</span>
            <span className="text-xs text-gray-400 mr-3">{d.date}</span>
            <span className={`font-semibold ${
              d.score / MAX >= 0.8 ? 'text-green-600' :
              d.score / MAX >= 0.6 ? 'text-blue-600' :
              d.score / MAX >= 0.4 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {d.score} / {MAX}점
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
