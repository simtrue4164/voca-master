import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const RecommendSchema = z.object({
  students: z.array(
    z.object({
      student_id: z.string(),
      risk_score: z.number().min(0).max(1).describe('위험도 점수 (0~1, 소수점 2자리)'),
      reason: z.string().describe('상담 추천 이유 (2~3문장, 한국어)'),
    })
  ),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { studentIds } = await req.json() as { studentIds: string[] };
  if (!studentIds || studentIds.length === 0) {
    return NextResponse.json({ error: 'No students provided' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 학생 기본 정보
  const { data: students } = await admin
    .from('profiles')
    .select('id, name, exam_no, class_id')
    .in('id', studentIds);

  if (!students || students.length === 0) {
    return NextResponse.json({ error: 'Students not found' }, { status: 404 });
  }

  // 전체 어휘 수
  const { count: totalVocab } = await admin
    .from('vocabulary')
    .select('id', { count: 'exact', head: true });
  const vocabTotal = totalVocab ?? 3000;

  // 학생별 학습 데이터 수집
  const studentDataList = await Promise.all(
    students.map(async (s) => {
      const [
        { count: studiedCount },
        { count: failedCount },
        { data: recentLogs },
        { data: examResults },
        { data: classAssignment },
      ] = await Promise.all([
        admin.from('learning_logs').select('id', { count: 'exact', head: true })
          .eq('student_id', s.id),
        admin.from('learning_logs').select('id', { count: 'exact', head: true })
          .eq('student_id', s.id).eq('status', 'failed'),
        admin.from('learning_logs').select('reviewed_at')
          .eq('student_id', s.id)
          .order('reviewed_at', { ascending: false })
          .limit(30),
        admin.from('exam_results').select('score, submitted_at')
          .eq('student_id', s.id)
          .order('submitted_at', { ascending: false })
          .limit(5),
        s.class_id
          ? admin.from('admin_class_assignments').select('admin_id')
              .eq('class_id', s.class_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const studied = studiedCount ?? 0;
      const failed = failedCount ?? 0;
      const progressRate = Math.round((studied / vocabTotal) * 100);
      const failRate = studied > 0 ? Math.round((failed / studied) * 100) : 0;

      // 연속 미학습일 계산
      let consecutiveAbsent = 0;
      if (recentLogs && recentLogs.length > 0) {
        const lastDate = new Date(recentLogs[0].reviewed_at);
        const today = new Date();
        consecutiveAbsent = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        consecutiveAbsent = 999; // 한 번도 학습 안 함
      }

      // 최근 시험 점수 추세
      const scores = (examResults ?? []).map((r) => r.score);
      const scoreTrend = scores.length >= 2
        ? scores[0] - scores[scores.length - 1]  // 양수 = 상승, 음수 = 하락
        : 0;
      const recentAvgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      return {
        student_id: s.id,
        name: s.name,
        exam_no: s.exam_no,
        class_id: s.class_id,
        teacher_admin_id: (classAssignment as any)?.admin_id ?? null,
        factors: {
          progress_rate: progressRate,
          score_trend: scoreTrend,
          fail_rate: failRate,
          consecutive_absent: consecutiveAbsent,
          recent_avg_score: recentAvgScore,
        },
      };
    })
  );

  // Gemini로 위험도 + 이유 생성
  const prompt = `당신은 편입영어 학원의 AI 학습 코치입니다.
다음 학생들의 학습 데이터를 분석하여 각 학생의 상담 필요도(risk_score)와 이유를 생성하세요.

risk_score 기준:
- 0.0~0.3: 정상 (상담 불필요)
- 0.3~0.6: 주의 (경미한 이상)
- 0.6~0.8: 위험 (상담 권장)
- 0.8~1.0: 심각 (즉시 상담 필요)

학생 데이터:
${studentDataList.map((s) => `
학생: ${s.name} (수험번호: ${s.exam_no ?? 'N/A'})
- 학습 진도율: ${s.factors.progress_rate}%
- 오답률: ${s.factors.fail_rate}%
- 연속 미학습일: ${s.factors.consecutive_absent === 999 ? '학습 이력 없음' : `${s.factors.consecutive_absent}일`}
- 최근 시험 점수: ${s.factors.recent_avg_score !== null ? `평균 ${s.factors.recent_avg_score}/50점` : '시험 이력 없음'}
- 시험 점수 추세: ${s.factors.score_trend > 0 ? `+${s.factors.score_trend}점 상승` : s.factors.score_trend < 0 ? `${s.factors.score_trend}점 하락` : '변동 없음'}
`).join('\n')}

각 학생에 대해 student_id, risk_score(소수점 2자리), reason(한국어 2~3문장)을 반환하세요.`;

  try {
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: RecommendSchema,
      prompt,
    });

    const now = new Date().toISOString();
    let createdCount = 0;

    for (const rec of object.students) {
      const studentData = studentDataList.find((s) => s.student_id === rec.student_id);
      if (!studentData) continue;

      const adminId = studentData.teacher_admin_id ?? user.id;

      // counseling_recommendations upsert
      const { data: recommendation } = await admin
        .from('counseling_recommendations')
        .insert({
          student_id: rec.student_id,
          admin_id: adminId,
          risk_score: rec.risk_score,
          reason: rec.reason,
          factors: studentData.factors,
        })
        .select('id')
        .single();

      // risk_score > 0.5인 경우만 상담 요청 생성
      if (rec.risk_score > 0.5 && recommendation) {
        // 이미 pending/scheduled 상태의 AI 상담 요청이 있는지 확인
        const { count: existingCount } = await admin
          .from('counseling_requests')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', rec.student_id)
          .eq('source', 'ai')
          .in('status', ['pending', 'scheduled']);

        if ((existingCount ?? 0) === 0) {
          await admin.from('counseling_requests').insert({
            student_id: rec.student_id,
            admin_id: adminId,
            source: 'ai',
            recommendation_id: recommendation.id,
            request_note: rec.reason,
            status: 'pending',
          });
          createdCount++;
        }
      }
    }

    return NextResponse.json({
      analyzed: object.students.length,
      created: createdCount,
      recommendations: object.students,
    });
  } catch (err: any) {
    console.error('AI 상담 추천 오류:', err);
    return NextResponse.json({ error: err.message ?? 'AI 생성 실패' }, { status: 500 });
  }
}
