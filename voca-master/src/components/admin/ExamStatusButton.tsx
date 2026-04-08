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
    return <span className="text-xs text-gray-400">종료됨</span>;
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
        className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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
      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
    >
      {isPending ? '처리중...' : '■ 종료'}
    </button>
  );
}
