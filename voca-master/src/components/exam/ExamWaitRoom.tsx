'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getExamStatus } from '@/app/actions/exams';

interface Props {
  examId: string;
  title: string;
  day1: number;
  day2: number;
  startsAt: string; // ISO 문자열
}

function formatCountdown(startsAt: string): string {
  const target = new Date(startsAt).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return '곧 시작됩니다';

  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}시간 ${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
  if (m > 0) return `${m}분 ${String(s).padStart(2, '0')}초`;
  return `${s}초`;
}

export default function ExamWaitRoom({ examId, title, day1, day2, startsAt }: Props) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(() => formatCountdown(startsAt));
  const [entering, setEntering] = useState(false);

  const goToExam = useCallback(() => {
    setEntering(true);
    router.replace(`/student/exam/${examId}`);
  }, [examId, router]);

  // 카운트다운 — starts_at 기준 1초마다 갱신
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(formatCountdown(startsAt));
    }, 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  // 폴링 — 3초마다 서버에서 시험 상태 확인 (Realtime 불안정 대비)
  useEffect(() => {
    const id = setInterval(async () => {
      const data = await getExamStatus(examId);
      if (data?.status === 'active') goToExam();
    }, 3000);
    return () => clearInterval(id);
  }, [examId, goToExam]);

  // Realtime — postgres_changes (즉시 반응, 폴링보다 빠름)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`exam-wait-${examId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'exams',
          filter: `id=eq.${examId}`,
        },
        (payload: any) => {
          if (payload.new?.status === 'active') goToExam();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [examId, goToExam]);

  if (entering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <p className="text-2xl font-bold text-[#0071e3] animate-pulse mb-2">시험 시작!</p>
          <p className="text-sm text-[#6e6e73]">시험 화면으로 이동 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#f5f5f7]">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e5e5ea] shadow-sm p-8 text-center">

        {/* 아이콘 */}
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <h1 className="text-lg font-bold text-[#1d1d1f] mb-1">{title}</h1>
        <p className="text-sm text-[#6e6e73] mb-6">
          Day {day1} + Day {day2} &middot; 25문항 &middot; 8분
        </p>

        {/* 카운트다운 */}
        <div className="bg-blue-50 rounded-xl px-6 py-5 mb-6">
          <p className="text-3xl font-bold text-blue-700 font-mono tracking-tight tabular-nums">
            {countdown}
          </p>
        </div>

        {/* 대기 상태 표시 */}
        <div className="flex items-center justify-center gap-2 text-sm text-[#6e6e73]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span>관리자가 시작하면 자동으로 입장됩니다</span>
        </div>
      </div>
    </div>
  );
}
