import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ExamStatusButton from '@/components/admin/ExamStatusButton';
import ExamAutoClosePoller from '@/components/admin/ExamAutoClosePoller';
import Link from 'next/link';

export default async function AdminExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: exam } = await admin
    .from('exams')
    .select('id, title, day_1, day_2, starts_at, ends_at, status, class_id, classes(name)')
    .eq('id', id)
    .single();

  if (!exam) redirect('/admin/exams');

  const { data: results } = await admin
    .from('exam_results')
    .select('student_id, score, submitted_at, is_forced, profiles(name, exam_no)')
    .eq('exam_id', id)
    .order('score', { ascending: false });

  const { count: totalStudents } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', exam.class_id)
    .eq('role', 'student');

  const submitted = results?.length ?? 0;
  const avgScore = submitted > 0
    ? Math.round((results!.reduce((s, r) => s + r.score, 0) / submitted) * 10) / 10
    : 0;

  const statusLabel: Record<string, string> = { scheduled: '예정', active: '진행중', closed: '종료' };

  return (
    <div className="space-y-6">
      {/* 진행중 시험: ends_at 기준 자동 종료 폴러 */}
      {exam.status === 'active' && exam.ends_at && (
        <ExamAutoClosePoller examId={exam.id} endsAt={exam.ends_at} />
      )}

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/exams" className="text-sm text-gray-400 hover:text-gray-600 mb-1 block">← 시험 목록</Link>
          <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {Array.isArray(exam.classes) ? (exam.classes[0] as any)?.name : (exam.classes as any)?.name}
            {' · '}Day {exam.day_1} + {exam.day_2}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
            exam.status === 'active' ? 'bg-red-50 text-red-700' :
            exam.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {statusLabel[exam.status]}
          </span>
          <ExamStatusButton examId={exam.id} currentStatus={exam.status} />
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '제출', value: `${submitted} / ${totalStudents ?? '?'}명` },
          { label: '평균 점수', value: `${avgScore} / 50` },
          { label: '미제출', value: `${(totalStudents ?? 0) - submitted}명` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className="text-lg font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 제출 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">수험번호</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">이름</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">점수</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">제출 시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results?.map((r: any) => (
              <tr key={r.student_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-gray-600">{r.profiles?.exam_no}</td>
                <td className="px-4 py-3 text-gray-900">{r.profiles?.name}</td>
                <td className="px-4 py-3 font-semibold text-gray-900">
                  {r.score} / 50
                  {r.is_forced && <span className="ml-1 text-xs text-red-400">(강제)</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(r.submitted_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
            {submitted === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-gray-400">아직 제출한 학생이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
