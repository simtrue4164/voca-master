import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import ExamCoachingCard from '@/components/student/ExamCoachingCard';

export default async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: result } = await supabase
    .from('exam_results')
    .select('score, scores, answers, submitted_at, is_forced')
    .eq('exam_id', id)
    .eq('student_id', user!.id)
    .maybeSingle();

  const { data: exam } = await supabase
    .from('exams')
    .select('title, day_1, day_2')
    .eq('id', id)
    .single();

  const { data: questions } = await supabase
    .from('exam_questions')
    .select('id, vocab_id, question_no, accepted_answers, vocabulary(word)')
    .eq('exam_id', id)
    .order('question_no');

  const isAbsent = !result;
  const scores = (result?.scores ?? {}) as Record<string, boolean>;
  const answers = (result?.answers ?? {}) as Record<string, string>;
  const total = questions?.length ?? 50;
  const score = result?.score ?? 0;
  const percentage = Math.round((score / total) * 100);

  const wrongCount = isAbsent
    ? total
    : (questions ?? []).filter((q: any) => !scores[q.id]).length;

  const wrongWords = isAbsent
    ? []
    : (questions ?? [])
        .filter((q: any) => !scores[q.id])
        .map((q: any) => q.vocabulary?.word ?? '')
        .filter(Boolean);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* 점수 카드 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mb-6">
        <h1 className="text-lg font-bold text-gray-900 mb-1">{exam?.title}</h1>
        <p className="text-xs text-gray-400 mb-3">
          Day {exam?.day_1} + Day {exam?.day_2}
        </p>

        {isAbsent ? (
          <div className="py-4">
            <p className="text-5xl font-black text-orange-400 mb-2">미응시</p>
            <p className="text-sm text-gray-400">시험에 응시하지 않았습니다</p>
          </div>
        ) : (
          <>
            {result?.is_forced && (
              <p className="text-xs text-red-500 mb-3">강제 종료로 제출됨</p>
            )}
            <div className={`text-6xl font-black mb-2 ${
              percentage >= 80 ? 'text-green-500' : percentage >= 60 ? 'text-blue-500' : 'text-red-500'
            }`}>
              {score}<span className="text-3xl text-gray-400">/{total}</span>
            </div>
            <p className="text-gray-500 text-sm">{percentage}점</p>
            <p className="text-xs text-gray-400 mt-2">
              제출 {new Date(result!.submitted_at).toLocaleString('ko-KR', {
                month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </>
        )}
      </div>

      {/* AI 코칭 메시지 */}
      {!isAbsent && (
        <ExamCoachingCard
          examId={id}
          score={score}
          total={total}
          wrongWords={wrongWords}
        />
      )}

      {/* 전체 문항 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {isAbsent
            ? `전체 문항 (${total}개)`
            : `문항별 결과 (정답 ${score}개 / 오답 ${wrongCount}개)`}
        </h2>
        <div className="space-y-3">
          {(questions ?? []).map((q: any) => {
            const accepted = q.accepted_answers as Array<{ pos: string; meaning_ko: string }>;
            const isCorrect = !isAbsent && scores[q.id] === true;
            const isWrong = !isAbsent && scores[q.id] === false;
            const myAnswer = answers[q.id];

            return (
              <div
                key={q.id}
                className={`rounded-lg p-3 border ${
                  isCorrect
                    ? 'bg-green-50 border-green-200'
                    : isWrong
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 text-center ${
                      isCorrect ? 'text-green-600' : isWrong ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {q.question_no}
                    </span>
                    <span className="font-semibold text-gray-900">{q.vocabulary?.word}</span>
                  </div>
                  {!isAbsent && (
                    <span className={`text-xs shrink-0 font-medium ${
                      isCorrect ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {isCorrect ? '정답' : `내 답: ${myAnswer || '(미입력)'}`}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 ml-7 space-y-0.5">
                  {accepted.map((a, i) => (
                    <p key={i} className={`text-sm ${
                      isCorrect ? 'text-green-700' : isWrong ? 'text-red-700' : 'text-gray-600'
                    }`}>
                      <span className="text-xs opacity-60 mr-1">{a.pos}</span>
                      {a.meaning_ko}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-3">
        <Link
          href={`/student/exam/${id}/review`}
          className="flex-1 py-3 bg-red-50 text-red-600 font-medium rounded-xl text-center text-sm hover:bg-red-100 transition-colors"
        >
          {isAbsent
            ? '단어 복습하기'
            : `단어 복습하기${wrongCount > 0 ? ` (오답 ${wrongCount})` : ''}`}
        </Link>
        <Link
          href="/student/exam"
          className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center text-sm hover:bg-gray-200 transition-colors"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
