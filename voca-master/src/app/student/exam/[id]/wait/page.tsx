import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import ExamWaitRoom from '@/components/exam/ExamWaitRoom';

export default async function ExamWaitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('class_id')
    .eq('id', user!.id)
    .single();

  const { data: exam } = await admin
    .from('exams')
    .select('id, title, day_1, day_2, starts_at, status, class_id')
    .eq('id', id)
    .single();

  if (!exam) redirect('/student/exam');

  // 이미 시작됐으면 바로 시험으로
  if (exam.status === 'active') redirect(`/student/exam/${id}`);
  // 종료됐으면 결과로
  if (exam.status === 'closed') redirect(`/student/exam/${id}/result`);

  // 해당 반 소속 여부 확인 (student_class_memberships도 고려)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const { data: membership } = await admin
    .from('student_class_memberships')
    .select('student_id')
    .eq('student_id', user!.id)
    .eq('class_id', exam.class_id)
    .eq('year_month', thisMonth)
    .single();

  const hasAccess = profile?.class_id === exam.class_id || !!membership;
  if (!hasAccess) redirect('/student/exam');

  return (
    <ExamWaitRoom
      examId={exam.id}
      title={exam.title}
      day1={exam.day_1}
      day2={exam.day_2}
      startsAt={exam.starts_at}
    />
  );
}
