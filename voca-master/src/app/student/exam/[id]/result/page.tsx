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
    <div className="max-w-xl mx-auto px-5 py-8">
      {/* 점수 카드 */}
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center mb-4">
        <h1 className="text-[15px] font-semibold text-[#1d1d1f] mb-1">{exam?.title}</h1>
        <p className="text-[12px] text-[#6e6e73] mb-4">
          Day {exam?.day_1} + Day {exam?.day_2}
        </p>

        {isAbsent ? (
          <div className="py-4">
            <p className="text-[40px] font-semibold text-[#6e6e73] mb-2">미응시</p>
            <p className="text-[13px] text-[#6e6e73]">시험에 응시하지 않았습니다</p>
          </div>
        ) : (
          <>
            {result?.is_forced && (
              <p className="text-[11px] text-[#6e6e73] mb-3">강제 종료로 제출됨</p>
            )}
            <p className="text-[56px] font-semibold text-[#1d1d1f] leading-none mb-1">
              {score}<span className="text-[28px] text-[#6e6e73]">/{total}</span>
            </p>
            <p className="text-[13px] text-[#6e6e73]">{percentage}%</p>
            <p className="text-[12px] text-[#6e6e73] mt-2">
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
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
        <h2 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">
          {isAbsent
            ? `전체 문항 (${total}개)`
            : `문항별 결과 (정답 ${score}개 / 오답 ${wrongCount}개)`}
        </h2>
        <div className="space-y-2">
          {(questions ?? []).map((q: any) => {
            const accepted = q.accepted_answers as Array<{ pos: string; meaning_ko: string }>;
            const isCorrect = !isAbsent && scores[q.id] === true;
            const isWrong = !isAbsent && scores[q.id] === false;
            const myAnswer = answers[q.id];

            return (
              <div
                key={q.id}
                className={`rounded-xl p-3 ${
                  isCorrect
                    ? 'bg-[#f0faf4]'
                    : isWrong
                    ? 'bg-[#fff5f5]'
                    : 'bg-[#f5f5f7]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold w-5 text-center ${
                      isCorrect ? 'text-[#34c759]' : isWrong ? 'text-[#ff3b30]' : 'text-[#c7c7cc]'
                    }`}>
                      {q.question_no}
                    </span>
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">{q.vocabulary?.word}</span>
                  </div>
                  {!isAbsent && (
                    <span className={`text-[11px] shrink-0 font-medium ${
                      isCorrect ? 'text-[#34c759]' : 'text-[#ff3b30]'
                    }`}>
                      {isCorrect ? '정답' : `내 답: ${myAnswer || '(미입력)'}`}
                    </span>
                  )}
                </div>
                <div className="mt-1 ml-7 space-y-0.5">
                  {accepted.map((a, i) => (
                    <p key={i} className="text-[12px] text-[#6e6e73]">
                      <span className="opacity-60 mr-1">{a.pos}</span>
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
      <div className="flex gap-2">
        <Link
          href={`/student/exam/${id}/review`}
          className="flex-1 py-3 bg-[#f5f5f7] text-[#1d1d1f] font-semibold rounded-xl text-center text-[14px] hover:opacity-80 transition-opacity"
        >
          {isAbsent
            ? '단어 복습하기'
            : `복습하기${wrongCount > 0 ? ` (${wrongCount})` : ''}`}
        </Link>
        <Link
          href="/student/exam"
          className="flex-1 py-3 bg-[#1d1d1f] text-white font-semibold rounded-xl text-center text-[14px] hover:opacity-80 transition-opacity"
        >
          목록으로
        </Link>
      </div>
    </div>
  );
}
