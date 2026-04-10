import { createClient } from '@/lib/supabase/server';
import { getStudentProgress } from '@/app/actions/learning';
import Link from 'next/link';

export default async function StudyListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const progress = await getStudentProgress();

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
    <div className="max-w-xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">학습</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">Day {progress.current_day}까지 학습 가능</p>
      </div>

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
              className={`flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm transition-opacity ${
                isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-80'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 ${
                progressRate === 100
                  ? 'bg-[#1d1d1f] text-white'
                  : progressRate > 0
                  ? 'bg-[#f5f5f7] text-[#1d1d1f]'
                  : 'bg-[#f5f5f7] text-[#c7c7cc]'
              }`}>
                {day}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-semibold text-[#1d1d1f]">Day {day}</span>
                  <div className="flex gap-3 text-[11px] text-[#6e6e73]">
                    <span>{progressRate}%</span>
                    {learningRate !== null && (
                      <span className="text-[#1d1d1f]">정답 {learningRate}%</span>
                    )}
                  </div>
                </div>
                <div className="w-full bg-[#f5f5f7] rounded-full h-1">
                  <div
                    className="bg-[#1d1d1f] h-1 rounded-full"
                    style={{ width: `${progressRate}%` }}
                  />
                </div>
              </div>

              {isLocked && (
                <svg className="w-3.5 h-3.5 text-[#c7c7cc] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
