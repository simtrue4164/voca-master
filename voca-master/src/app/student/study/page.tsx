import { createClient } from '@/lib/supabase/server';
import { getStudentProgress } from '@/app/actions/learning';
import Link from 'next/link';

export default async function StudyListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const progress = await getStudentProgress();

  // Day별 학습 현황 집계
  const { data: logs } = await supabase
    .from('learning_logs')
    .select('vocab_id, status, vocabulary(day)')
    .eq('student_id', user!.id);

  const dayStats: Record<number, { studied: number; memorized: number; failed: number }> = {};
  for (let d = 1; d <= 60; d++) {
    dayStats[d] = { studied: 0, memorized: 0, failed: 0 };
  }
  logs?.forEach((log: any) => {
    const day = log.vocabulary?.day;
    if (day) {
      dayStats[day].studied++;
      if (log.status === 'memorized') dayStats[day].memorized++;
      if (log.status === 'failed') dayStats[day].failed++;
    }
  });

  const days = Array.from({ length: 60 }, (_, i) => i + 1);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">학습</h1>
      <p className="text-sm text-gray-500 mb-6">현재 Day {progress.current_day}까지 학습 가능</p>

      <div className="space-y-2">
        {days.map((day) => {
          const stat = dayStats[day];
          const isLocked = day > progress.current_day;
          const tested = stat.memorized + stat.failed;
          const learningRate = tested > 0 ? Math.round((stat.memorized / tested) * 100) : null;
          const progressRate = Math.round((stat.studied / 50) * 100);

          return (
            <Link
              key={day}
              href={isLocked ? '#' : `/student/study/${day}`}
              className={`flex items-center gap-4 bg-white rounded-xl border p-4 transition-colors ${
                isLocked
                  ? 'border-gray-100 opacity-40 cursor-not-allowed'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {/* Day 번호 */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                progressRate === 100
                  ? 'bg-blue-600 text-white'
                  : progressRate > 0
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {day}
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">Day {day}</span>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>진도 {progressRate}%</span>
                    {learningRate !== null && (
                      <span className="text-green-600">학습율 {learningRate}%</span>
                    )}
                  </div>
                </div>
                {/* 진도 바 */}
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${progressRate}%` }}
                  />
                </div>
              </div>

              {/* 잠금 아이콘 */}
              {isLocked && (
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
