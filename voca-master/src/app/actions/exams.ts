'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export type ExamActionState = { error: string | null; success: boolean };

// 시험 생성 + 문항 50개 자동 생성
export async function createExam(
  _prev: ExamActionState,
  formData: FormData
): Promise<ExamActionState> {
  const title = (formData.get('title') as string)?.trim();
  const classId = (formData.get('class_id') as string)?.trim();
  const day1 = parseInt(formData.get('day_1') as string);
  const day2 = parseInt(formData.get('day_2') as string);
  const startsAt = new Date().toISOString();

  if (!title || !classId || !day1 || !day2) {
    return { error: '모든 항목을 입력해주세요.', success: false };
  }
  if (day1 === day2) return { error: 'Day 1과 Day 2는 달라야 합니다.', success: false };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminDb = createAdminClient();

  // day별 exam_count 낮은 순 25개씩 선택 (admin 클라이언트로 RLS 우회)
  async function pickWords(day: number, count: number) {
    const { data: vocabs } = await adminDb
      .from('vocabulary')
      .select('id, exam_count')
      .eq('day', day)
      .order('exam_count', { ascending: true })
      .limit(count);
    if (!vocabs || vocabs.length === 0) return [];

    const vocabIds = vocabs.map((v) => v.id);
    const { data: meanings } = await adminDb
      .from('word_meanings')
      .select('vocab_id, pos, meaning_ko, display_order')
      .in('vocab_id', vocabIds);

    const meaningMap: Record<string, { pos: string; meaning_ko: string; display_order: number }[]> = {};
    for (const m of meanings ?? []) {
      if (!meaningMap[m.vocab_id]) meaningMap[m.vocab_id] = [];
      meaningMap[m.vocab_id].push(m);
    }

    return vocabs.map((v) => ({
      id: v.id,
      exam_count: v.exam_count,
      word_meanings: (meaningMap[v.id] ?? []).sort((a, b) => a.display_order - b.display_order),
    }));
  }

  const [words1, words2] = await Promise.all([pickWords(day1, 25), pickWords(day2, 25)]);

  if (words1.length < 25 || words2.length < 25) {
    return { error: `단어 수가 부족합니다. (Day ${day1}: ${words1.length}개, Day ${day2}: ${words2.length}개)`, success: false };
  }

  // 시험 생성
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .insert({
      class_id: classId,
      title,
      day_1: day1,
      day_2: day2,
      starts_at: new Date(startsAt).toISOString(),
      created_by: user!.id,
    })
    .select('id')
    .single();

  if (examError) return { error: examError.message, success: false };

  // 문항 생성
  const allWords = [...words1, ...words2];
  const questions = allWords.map((w, i) => ({
    exam_id: exam.id,
    vocab_id: w.id,
    question_no: i + 1,
    accepted_answers: (w.word_meanings as any[])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((m: any) => ({ pos: m.pos, meaning_ko: m.meaning_ko })),
  }));

  const { error: qError } = await supabase.from('exam_questions').insert(questions);
  if (qError) {
    await supabase.from('exams').delete().eq('id', exam.id);
    return { error: qError.message, success: false };
  }

  // exam_count 증가
  const allVocabIds = allWords.map((w) => w.id);
  await adminDb.rpc('increment_exam_count', { vocab_ids: allVocabIds });

  revalidatePath('/admin/exams');
  return { error: null, success: true };
}

// 시험 상태 변경 (active / closed)
export async function updateExamStatus(examId: string, status: 'active' | 'closed') {
  const admin = createAdminClient();

  const updates: Record<string, unknown> = { status };

  // 시작 버튼을 누른 시점을 실제 starts_at / ends_at 으로 설정
  if (status === 'active') {
    const now = new Date();
    const endsAt = new Date(now.getTime() + 8 * 60 * 1000); // 8분 후
    updates.starts_at = now.toISOString();
    updates.ends_at = endsAt.toISOString();
  }

  const { error } = await admin
    .from('exams')
    .update(updates)
    .eq('id', examId);
  if (error) throw error;
  revalidatePath('/admin/exams');
  revalidatePath(`/admin/exams/${examId}`);
}

// 만료된 시험 자동 종료 (ends_at 이 지났으면 status → closed)
export async function autoCloseIfExpired(examId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: exam } = await admin
    .from('exams')
    .select('status, ends_at')
    .eq('id', examId)
    .single();

  if (!exam || exam.status !== 'active') return false;
  if (!exam.ends_at || new Date(exam.ends_at) > new Date()) return false;

  const { error } = await admin
    .from('exams')
    .update({ status: 'closed' })
    .eq('id', examId)
    .eq('status', 'active'); // 동시 호출 중복 방지

  if (error) return false;

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath('/admin/exams');
  return true;
}

// 학생 시험 제출 + 서버 채점
export async function submitExam(
  examId: string,
  answers: Record<string, string>,
  isForced = false
): Promise<{ score: number; scores: Record<string, boolean>; wrongVocabIds: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  // 문항 + 정답 조회
  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, vocab_id, accepted_answers')
    .eq('exam_id', examId);

  if (!questions) throw new Error('문항을 불러올 수 없습니다.');

  // 채점: 학생 답안에 accepted_answers 중 하나라도 포함되면 정답
  const scores: Record<string, boolean> = {};
  const wrongVocabIds: string[] = [];
  let correct = 0;

  for (const q of questions) {
    const studentAnswer = (answers[q.id] ?? '').trim().toLowerCase();
    const accepted = q.accepted_answers as Array<{ pos: string; meaning_ko: string }>;

    const isCorrect = accepted.some((a) =>
      a.meaning_ko
        .toLowerCase()
        .split(/[,，、\/]/)
        .map((kw) => kw.trim())
        .filter((kw) => kw.length > 0)
        .some((kw) => studentAnswer.includes(kw))
    );

    scores[q.id] = isCorrect;
    if (isCorrect) correct++;
    else wrongVocabIds.push(q.vocab_id);
  }

  // 결과 저장
  const { error } = await supabase.from('exam_results').upsert({
    exam_id: examId,
    student_id: user.id,
    answers,
    scores,
    score: correct,
    is_forced: isForced,
  }, { onConflict: 'exam_id,student_id' });

  if (error) throw error;

  return { score: correct, scores, wrongVocabIds };
}

// 관리자 강제 종료
export async function forceCloseExam(examId: string) {
  const supabase = await createClient();
  await supabase.from('exams').update({ status: 'closed' }).eq('id', examId);
  revalidatePath(`/admin/exams/${examId}`);
}

// 대기 화면 폴링용: 시험 상태 조회
export async function getExamStatus(examId: string): Promise<{ status: string; starts_at: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('exams')
    .select('status, starts_at')
    .eq('id', examId)
    .single();
  return data ?? null;
}
