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

  // Day별 그룹화
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
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">복습</h1>
      <p className="text-sm text-gray-500 mb-6">오답 단어 {failedWords.length}개</p>

      {failedWords.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">오답 단어가 없습니다!</p>
          <p className="text-sm mt-1">학습을 계속 진행해보세요</p>
        </div>
      ) : (
        <>
          <Link
            href="/student/review/session"
            className="block w-full py-4 bg-blue-600 text-white font-semibold rounded-xl text-center mb-4"
          >
            전체 복습 시작 ({failedWords.length}단어)
          </Link>

          <div className="space-y-3">
            {sortedDays.map((day) => (
              <div key={day} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Day {day}</span>
                  <span className="text-xs text-red-500">{byDay[day].length}단어</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {byDay[day].slice(0, 8).map((log: any) => (
                    <span key={log.vocab_id} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">
                      {log.vocabulary?.word}
                    </span>
                  ))}
                  {byDay[day].length > 8 && (
                    <span className="text-xs text-gray-400">+{byDay[day].length - 8}개</span>
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
