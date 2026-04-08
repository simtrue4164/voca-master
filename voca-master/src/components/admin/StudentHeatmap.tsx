'use client';

type HeatmapDay = { date: string; count: number };

const LEVEL_COLORS = [
  'bg-gray-100',        // 0
  'bg-blue-100',        // 1-10
  'bg-blue-300',        // 11-30
  'bg-blue-500',        // 31-50
  'bg-blue-700',        // 51+
];

function getLevel(count: number) {
  if (count === 0) return 0;
  if (count <= 10) return 1;
  if (count <= 30) return 2;
  if (count <= 50) return 3;
  return 4;
}

export default function StudentHeatmap({
  data,
  startDate,
}: {
  data: HeatmapDay[];
  startDate: string;
}) {
  // 7행 × 9열 (63칸, 60일 + 여백)
  const weeks: HeatmapDay[][] = [];
  let week: HeatmapDay[] = [];

  // 시작 요일 맞추기 (빈 칸)
  const start = new Date(startDate);
  const startDow = start.getDay(); // 0=일, 1=월 ...
  for (let i = 0; i < startDow; i++) {
    week.push({ date: '', count: -1 });
  }

  data.forEach((d) => {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push({ date: '', count: -1 });
    weeks.push(week);
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="flex gap-1 mb-1 ml-0">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="w-7 text-center text-xs text-gray-400">{d}</div>
        ))}
      </div>

      {/* 히트맵 그리드 (주 단위 행) */}
      <div className="space-y-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex gap-1">
            {w.map((d, di) => {
              if (d.count === -1) {
                return <div key={di} className="w-7 h-7" />;
              }
              const level = getLevel(d.count);
              const isToday = d.date === today;
              return (
                <div
                  key={di}
                  title={d.date ? `${d.date}: ${d.count}개 학습` : ''}
                  className={`w-7 h-7 rounded-sm ${LEVEL_COLORS[level]} ${
                    isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                  } transition-colors`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-400">적음</span>
        {LEVEL_COLORS.map((c, i) => (
          <div key={i} className={`w-5 h-5 rounded-sm ${c}`} />
        ))}
        <span className="text-xs text-gray-400">많음</span>
      </div>
    </div>
  );
}
