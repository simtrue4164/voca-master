import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: examId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { score, total, wrongWords } = await req.json() as {
    score: number;
    total: number;
    wrongWords: string[];
  };

  const percentage = Math.round((score / total) * 100);

  // 학생 학습 진도율
  const admin = createAdminClient();
  const { count: studiedCount } = await admin
    .from('learning_logs')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', user.id);

  const progressRate = Math.round(((studiedCount ?? 0) / 3000) * 100);

  const prompt = `당신은 편입영어 학원의 AI 학습 코치입니다.
학생의 시험 결과를 바탕으로 따뜻하고 구체적인 맞춤 코칭 메시지를 한국어로 작성하세요.

시험 결과:
- 점수: ${score}/${total} (${percentage}점)
- 틀린 단어 (최대 5개): ${wrongWords.slice(0, 5).join(', ') || '없음'}
- 전체 학습 진도율: ${progressRate}%

작성 규칙:
- 3~4문장으로 작성
- 점수에 따른 적절한 격려 또는 자극 포함
- 틀린 단어가 있으면 해당 단어 복습을 구체적으로 권유
- 학습 진도율이 낮으면 꾸준한 학습 독려
- 과도한 칭찬보다 실질적인 조언 중심`;

  try {
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
    });

    // dashboard_cache에 저장 (exam_id를 포함한 키로 구분)
    await admin.from('dashboard_cache').upsert({
      user_id: user.id,
      cache_type: 'student_coaching',
      content: { message: text, exam_id: examId, score, total },
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,cache_type' });

    return NextResponse.json({ message: text });
  } catch (err: any) {
    console.error('AI 코칭 메시지 오류:', err);
    return NextResponse.json({ error: err.message ?? 'AI 생성 실패' }, { status: 500 });
  }
}
