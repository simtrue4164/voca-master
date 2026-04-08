import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function ExamListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('id', user!.id)
    .single();

  const { data: exams } = await supabase
    .from('exams')
    .select('id, title, day_1, day_2, starts_at, ends_at, status')
    .eq('class_id', profile?.class_id ?? '')
    .order('starts_at', { ascending: false });

  // 내가 제출한 시험 ID 목록
  const { data: myResults } = await supabase
    .from('exam_results')
    .select('exam_id')
    .eq('student_id', user!.id);

  const submittedIds = new Set((myResults ?? []).map((r) => r.exam_id));

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">시험</h1>

      {!exams || exams.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📝</p>
          <p>예정된 시험이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => {
            const submitted = submittedIds.has(exam.id);
            const isAbsent = exam.status === 'closed' && !submitted;

            const href =
              exam.status === 'scheduled' ? `/student/exam/${exam.id}/wait` :
              exam.status === 'closed'    ? `/student/exam/${exam.id}/result` :
                                            `/student/exam/${exam.id}`;

            // 배지 설정
            type BadgeKey = 'scheduled' | 'active' | 'closed' | 'absent';
            const badgeKey: BadgeKey = isAbsent ? 'absent' : exam.status as BadgeKey;
            const badgeLabel: Record<BadgeKey, string> = {
              scheduled: '예정',
              active: '진행중',
              closed: '종료',
              absent: '미응시',
            };
            const badgeColor: Record<BadgeKey, string> = {
              scheduled: 'bg-blue-50 text-blue-700',
              active: 'bg-red-50 text-red-700',
              closed: 'bg-gray-100 text-gray-500',
              absent: 'bg-orange-50 text-orange-600',
            };

            return (
              <Link
                key={exam.id}
                href={href}
                className={`block bg-white rounded-xl border p-4 hover:border-blue-300 transition-colors ${
                  isAbsent ? 'border-orange-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h2 className="font-semibold text-gray-900">{exam.title}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${badgeColor[badgeKey]}`}>
                    {badgeLabel[badgeKey]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Day {exam.day_1} + Day {exam.day_2} · 50문항</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(exam.starts_at).toLocaleString('ko-KR', {
                    month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                {exam.status === 'scheduled' && (
                  <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    입장 대기 화면으로 이동
                  </p>
                )}
                {isAbsent && (
                  <p className="text-xs text-orange-500 mt-2">
                    시험에 응시하지 않았습니다. 탭하여 문제 및 정답을 확인하세요.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
