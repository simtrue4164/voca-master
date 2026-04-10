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

  const { data: myResults } = await supabase
    .from('exam_results')
    .select('exam_id')
    .eq('student_id', user!.id);

  const submittedIds = new Set((myResults ?? []).map((r) => r.exam_id));

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">시험</h1>
      </div>

      {!exams || exams.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
          <p className="text-[15px] font-semibold text-[#1d1d1f]">예정된 시험이 없습니다</p>
          <p className="text-[13px] text-[#6e6e73] mt-1">시험이 등록되면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => {
            const submitted = submittedIds.has(exam.id);
            const isAbsent = exam.status === 'closed' && !submitted;

            const href =
              exam.status === 'scheduled' ? `/student/exam/${exam.id}/wait` :
              exam.status === 'closed'    ? `/student/exam/${exam.id}/result` :
                                            `/student/exam/${exam.id}`;

            type BadgeKey = 'scheduled' | 'active' | 'closed' | 'absent';
            const badgeKey: BadgeKey = isAbsent ? 'absent' : exam.status as BadgeKey;

            const badgeConfig: Record<BadgeKey, { label: string; style: string }> = {
              scheduled: { label: '예정', style: 'bg-[#f5f5f7] text-[#6e6e73]' },
              active:    { label: '진행중', style: 'bg-[#1d1d1f] text-white' },
              closed:    { label: '종료', style: 'bg-[#f5f5f7] text-[#6e6e73]' },
              absent:    { label: '미응시', style: 'bg-[#f5f5f7] text-[#6e6e73]' },
            };

            return (
              <Link
                key={exam.id}
                href={href}
                className="block bg-white rounded-2xl p-5 shadow-sm hover:opacity-80 transition-opacity"
              >
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-[15px] font-semibold text-[#1d1d1f]">{exam.title}</h2>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badgeConfig[badgeKey].style}`}>
                    {badgeConfig[badgeKey].label}
                  </span>
                </div>
                <p className="text-[12px] text-[#6e6e73]">Day {exam.day_1} + Day {exam.day_2} · 50문항</p>
                <p className="text-[12px] text-[#6e6e73] mt-0.5">
                  {new Date(exam.starts_at).toLocaleString('ko-KR', {
                    month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                {exam.status === 'scheduled' && (
                  <p className="text-[11px] text-[#0071e3] mt-2">입장 대기 화면으로 이동</p>
                )}
                {isAbsent && (
                  <p className="text-[11px] text-[#6e6e73] mt-2">탭하여 문제 및 정답 확인</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
