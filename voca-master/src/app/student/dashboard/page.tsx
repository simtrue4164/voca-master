import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStudentProgress } from '@/app/actions/learning';
import { logout } from '@/app/actions/auth';
import Link from 'next/link';
import StudentPredictionCard from '@/components/student/StudentPredictionCard';

export default async function StudentDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, exam_no')
    .eq('id', user!.id)
    .single();

  const progress = await getStudentProgress();

  // AI 성과 예측 캐시 조회
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const adminClient = createAdminClient();
  const { data: predictionCache } = await adminClient
    .from('dashboard_cache')
    .select('content, generated_at')
    .eq('user_id', user!.id)
    .eq('cache_type', 'student_prediction')
    .maybeSingle();

  const cachedDate = predictionCache?.content?.cached_date ?? null;
  const isPredictionStale = cachedDate !== todayKST;

  // Day별 학습 완료 단어 수 집계
  const { data: studiedLogs } = await supabase
    .from('learning_logs')
    .select('vocab:vocabulary!inner(day)')
    .eq('student_id', user!.id);

  const studiedPerDay: Record<number, number> = {};
  for (const log of studiedLogs ?? []) {
    const day = (log.vocab as unknown as { day: number } | null)?.day;
    if (day) studiedPerDay[day] = (studiedPerDay[day] ?? 0) + 1;
  }

  // 다음 시험 조회
  const { data: nextExam } = await supabase
    .from('exams')
    .select('title, starts_at, status')
    .eq('class_id', (
      await supabase.from('profiles').select('class_id').eq('id', user!.id).single()
    ).data?.class_id ?? '')
    .in('status', ['scheduled', 'active'])
    .order('starts_at', { ascending: true })
    .limit(1)
    .single();

  // Day 상태 계산
  function getDayStatus(day: number): 'done' | 'today' | 'partial' | 'missed' | 'locked' {
    if (day > progress.current_day) return 'locked';
    if (studiedPerDay[day] >= 50) return 'done';
    if (day === progress.current_day) return 'today';
    if ((studiedPerDay[day] ?? 0) > 0) return 'partial';
    return 'missed';
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">안녕하세요</p>
          <h1 className="text-xl font-bold text-gray-900">{profile?.name ?? '학생'} 님</h1>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
            로그아웃
          </button>
        </form>
      </div>

      {/* AI 성과 예측 */}
      <StudentPredictionCard
        progressRate={progress.progress_rate}
        learningRate={progress.learning_rate}
        streakDays={progress.streak_days}
        currentDay={progress.current_day}
        failedCount={progress.failed_count}
        cached={isPredictionStale ? null : (predictionCache?.content ?? null)}
        isStale={isPredictionStale}
      />

      {/* 진도 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          label="학습 진도"
          value={`${progress.progress_rate}%`}
          sub={`${progress.studied_count} / ${progress.total_words}단어`}
          color="blue"
        />
        <StatCard
          label="학습율"
          value={`${progress.learning_rate}%`}
          sub="셀프테스트 정답률"
          color="green"
        />
        <StatCard
          label="연속 학습일"
          value={`${progress.streak_days}일`}
          sub="오늘도 화이팅!"
          color="orange"
        />
        <StatCard
          label="현재 Day"
          value={`Day ${progress.current_day}`}
          sub={`60일 중 ${progress.current_day}일차`}
          color="purple"
        />
      </div>

      {/* 다음 시험 */}
      {nextExam && (
        <div className={`rounded-xl p-4 mb-4 ${nextExam.status === 'active' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-0.5">
                {nextExam.status === 'active' ? '🔴 시험 진행중' : '📝 다음 시험'}
              </p>
              <p className="font-semibold text-gray-900">{nextExam.title}</p>
              {nextExam.status === 'scheduled' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(nextExam.starts_at).toLocaleString('ko-KR', {
                    month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              )}
            </div>
            {nextExam.status === 'active' && (
              <Link
                href="/student/exam"
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg"
              >
                입장하기
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 오늘 학습 바로가기 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">오늘 학습</h2>
        <div className="flex gap-2">
          <Link
            href={`/student/study/${progress.current_day}`}
            className="flex-1 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg text-center"
          >
            Day {progress.current_day} 학습하기
          </Link>
          <Link
            href="/student/review"
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg text-center"
          >
            복습하기
            {progress.failed_count > 0 && (
              <span className="ml-1 text-red-500">({progress.failed_count})</span>
            )}
          </Link>
        </div>
      </div>

      {/* 60일 Day 그리드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">60일 학습 현황</h2>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />완료
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />오늘
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />진행중
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />미학습
            </span>
          </div>
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: 60 }, (_, i) => i + 1).map((day) => {
            const status = getDayStatus(day);
            const isAccessible = day <= progress.current_day;

            const cellClass = {
              done:    'bg-green-500 text-white',
              today:   'bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1',
              partial: 'bg-amber-400 text-white',
              missed:  'bg-red-400 text-white',
              locked:  'bg-gray-100 text-gray-300',
            }[status];

            const inner = (
              <span className={`flex items-center justify-center w-full aspect-square rounded-md text-xs font-medium transition-opacity ${cellClass} ${isAccessible ? 'hover:opacity-80' : 'cursor-default'}`}>
                {day}
              </span>
            );

            return isAccessible ? (
              <Link key={day} href={`/student/study/${day}`} title={`Day ${day}`}>
                {inner}
              </Link>
            ) : (
              <div key={day} title={`Day ${day} (잠금)`}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      {/* 진도 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-gray-700">전체 진도</h2>
          <span className="text-xs text-gray-500">{progress.studied_count} / 3,000단어</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (progress.studied_count / 3000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}
