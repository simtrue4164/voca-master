'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { autoCloseIfExpired } from '@/app/actions/exams';

export default function ExamAutoClosePoller({
  examId,
  endsAt,
}: {
  examId: string;
  endsAt: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const end = new Date(endsAt).getTime();

    const check = async () => {
      if (Date.now() < end) return;
      const closed = await autoCloseIfExpired(examId);
      if (closed) router.refresh();
    };

    // 즉시 한 번 체크 (이미 만료됐을 수 있음)
    check();

    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, [examId, endsAt, router]);

  return null;
}
