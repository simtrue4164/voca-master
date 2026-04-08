import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { stats } = await req.json() as {
    stats: {
      totalStudents: number;
      todayActive: number;
      atRiskCount: number;
      recentExamAvg: number | null;
    };
  };

  const activeRate = stats.totalStudents > 0
    ? Math.round((stats.todayActive / stats.totalStudents) * 100)
    : 0;

  const prompt = `당신은 편입영어 학원의 AI 학습 코치입니다.
오늘의 학급 현황 데이터를 바탕으로 담당 선생님께 3문장 이내의 핵심 인사이트를 한국어로 제공하세요.
구체적인 수치를 활용하고, 개선이 필요한 부분과 긍정적인 부분을 균형있게 언급하세요.

오늘 현황:
- 총 학생 수: ${stats.totalStudents}명
- 오늘 학습 참여: ${stats.todayActive}명 (${activeRate}%)
- 3일 이상 미학습 위험 학생: ${stats.atRiskCount}명
- 최근 시험 평균 점수: ${stats.recentExamAvg !== null ? `${stats.recentExamAvg}/50점` : '없음'}

3문장 이내로 간결하게 작성하세요.`;

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    // 캐시 저장
    const admin = createAdminClient();
    await admin.from('dashboard_cache').upsert({
      user_id: user.id,
      cache_type: 'admin_insight',
      content: { summary: text },
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,cache_type' });

    return NextResponse.json({ summary: text });
  } catch (err: any) {
    console.error('AI 인사이트 생성 오류:', err);
    return NextResponse.json({ error: err.message ?? 'AI 생성 실패' }, { status: 500 });
  }
}
