import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import StudentRelatedProgress from '@/components/admin/StudentRelatedProgress';

export default async function ProgressDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  // 학생 프로필 (조인 없이)
  const { data: student } = await admin
    .from('profiles')
    .select('id, name, exam_no, class_id, is_active')
    .eq('id', id)
    .eq('role', 'student')
    .single();

  if (!student) notFound();

  // 반 정보 별도 조회
  const { data: cls } = student.class_id
    ? await admin.from('classes').select('id, name, start_date, branch_id').eq('id', student.class_id).single()
    : { data: null };

  // 지점 정보 별도 조회
  const { data: branch } = (cls as any)?.branch_id
    ? await admin.from('branches').select('name').eq('id', (cls as any).branch_id).single()
    : { data: null };

  // 반 시작일 기준 현재 day
  let currentDay = 60;
  if (cls?.start_date) {
    const diff = Math.floor(
      (Date.now() - new Date(cls.start_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    currentDay = Math.max(1, Math.min(60, diff + 1));
  }

  // 어휘 학습 로그
  const { data: vocabLogs } = await admin
    .from('learning_logs')
    .select('vocab_id, status')
    .eq('student_id', id);

  const studiedVocabIds = new Set((vocabLogs ?? []).map((l) => l.vocab_id));
  const totalStudied = studiedVocabIds.size;
  const memorized = (vocabLogs ?? []).filter((l) => l.status === 'memorized').length;

  // 어휘 전체 (1~60)
  const { data: allVocabs } = await admin
    .from('vocabulary')
    .select('id, day')
    .order('day');

  const allVocabIds = (allVocabs ?? []).map((v) => v.id);
  const targetWords = 60 * 50;

  // 관련 단어 전체 + 학습 로그 병렬 조회
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
    admin.from('related_word_logs')
      .select('related_id, related_type, status')
      .eq('student_id', id),
  ]);

  // 타입별 학습 set
  const studiedSynonymIds = new Set(
    (relatedLogs ?? []).filter((r) => r.related_type === 'synonym').map((r) => r.related_id)
  );
  const studiedSimilarIds = new Set(
    (relatedLogs ?? []).filter((r) => r.related_type === 'similar').map((r) => r.related_id)
  );
  const studiedAntonymIds = new Set(
    (relatedLogs ?? []).filter((r) => r.related_type === 'antonym').map((r) => r.related_id)
  );

  // 어휘별 관련 단어 맵
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

  // DAY별 집계
  const vocabsByDay: Record<number, string[]> = {};
  for (const v of allVocabs ?? []) {
    if (!vocabsByDay[v.day]) vocabsByDay[v.day] = [];
    vocabsByDay[v.day].push(v.id);
  }

  const relatedDays = Object.entries(vocabsByDay).map(([dayStr, vIds]) => {
    const day = parseInt(dayStr);
    const synIds = vIds.flatMap((vid) => synonymByVocab[vid] ?? []);
    const simIds = vIds.flatMap((vid) => similarByVocab[vid]  ?? []);
    const antIds = vIds.flatMap((vid) => antonymByVocab[vid]  ?? []);
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

  const vocabRate    = targetWords > 0 ? Math.round((totalStudied / targetWords) * 100) : 0;
  const totalRelated = totalSynonym + totalSimilar + totalAntonym;
  const studiedAll   = studiedSynonym + studiedSimilar + studiedAntonym;
  const relatedRate  = totalRelated > 0 ? Math.round((studiedAll / totalRelated) * 100) : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/admin/progress" className="text-gray-400 hover:text-gray-600">← 학습 진도</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600">{student.name}</span>
      </div>

      {/* 학생 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{student.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              수험번호 {student.exam_no ?? '-'} · {branch?.name ?? ''} {cls?.name ?? ''}
            </p>
          </div>
        </div>

        {/* 요약 스탯 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            {
              label: '어휘 진도',
              value: `${vocabRate}%`,
              sub: `${totalStudied}/${targetWords}단어`,
              color: 'bg-blue-50 text-blue-700',
            },
            {
              label: '어휘 학습율',
              value: `${totalStudied > 0 ? Math.round((memorized / totalStudied) * 100) : 0}%`,
              sub: `암기 ${memorized}단어`,
              color: 'bg-green-50 text-green-700',
            },
            {
              label: '관련 단어',
              value: `${relatedRate}%`,
              sub: `${studiedAll}/${totalRelated}개`,
              color: 'bg-purple-50 text-purple-700',
            },
            {
              label: '현재 진행 Day',
              value: `Day ${currentDay}`,
              sub: `60일 커리큘럼`,
              color: 'bg-gray-50 text-gray-700',
            },
          ].map((s) => (
            <div key={s.label} className={`${s.color} rounded-xl p-3`}>
              <p className="text-xs opacity-70 mb-1">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs opacity-60 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 어휘 진도 바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">어휘 학습 진도</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>전체 진도</span>
            <span>{totalStudied} / {targetWords}단어 ({vocabRate}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${vocabRate}%` }} />
          </div>
          {/* DAY별 미니 진도 */}
          <div className="flex gap-0.5 mt-3 flex-wrap">
            {relatedDays.map((d) => (
              <div
                key={d.day}
                title={`Day ${d.day}: ${d.vocabDone ? '완료' : '미완료'}`}
                className={`w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-bold ${
                  d.vocabDone ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-300'
                }`}
              >
                {d.day}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">파란 칸 = 해당 Day 50단어 모두 학습 완료</p>
        </div>
      </div>

      {/* 관련 단어 DAY별 상세 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">관련 단어 학습 현황</h2>
          <span className="text-xs text-gray-400">동의어 · 유의어 · 반의어</span>
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
    </div>
  );
}
