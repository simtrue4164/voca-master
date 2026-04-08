import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStudentProgress } from '@/app/actions/learning';
import { redirect } from 'next/navigation';
import StudySession from '@/components/vocabulary/StudySession';

export default async function StudyDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayStr } = await params;
  const day = parseInt(dayStr);

  if (isNaN(day) || day < 1 || day > 60) redirect('/student/study');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let progress;
  try {
    progress = await getStudentProgress();
    if (day > progress.current_day) redirect('/student/study');
  } catch {
    // RLS 오류 시 day 접근 허용 (학습은 항상 가능)
  }

  const adminDb = createAdminClient();

  // 해당 Day 어휘 (admin 클라이언트로 RLS 우회)
  const { data: words } = await adminDb
    .from('vocabulary')
    .select('id, day, word')
    .eq('day', day)
    .order('word');

  const vocabIds = (words ?? []).map((w) => w.id);

  // 의미 + 유의어 + 반의어 별도 조회
  const [{ data: meanings }, { data: synonyms }, { data: similar }, { data: antonyms }] = await Promise.all([
    adminDb.from('word_meanings').select('id, vocab_id, pos, meaning_ko, display_order').in('vocab_id', vocabIds),
    adminDb.from('word_synonyms').select('id, vocab_id, synonym, display_order').in('vocab_id', vocabIds),
    adminDb.from('word_similar').select('id, vocab_id, similar_word, display_order').in('vocab_id', vocabIds),
    adminDb.from('word_antonyms').select('id, vocab_id, antonym, display_order').in('vocab_id', vocabIds),
  ]);

  const meaningMap: Record<string, any[]> = {};
  for (const m of meanings ?? []) { if (!meaningMap[m.vocab_id]) meaningMap[m.vocab_id] = []; meaningMap[m.vocab_id].push(m); }
  const synonymMap: Record<string, any[]> = {};
  for (const s of synonyms ?? []) { if (!synonymMap[s.vocab_id]) synonymMap[s.vocab_id] = []; synonymMap[s.vocab_id].push(s); }
  const similarMap: Record<string, any[]> = {};
  for (const s of similar ?? []) { if (!similarMap[s.vocab_id]) similarMap[s.vocab_id] = []; similarMap[s.vocab_id].push(s); }
  const antonymMap: Record<string, any[]> = {};
  for (const a of antonyms ?? []) { if (!antonymMap[a.vocab_id]) antonymMap[a.vocab_id] = []; antonymMap[a.vocab_id].push(a); }

  // 학습 로그 + 관련 단어 로그 병렬 조회
  const allRelatedIds = [
    ...(synonyms ?? []).map((s) => s.id),
    ...(similar  ?? []).map((s) => s.id),
    ...(antonyms ?? []).map((a) => a.id),
  ];

  const [{ data: logs }, { data: relatedLogsData }] = await Promise.all([
    adminDb.from('learning_logs').select('vocab_id, status').eq('student_id', user!.id).in('vocab_id', vocabIds),
    allRelatedIds.length > 0
      ? adminDb.from('related_word_logs').select('related_id, status').eq('student_id', user!.id).in('related_id', allRelatedIds)
      : Promise.resolve({ data: [] }),
  ]);

  const logMap: Record<string, string> = {};
  logs?.forEach((l) => { logMap[l.vocab_id] = l.status; });

  const relatedLogMap: Record<string, string> = {};
  (relatedLogsData ?? []).forEach((l) => { relatedLogMap[l.related_id] = l.status; });

  const vocabList = (words ?? []).map((w) => ({
    id: w.id,
    day: w.day,
    word: w.word,
    exam_count: 0,
    meanings: (meaningMap[w.id] ?? []).sort((a, b) => a.display_order - b.display_order),
    synonyms: (synonymMap[w.id] ?? []).sort((a, b) => a.display_order - b.display_order),
    similar:  (similarMap[w.id]  ?? []).sort((a, b) => a.display_order - b.display_order),
    antonyms: (antonymMap[w.id]  ?? []).sort((a, b) => a.display_order - b.display_order),
    currentStatus: logMap[w.id] ?? null,
  }));

  return <StudySession day={day} words={vocabList} relatedLogs={relatedLogMap} />;
}
