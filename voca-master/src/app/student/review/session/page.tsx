import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StudySession from '@/components/vocabulary/StudySession';

export default async function ReviewSessionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: logs } = await supabase
    .from('learning_logs')
    .select('vocab_id, status, vocabulary(id, day, word, word_meanings(id, pos, meaning_ko, display_order), word_synonyms(id, synonym, display_order), word_similar(id, similar_word, display_order), word_antonyms(id, antonym, display_order))')
    .eq('student_id', user!.id)
    .eq('status', 'failed');

  if (!logs || logs.length === 0) redirect('/student/review');

  const words = logs.map((log: any) => ({
    id: log.vocabulary.id,
    day: log.vocabulary.day,
    word: log.vocabulary.word,
    exam_count: 0,
    meanings: (log.vocabulary.word_meanings as any[]).sort((a: any, b: any) => a.display_order - b.display_order),
    synonyms: (log.vocabulary.word_synonyms as any[]).sort((a: any, b: any) => a.display_order - b.display_order),
    similar:  (log.vocabulary.word_similar  as any[]).sort((a: any, b: any) => a.display_order - b.display_order),
    antonyms: (log.vocabulary.word_antonyms as any[]).sort((a: any, b: any) => a.display_order - b.display_order),
    currentStatus: log.status,
  }));

  return <StudySession day={0} words={words} />;
}
