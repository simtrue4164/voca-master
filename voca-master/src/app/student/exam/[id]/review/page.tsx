import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StudySession from '@/components/vocabulary/StudySession';

export default async function ExamReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('id', user!.id)
    .single();

  const { data: exam } = await supabase
    .from('exams')
    .select('id, title, day_1, day_2, class_id')
    .eq('id', id)
    .single();

  if (!exam || exam.class_id !== profile?.class_id) redirect('/student/exam');

  // 시험 문항 + 단어 전체 정보 조회
  const { data: questions } = await supabase
    .from('exam_questions')
    .select(`
      id, vocab_id, question_no,
      vocabulary(
        id, day, word,
        word_meanings(id, pos, meaning_ko, display_order),
        word_synonyms(id, synonym, display_order),
        word_similar(id, similar_word, display_order),
        word_antonyms(id, antonym, display_order)
      )
    `)
    .eq('exam_id', id)
    .order('question_no');

  if (!questions || questions.length === 0) redirect(`/student/exam/${id}/result`);

  const words = questions.map((q: any) => ({
    id: q.vocabulary.id,
    day: q.vocabulary.day,
    word: q.vocabulary.word,
    exam_count: 0,
    meanings: [...(q.vocabulary.word_meanings as any[])].sort(
      (a, b) => a.display_order - b.display_order
    ),
    synonyms: [...(q.vocabulary.word_synonyms as any[])].sort((a, b) => a.display_order - b.display_order),
    similar:  [...(q.vocabulary.word_similar  as any[])].sort((a, b) => a.display_order - b.display_order),
    antonyms: [...(q.vocabulary.word_antonyms as any[])].sort((a, b) => a.display_order - b.display_order),
    currentStatus: null,
  }));

  return (
    <StudySession
      day={exam.day_1}
      words={words}
      title={exam.title}
      backHref={`/student/exam/${id}/result`}
    />
  );
}
