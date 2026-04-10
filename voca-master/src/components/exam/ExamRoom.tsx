'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { submitExam, autoCloseIfExpired } from '@/app/actions/exams';

type Question = { id: string; vocab_id: string; question_no: number; word: string };

export default function ExamRoom({
  examId,
  title,
  endsAt,
  questions,
}: {
  examId: string;
  title: string;
  endsAt: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 항상 최신 answers를 참조하기 위한 ref (stale closure 방지)
  const answersRef = useRef<Record<string, string>>({});
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // 중복 제출 방지용 ref
  const submittingRef = useRef(false);

  const handleSubmit = useCallback(async (isForced = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      await submitExam(examId, answersRef.current, isForced);
      if (isForced) {
        // 타이머 만료 시 DB 상태도 closed로 변경 (다른 학생/관리자 화면 반영)
        await autoCloseIfExpired(examId);
      }
      router.push(`/student/exam/${examId}/result`);
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [examId, router]);

  // 타이머/Realtime에서 항상 최신 handleSubmit을 호출하기 위한 ref
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => { handleSubmitRef.current = handleSubmit; }, [handleSubmit]);

  // 타이머 — endsAt 기준, 만료 시 자동 제출
  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) handleSubmitRef.current(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  // Realtime — 관리자 강제 종료 감지
  useEffect(() => {
    let channel: any;
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      channel = supabase
        .channel(`exam-${examId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'exams',
          filter: `id=eq.${examId}`,
        }, (payload: any) => {
          if (payload.new?.status === 'closed') handleSubmitRef.current();
        })
        .subscribe();
    });
    return () => { channel?.unsubscribe(); };
  }, [examId]);

  const current = questions[currentIndex];
  const answered = Object.keys(answers).filter((k) => answers[k].trim()).length;
  const unanswered = questions.length - answered;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');
  const isUrgent = timeLeft > 0 && timeLeft <= 60;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* 상단 바 */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">{title}</span>
        <div className="flex items-center gap-3">
          <span className="text-[#6e6e73] text-sm">{answered}/{questions.length} 답변</span>
          <span className={`font-mono text-xl font-bold ${isUrgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {mm}:{ss}
          </span>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            제출
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 문항 네비게이터 */}
        <div className="w-24 bg-gray-800 p-2 overflow-y-auto shrink-0">
          <div className="grid grid-cols-3 gap-1">
            {questions.map((q, i) => {
              const hasAnswer = !!(answers[q.id]?.trim());
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`aspect-square rounded text-xs font-medium transition-colors ${
                    i === currentIndex
                      ? 'bg-blue-500 text-white'
                      : hasAnswer
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {q.question_no}
                </button>
              );
            })}
          </div>
        </div>

        {/* 문항 영역 */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <p className="text-[#6e6e73] text-sm mb-2">문항 {current.question_no} / {questions.length}</p>

            {/* 단어 카드 */}
            <div className="bg-white rounded-2xl p-10 text-center mb-6 shadow-lg">
              <p className="text-4xl font-bold text-[#1d1d1f]">{current.word}</p>
              <p className="text-[#6e6e73] text-sm mt-3">이 단어의 한국어 뜻을 입력하세요</p>
            </div>

            {/* 답안 입력 */}
            <input
              ref={inputRef}
              type="text"
              value={answers[current.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [current.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
                }
              }}
              placeholder="한국어 뜻 입력 (Enter: 다음 문항)"
              autoFocus
              className="w-full px-4 py-4 bg-gray-800 text-white border border-gray-600 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
            />

            {/* 이전 / 다음 */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl text-sm font-medium disabled:opacity-30"
              >
                이전
              </button>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                disabled={currentIndex === questions.length - 1}
                className="flex-1 py-3 bg-[#1d1d1f] text-white rounded-xl text-sm font-medium hover:opacity-80 disabled:opacity-30"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 제출 확인 모달 */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">시험 종료</h3>
            {unanswered > 0 && (
              <p className="text-amber-600 text-sm mb-2">미답 문항이 {unanswered}개 있습니다.</p>
            )}
            <p className="text-[#6e6e73] text-sm mb-6">
              지금까지 입력한 답변을 제출하고 채점합니다.<br />제출 후에는 수정할 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-3 bg-[#f5f5f7] text-[#1d1d1f] rounded-xl text-sm font-medium hover:bg-[#e5e5ea]"
              >
                계속 풀기
              </button>
              <button
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? '제출 중...' : '제출 및 채점'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 제출 중 오버레이 */}
      {submitting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-8 py-6 text-center">
            <p className="text-base font-semibold text-[#1d1d1f] mb-1">채점 중...</p>
            <p className="text-sm text-[#6e6e73]">잠시만 기다려주세요</p>
          </div>
        </div>
      )}
    </div>
  );
}
