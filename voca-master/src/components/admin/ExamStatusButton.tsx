'use client';

import { useTransition } from 'react';
import { updateExamStatus } from '@/app/actions/exams';

export default function ExamStatusButton({
  examId,
  currentStatus,
}: {
  examId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (currentStatus === 'closed') {
    return <span className="text-[11px] text-[#6e6e73]">종료됨</span>;
  }

  const next = currentStatus === 'scheduled' ? 'active' : 'closed';

  if (currentStatus === 'scheduled') {
    return (
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm('시험을 시작하시겠습니까? 시작 후 학생들이 응시할 수 있습니다.')) return;
          startTransition(() => updateExamStatus(examId, next));
        }}
        className="text-[11px] px-3 py-1.5 bg-[#1d1d1f] text-white font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
      >
        {isPending ? '처리중...' : '▶ 시작'}
      </button>
    );
  }

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm('시험을 종료하시겠습니까? 종료 후 추가 응시가 불가합니다.')) return;
        startTransition(() => updateExamStatus(examId, next));
      }}
      className="text-[11px] px-3 py-1.5 bg-[#f5f5f7] text-[#6e6e73] font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
    >
      {isPending ? '처리중...' : '■ 종료'}
    </button>
  );
}
