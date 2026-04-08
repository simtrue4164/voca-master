'use server';

import { createClient } from '@/lib/supabase/server';
import type { LearningStatus, StudentProgress } from '@/types';

export type RelatedType = 'synonym' | 'similar' | 'antonym';

export async function upsertRelatedWordLog(
  relatedId: string,
  relatedType: RelatedType,
  status: 'studied' | 'memorized' | 'failed'
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  await supabase
    .from('related_word_logs')
    .upsert(
      { student_id: user.id, related_id: relatedId, related_type: relatedType, status, reviewed_at: new Date().toISOString() },
      { onConflict: 'student_id,related_id,related_type' }
    );
}

export async function upsertLearningLog(vocabId: string, status: LearningStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { error } = await supabase
    .from('learning_logs')
    .upsert(
      { student_id: user.id, vocab_id: vocabId, status, reviewed_at: new Date().toISOString() },
      { onConflict: 'student_id,vocab_id' }
    );

  if (error) throw error;
}

export async function getStudentProgress(): Promise<StudentProgress> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('id', user.id)
    .single();

  // 반 시작일 기준 현재 day 계산
  let currentDay = 1;
  if (profile?.class_id) {
    const { data: cls } = await supabase
      .from('classes')
      .select('start_date')
      .eq('id', profile.class_id)
      .single();

    if (cls) {
      const start = new Date(cls.start_date);
      const today = new Date();
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      currentDay = Math.max(1, Math.min(60, diff + 1));
    }
  }

  const targetWords = currentDay * 50;

  // 학습 로그 집계
  const { data: logs } = await supabase
    .from('learning_logs')
    .select('status')
    .eq('student_id', user.id);

  const studied = logs?.length ?? 0;
  const memorized = logs?.filter((l) => l.status === 'memorized').length ?? 0;
  const failed = logs?.filter((l) => l.status === 'failed').length ?? 0;
  const tested = memorized + failed;

  // 연속 학습일 계산
  const { data: recentLogs } = await supabase
    .from('learning_logs')
    .select('reviewed_at')
    .eq('student_id', user.id)
    .order('reviewed_at', { ascending: false });

  let streakDays = 0;
  if (recentLogs && recentLogs.length > 0) {
    const dates = [...new Set(
      recentLogs.map((l) => new Date(l.reviewed_at).toDateString())
    )];
    const today = new Date().toDateString();
    let cursor = new Date();
    for (const _ of dates) {
      if (dates.includes(cursor.toDateString())) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
  }

  return {
    student_id: user.id,
    total_words: targetWords,
    studied_count: studied,
    memorized_count: memorized,
    failed_count: failed,
    progress_rate: targetWords > 0 ? Math.round((studied / targetWords) * 100) : 0,
    learning_rate: tested > 0 ? Math.round((memorized / tested) * 100) : 0,
    streak_days: streakDays,
    current_day: currentDay,
  };
}
