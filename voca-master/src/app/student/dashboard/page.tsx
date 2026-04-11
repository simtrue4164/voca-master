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
  const todayKST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
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
    const vocab = Array.isArray(log.vocab) ? log.vocab[0] : log.vocab;
    const day = (vocab as { day: number } | null)?.day;
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

  function getDayStatus(day: number): 'done' | 'today' | 'partial' | 'missed' | 'locked' {
    if (day > progress.current_day) return 'locked';
    if (studiedPerDay[day] >= 50) return 'done';
    if (day === progress.current_day) return 'today';
    if ((studiedPerDay[day] ?? 0) > 0) return 'partial';
    return 'missed';
  }

  const progressPct = Math.min(100, Math.round((progress.studied_count / 3000) * 100));

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-xl mx-auto px-5 py-8">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className="text-[13px] text-[#6e6e73] mb-0.5">안녕하세요</p>
            <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">
              {profile?.name ?? '학생'}
            </h1>
          </div>
          <form action={logout}>
            <button type="submit" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors mt-1">
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

        {/* 진도 요약 */}
        <div className="bg-white rounded-2xl p-6 mb-3 shadow-sm">
          <p className="text-[13px] text-[#6e6e73] mb-4">학습 현황</p>
          <div className="grid grid-cols-2 gap-y-6">
            <div>
              <p className="text-[32px] font-semibold text-[#1d1d1f] leading-none">{progressPct}<span className="text-lg font-normal text-[#6e6e73]">%</span></p>
              <p className="text-[12px] text-[#6e6e73] mt-1">학습 진도</p>
            </div>
            <div>
              <p className="text-[32px] font-semibold text-[#1d1d1f] leading-none">{progress.learning_rate}<span className="text-lg font-normal text-[#6e6e73]">%</span></p>
              <p className="text-[12px] text-[#6e6e73] mt-1">정답률</p>
            </div>
            <div>
              <p className="text-[32px] font-semibold text-[#1d1d1f] leading-none">{progress.streak_days}<span className="text-lg font-normal text-[#6e6e73]">일</span></p>
              <p className="text-[12px] text-[#6e6e73] mt-1">연속 학습</p>
            </div>
            <div>
              <p className="text-[32px] font-semibold text-[#1d1d1f] leading-none">Day <span className="text-[28px]">{progress.current_day}</span></p>
              <p className="text-[12px] text-[#6e6e73] mt-1">60일 중</p>
            </div>
          </div>
          {/* 전체 진도 바 */}
          <div className="mt-6 pt-5 border-t border-[#f5f5f7]">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[12px] text-[#6e6e73]">전체 진도</p>
              <p className="text-[12px] text-[#6e6e73]">{progress.studied_count.toLocaleString()} / 3,000단어</p>
            </div>
            <div className="w-full bg-[#f5f5f7] rounded-full h-1.5">
              <div
                className="bg-[#1d1d1f] h-1.5 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 시험 알림 */}
        {nextExam && (
          <div className={`rounded-2xl p-5 mb-3 shadow-sm ${nextExam.status === 'active' ? 'bg-[#1d1d1f]' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-medium mb-1 ${nextExam.status === 'active' ? 'text-[#f5f5f7]' : 'text-[#6e6e73]'}`}>
                  {nextExam.status === 'active' ? '지금 시험 중' : '다음 시험'}
                </p>
                <p className={`font-semibold text-[15px] ${nextExam.status === 'active' ? 'text-white' : 'text-[#1d1d1f]'}`}>
                  {nextExam.title}
                </p>
                {nextExam.status === 'scheduled' && (
                  <p className="text-[12px] text-[#6e6e73] mt-0.5">
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
                  className="px-4 py-2 bg-white text-[#1d1d1f] text-[13px] font-semibold rounded-full"
                >
                  입장
                </Link>
              )}
            </div>
          </div>
        )}

        {/* 오늘 학습 */}
        <div className="bg-white rounded-2xl p-5 mb-3 shadow-sm">
          <p className="text-[13px] text-[#6e6e73] mb-3">오늘 학습</p>
          <div className="flex gap-2">
            <Link
              href={`/student/study/${progress.current_day}`}
              className="flex-1 py-3 bg-[#1d1d1f] text-white text-[13px] font-semibold rounded-xl text-center transition-opacity hover:opacity-80"
            >
              Day {progress.current_day} 시작
            </Link>
            <Link
              href="/student/review"
              className="flex-1 py-3 bg-[#f5f5f7] text-[#1d1d1f] text-[13px] font-semibold rounded-xl text-center transition-opacity hover:opacity-70"
            >
              복습
              {progress.failed_count > 0 && (
                <span className="ml-1.5 text-[11px] text-[#6e6e73]">{progress.failed_count}</span>
              )}
            </Link>
          </div>
        </div>

        {/* 60일 그리드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-[#6e6e73]">60일 학습 현황</p>
            <div className="flex items-center gap-3 text-[11px] text-[#6e6e73]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#1d1d1f] inline-block" />완료</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#0071e3] inline-block" />오늘</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#d1d1d6] inline-block" />미완료</span>
            </div>
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: 60 }, (_, i) => i + 1).map((day) => {
              const status = getDayStatus(day);
              const isAccessible = day <= progress.current_day;

              const cellClass = {
                done:    'bg-[#1d1d1f] text-white',
                today:   'bg-[#0071e3] text-white',
                partial: 'bg-[#d1d1d6] text-[#1d1d1f]',
                missed:  'bg-[#d1d1d6] text-[#1d1d1f]',
                locked:  'bg-[#f5f5f7] text-[#c7c7cc]',
              }[status];

              const inner = (
                <span className={`flex items-center justify-center w-full aspect-square rounded-md text-[10px] font-medium ${cellClass} ${isAccessible ? 'hover:opacity-70 transition-opacity' : 'cursor-default'}`}>
                  {day}
                </span>
              );

              return isAccessible ? (
                <Link key={day} href={`/student/study/${day}`}>{inner}</Link>
              ) : (
                <div key={day}>{inner}</div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
