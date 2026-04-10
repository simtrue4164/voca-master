import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: logs } = await supabase
    .from('learning_logs')
    .select('vocab_id, status, vocabulary(id, day, word)')
    .eq('student_id', user!.id)
    .eq('status', 'failed');

  const failedWords = logs ?? [];

  const byDay: Record<number, typeof failedWords> = {};
  failedWords.forEach((log: any) => {
    const day = log.vocabulary?.day;
    if (day) {
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(log);
    }
  });

  const sortedDays = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">복습</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">오답 단어 {failedWords.length}개</p>
      </div>

      {failedWords.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
          <p className="text-3xl mb-3">✓</p>
          <p className="text-[15px] font-semibold text-[#1d1d1f]">오답 단어가 없습니다</p>
          <p className="text-[13px] text-[#6e6e73] mt-1">학습을 계속 진행해보세요</p>
        </div>
      ) : (
        <>
          <Link
            href="/student/review/session"
            className="block w-full py-3.5 bg-[#1d1d1f] text-white font-semibold rounded-xl text-center text-[14px] mb-4 hover:opacity-80 transition-opacity"
          >
            전체 복습 시작 ({failedWords.length}단어)
          </Link>

          <div className="space-y-2">
            {sortedDays.map((day) => (
              <div key={day} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-semibold text-[#1d1d1f]">Day {day}</span>
                  <span className="text-[11px] text-[#6e6e73]">{byDay[day].length}단어</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {byDay[day].slice(0, 8).map((log: any) => (
                    <span key={log.vocab_id} className="text-[12px] bg-[#f5f5f7] text-[#1d1d1f] px-2.5 py-1 rounded-lg">
                      {log.vocabulary?.word}
                    </span>
                  ))}
                  {byDay[day].length > 8 && (
                    <span className="text-[12px] text-[#6e6e73] px-2 py-1">+{byDay[day].length - 8}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
