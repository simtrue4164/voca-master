import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StudentHeatmap from '@/components/admin/StudentHeatmap';
import StudentScoreChart from '@/components/admin/StudentScoreChart';
import StudentRelatedProgress from '@/components/admin/StudentRelatedProgress';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  // 학생 프로필
  const { data: student } = await admin
    .from('profiles')
    .select('id, name, exam_no, class_id, is_active, classes(name, start_date, end_date, branches(name))')
    .eq('id', id)
    .eq('role', 'student')
    .single();

  if (!student) notFound();

  const cls = student.classes as any;
  const branch = cls?.branches as any;

  // 반 시작일 기준 현재 day 계산
  let currentDay = 1;
  if (cls?.start_date) {
    const start = new Date(cls.start_date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    currentDay = Math.max(1, Math.min(60, diff + 1));
  }

  // 학습 로그 전체
  const { data: logs } = await admin
    .from('learning_logs')
    .select('vocab_id, status, reviewed_at')
    .eq('student_id', id);

  const studied = logs?.length ?? 0;
  const memorized = logs?.filter((l) => l.status === 'memorized').length ?? 0;
  const failed = logs?.filter((l) => l.status === 'failed').length ?? 0;
  const tested = memorized + failed;
  const targetWords = currentDay * 50;

  // 날짜별 학습 수 (히트맵용) - 최근 60일
  const dateMap: Record<string, number> = {};
  (logs ?? []).forEach((l) => {
    const d = new Date(l.reviewed_at).toISOString().split('T')[0];
    dateMap[d] = (dateMap[d] ?? 0) + 1;
  });

  // 60일 날짜 배열 생성
  const heatmapData: { date: string; count: number }[] = [];
  if (cls?.start_date) {
    for (let i = 0; i < 60; i++) {
      const d = new Date(cls.start_date);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      heatmapData.push({ date: dateStr, count: dateMap[dateStr] ?? 0 });
    }
  }

  // 시험 점수 추이
  const { data: examResults } = await admin
    .from('exam_results')
    .select('score, submitted_at, exams(title, day_1, day_2)')
    .eq('student_id', id)
    .order('submitted_at', { ascending: true });

  const scoreHistory = (examResults ?? []).map((r) => ({
    label: (r.exams as any)?.title ?? '시험',
    score: r.score,
    date: new Date(r.submitted_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
  }));

  // 취약 단어 Top 10 (failed 상태인 단어들)
  const failedVocabIds = (logs ?? [])
    .filter((l) => l.status === 'failed')
    .map((l) => l.vocab_id);

  let weakWords: { word: string; day: number }[] = [];
  if (failedVocabIds.length > 0) {
    const { data: vocabs } = await admin
      .from('vocabulary')
      .select('word, day')
      .in('id', failedVocabIds.slice(0, 10));
    weakWords = vocabs ?? [];
  }

  // ── 관련 단어 학습 현황 ──────────────────────────────────
  // 1~currentDay DAY의 어휘 전체 조회
  const { data: allVocabs } = await admin
    .from('vocabulary')
    .select('id, day')
    .lte('day', currentDay)
    .order('day');

  const allVocabIds = (allVocabs ?? []).map((v) => v.id);

  const [
    { data: allSynonyms },
    { data: allSimilar },
    { data: allAntonyms },
    { data: relatedLogs },
  ] = await Promise.all([
    allVocabIds.length > 0
      ? admin.from('word_synonyms').select('id, vocab_id').in('vocab_id', allVocabIds)
      : Promise.resolve({ data: [] }),
    allVocabIds.length > 0
      ? admin.from('word_similar').select('id, vocab_id').in('vocab_id', allVocabIds)
      : Promise.resolve({ data: [] }),
    allVocabIds.length > 0
      ? admin.from('word_antonyms').select('id, vocab_id').in('vocab_id', allVocabIds)
      : Promise.resolve({ data: [] }),
    admin.from('related_word_logs').select('related_id, related_type, status').eq('student_id', id),
  ]);

  const studiedSynonymIds = new Set((relatedLogs ?? []).filter((r) => r.related_type === 'synonym').map((r) => r.related_id));
  const studiedSimilarIds = new Set((relatedLogs ?? []).filter((r) => r.related_type === 'similar').map((r) => r.related_id));
  const studiedAntonymIds = new Set((relatedLogs ?? []).filter((r) => r.related_type === 'antonym').map((r) => r.related_id));

  // DAY별 집계
  const vocabsByDay: Record<number, string[]> = {};
  for (const v of allVocabs ?? []) {
    if (!vocabsByDay[v.day]) vocabsByDay[v.day] = [];
    vocabsByDay[v.day].push(v.id);
  }

  const studiedVocabIds = new Set((logs ?? []).map((l) => l.vocab_id));

  const synonymByVocab: Record<string, string[]> = {};
  for (const s of allSynonyms ?? []) {
    if (!synonymByVocab[s.vocab_id]) synonymByVocab[s.vocab_id] = [];
    synonymByVocab[s.vocab_id].push(s.id);
  }
  const similarByVocab: Record<string, string[]> = {};
  for (const s of allSimilar ?? []) {
    if (!similarByVocab[s.vocab_id]) similarByVocab[s.vocab_id] = [];
    similarByVocab[s.vocab_id].push(s.id);
  }
  const antonymByVocab: Record<string, string[]> = {};
  for (const a of allAntonyms ?? []) {
    if (!antonymByVocab[a.vocab_id]) antonymByVocab[a.vocab_id] = [];
    antonymByVocab[a.vocab_id].push(a.id);
  }

  const relatedDays = Object.entries(vocabsByDay).map(([dayStr, vIds]) => {
    const day = parseInt(dayStr);
    const synIds   = vIds.flatMap((vid) => synonymByVocab[vid] ?? []);
    const simIds   = vIds.flatMap((vid) => similarByVocab[vid]  ?? []);
    const antIds   = vIds.flatMap((vid) => antonymByVocab[vid]  ?? []);
    return {
      day,
      vocabDone: vIds.every((vid) => studiedVocabIds.has(vid)),
      synonym: { total: synIds.length, studied: synIds.filter((x) => studiedSynonymIds.has(x)).length },
      similar: { total: simIds.length, studied: simIds.filter((x) => studiedSimilarIds.has(x)).length },
      antonym: { total: antIds.length, studied: antIds.filter((x) => studiedAntonymIds.has(x)).length },
    };
  }).sort((a, b) => a.day - b.day);

  const totalSynonym = (allSynonyms ?? []).length;
  const totalSimilar = (allSimilar ?? []).length;
  const totalAntonym = (allAntonyms ?? []).length;
  const studiedSynonym = studiedSynonymIds.size;
  const studiedSimilar = studiedSimilarIds.size;
  const studiedAntonym = studiedAntonymIds.size;

  // 상담 이력
  const { data: counselingHistory } = await admin
    .from('counseling_records')
    .select('content, outcome, created_at, counseling_requests!inner(student_id)')
    .eq('counseling_requests.student_id', id)
    .order('created_at', { ascending: false })
    .limit(3);

  // 연속 학습일
  let streakDays = 0;
  if (logs && logs.length > 0) {
    const dates = [...new Set(logs.map((l) => new Date(l.reviewed_at).toDateString()))];
    const cursor = new Date(new Date().getTime() + 9 * 60 * 60 * 1000); // KST
    for (let i = 0; i < 60; i++) {
      if (dates.includes(cursor.toDateString())) {
        streakDays++;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 브레드크럼 */}
      <Link href="/admin/students" className="text-[12px] text-[#6e6e73] hover:text-[#1d1d1f] block">← 학생 목록</Link>

      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">{student.name}</h1>
            <p className="text-[13px] text-[#6e6e73] mt-0.5">
              수험번호 {student.exam_no ?? '-'} · {branch?.name ?? ''} {cls?.name ?? ''}
            </p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
            student.is_active ? 'bg-[#f5f5f7] text-[#34c759]' : 'bg-[#f5f5f7] text-[#c7c7cc]'
          }`}>
            {student.is_active ? '활성' : '비활성'}
          </span>
        </div>

        {/* 요약 스탯 */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: '학습 진도', value: `${targetWords > 0 ? Math.round((studied / targetWords) * 100) : 0}%`, sub: `${studied}/${targetWords}단어` },
            { label: '학습율', value: `${tested > 0 ? Math.round((memorized / tested) * 100) : 0}%`, sub: '셀프테스트 정답률' },
            { label: '연속 학습일', value: `${streakDays}일`, sub: '오늘 기준' },
            { label: '오답 단어', value: `${failed}개`, sub: '복습 필요' },
          ].map((s) => (
            <div key={s.label} className="bg-[#f5f5f7] rounded-xl p-3">
              <p className="text-[11px] text-[#6e6e73] mb-1">{s.label}</p>
              <p className="text-[18px] font-semibold text-[#1d1d1f]">{s.value}</p>
              <p className="text-[11px] text-[#6e6e73] mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 학습 히트맵 */}
      {heatmapData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-[13px] font-semibold text-[#1d1d1f] mb-4">60일 학습 히트맵</h2>
          <StudentHeatmap data={heatmapData} startDate={cls.start_date} />
        </div>
      )}

      {/* 시험 점수 추이 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-[13px] font-semibold text-[#1d1d1f] mb-4">시험 점수 추이</h2>
        {scoreHistory.length === 0 ? (
          <p className="text-[13px] text-[#6e6e73] text-center py-6">응시한 시험이 없습니다</p>
        ) : (
          <StudentScoreChart data={scoreHistory} />
        )}
      </div>

      {/* 관련 단어 학습 현황 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#1d1d1f]">관련 단어 학습 현황</h2>
          <span className="text-[12px] text-[#6e6e73]">동의어 · 유의어 · 반의어</span>
        </div>
        <StudentRelatedProgress
          days={relatedDays}
          totalSynonym={totalSynonym}
          totalSimilar={totalSimilar}
          totalAntonym={totalAntonym}
          studiedSynonym={studiedSynonym}
          studiedSimilar={studiedSimilar}
          studiedAntonym={studiedAntonym}
        />
      </div>

      {/* 취약 단어 Top 10 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-[13px] font-semibold text-[#1d1d1f] mb-3">취약 단어 ({Math.min(weakWords.length, 10)}개)</h2>
        {weakWords.length === 0 ? (
          <p className="text-[13px] text-[#6e6e73]">오답 단어가 없습니다</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weakWords.map((w) => (
              <span key={w.word} className="inline-flex items-center gap-1.5 bg-[#f5f5f7] text-[#1d1d1f] text-[12px] px-3 py-1.5 rounded-lg">
                <span className="font-medium">{w.word}</span>
                <span className="text-[#6e6e73]">Day {w.day}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 상담 이력 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-[#1d1d1f]">상담 이력</h2>
          <Link
            href={`/admin/counseling?status=all`}
            className="text-[12px] text-[#0071e3]"
          >
            전체 보기
          </Link>
        </div>
        {!counselingHistory || counselingHistory.length === 0 ? (
          <p className="text-[13px] text-[#6e6e73]">상담 이력이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {counselingHistory.map((h: any) => (
              <div key={h.id} className="p-3 bg-[#f5f5f7] rounded-xl text-[13px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-[#6e6e73]">
                    {new Date(h.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  {h.outcome && (
                    <span className="text-[11px] bg-white text-[#6e6e73] px-2 py-0.5 rounded-full">
                      {h.outcome}
                    </span>
                  )}
                </div>
                <p className="text-[#1d1d1f] line-clamp-2">{h.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
