import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ExamRoom from '@/components/exam/ExamRoom';

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('id', user!.id)
    .single();

  // 시험 정보
  const { data: exam } = await supabase
    .from('exams')
    .select('id, title, day_1, day_2, starts_at, ends_at, status, class_id')
    .eq('id', id)
    .single();

  if (!exam) redirect('/student/exam');
  if (!profile?.class_id) redirect('/student/exam');
  if (exam.class_id !== profile.class_id) redirect('/student/exam');

  // 이미 제출했으면 결과 페이지로
  const { data: result } = await supabase
    .from('exam_results')
    .select('id')
    .eq('exam_id', id)
    .eq('student_id', user!.id)
    .single();

  if (result || exam.status === 'closed') redirect(`/student/exam/${id}/result`);
  if (exam.status === 'scheduled') redirect(`/student/exam/${id}/wait`);

  // 문항 조회 (accepted_answers 제외)
  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, vocab_id, question_no, vocabulary(word)')
    .eq('exam_id', id)
    .order('question_no');

  const questionList = (questions ?? []).map((q: any) => ({
    id: q.id,
    vocab_id: q.vocab_id,
    question_no: q.question_no,
    word: q.vocabulary?.word ?? '',
  }));

  // 단어 조회 실패한 문항이 있으면 시험 진행 불가
  if (questionList.some((q) => !q.word)) redirect('/student/exam');

  return (
    <ExamRoom
      examId={exam.id}
      title={exam.title}
      endsAt={exam.ends_at}
      questions={questionList}
    />
  );
}
