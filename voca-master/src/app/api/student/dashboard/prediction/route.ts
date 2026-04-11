import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const PredictionSchema = z.object({
  next_exam_score_min: z.number().int().min(0).max(50).describe('다음 시험 예상 최저 점수 (50점 만점)'),
  next_exam_score_max: z.number().int().min(0).max(50).describe('다음 시험 예상 최고 점수 (50점 만점)'),
  completion_probability: z.number().min(0).max(100).describe('60일 커리큘럼 완주 가능성 (%)'),
  message: z.string().describe('학생에게 전달할 예측 메시지 (3문장, 한국어, 구체적 수치 포함)'),
  action: z.string().describe('가장 중요한 실천 행동 1가지 (1문장, 한국어)'),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { progressRate, learningRate, streakDays, currentDay, failedCount } =
    await req.json() as {
      progressRate: number;
      learningRate: number;
      streakDays: number;
      currentDay: number;
      failedCount: number;
    };

  const admin = createAdminClient();

  // 최근 시험 점수 (최근 3회)
  const { data: examResults } = await admin
    .from('exam_results')
    .select('score, submitted_at')
    .eq('student_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(3);

  const scores = (examResults ?? []).map((r) => r.score);
  const recentAvg = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const scoreTrend = scores.length >= 2 ? scores[0] - scores[scores.length - 1] : 0;

  // 남은 Day 계산
  const remainingDays = 60 - currentDay;

  const prompt = `당신은 편입영어 학원의 AI 성과 예측 전문가입니다.
학생의 현재 학습 데이터를 분석하여 성과를 예측하세요.

학생 현황:
- 현재 진행 Day: ${currentDay} / 60일
- 남은 Day: ${remainingDays}일
- 전체 학습 진도율: ${progressRate}% (3,000단어 중 학습 완료)
- 셀프테스트 정답률: ${learningRate}%
- 연속 학습일 (streak): ${streakDays}일
- 오답 누적 단어 수: ${failedCount}개
- 최근 시험 평균: ${recentAvg !== null ? `${recentAvg}/50점` : '시험 이력 없음'}
- 최근 시험 점수 추세: ${scoreTrend > 0 ? `+${scoreTrend}점 상승` : scoreTrend < 0 ? `${scoreTrend}점 하락` : '시험 이력 없음 또는 변동 없음'}

예측 기준:
- next_exam_score_min/max: 현재 정답률과 시험 추세를 반영한 현실적 예상 범위 (50점 만점)
- completion_probability: streak, 진도율, 남은 일수를 고려한 완주 가능성
- message: 수치를 활용한 구체적 피드백 (과도한 칭찬 금지)
- action: 지금 당장 해야 할 가장 중요한 행동 1가지`;

  try {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: PredictionSchema,
      prompt,
    });

    // 캐시 저장
    const today = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    await admin.from('dashboard_cache').upsert({
      user_id: user.id,
      cache_type: 'student_prediction',
      content: { ...object, cached_date: today },
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,cache_type' });

    return NextResponse.json(object);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'AI 생성 실패' }, { status: 500 });
  }
}
