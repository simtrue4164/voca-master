import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { Suspense } from 'react';
import ProgressFilterBar from '@/components/admin/ProgressFilterBar';

export default async function AdminProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string; year?: string; class_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user!.id)
    .single();

  const role = profile?.role ?? '';

  // ── 담당 범위 내 전체 반 조회 (필터 옵션용) ──────────────
  let allClassQuery = admin
    .from('classes')
    .select('id, name, year, branch_id, branches(id, name)')
    .not('year', 'is', null)
    .eq('is_active', true)
    .order('name');

  if (role === 'admin_branch') {
    allClassQuery = allClassQuery.eq('branch_id', profile!.branch_id!);
  } else if (role === 'admin_class') {
    const { data: assignments } = await admin
      .from('admin_class_assignments').select('class_id').eq('admin_id', user!.id);
    const ids = (assignments ?? []).map((a) => a.class_id);
    if (ids.length > 0) allClassQuery = allClassQuery.in('id', ids);
    else allClassQuery = allClassQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data: allClasses } = await allClassQuery;

  // 지점 목록 (중복 제거)
  const branchMap: Record<string, string> = {};
  for (const c of allClasses ?? []) {
    const b = (c as any).branches;
    if (b?.id) branchMap[b.id] = b.name;
  }
  const branches = Object.entries(branchMap)
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── 검색 파라미터 파싱 ────────────────────────────────────
  const selectedBranchId = params.branch_id ?? (role === 'admin_branch' ? profile!.branch_id! : '');
  const selectedYear     = params.year ? parseInt(params.year) : null;
  const selectedClassId  = params.class_id ?? '';

  // 지점 필터 적용 후 연도 목록
  const branchFilteredClasses = (allClasses ?? []).filter((c: any) =>
    !selectedBranchId || c.branch_id === selectedBranchId
  );
  const availableYears = [...new Set(
    branchFilteredClasses.map((c: any) => c.year).filter(Boolean) as number[]
  )].sort((a, b) => a - b);

  // 지점+연도 필터 적용 후 반 목록
  const yearFilteredClasses = branchFilteredClasses.filter((c: any) =>
    !selectedYear || Number(c.year) === selectedYear
  );
  const classOptions = yearFilteredClasses.map((c: any) => ({ id: c.id, name: c.name }));

  // 최종 필터링된 class_id 목록
  const filteredClassIds = selectedClassId
    ? [selectedClassId]
    : yearFilteredClasses.map((c: any) => c.id);

  // ── 학생 조회 ─────────────────────────────────────────────
  const { data: students } = filteredClassIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, name, exam_no, class_id')
        .eq('role', 'student')
        .in('class_id', filteredClassIds)
        .eq('is_active', true)
        .order('exam_no')
    : { data: [] };

  const studentIds = (students ?? []).map((s) => s.id);

  // ── 어휘 / 관련 단어 전체 수 ─────────────────────────────
  const [
    { count: totalVocab },
    { count: totalSynCount },
    { count: totalSimCount },
    { count: totalAntCount },
  ] = await Promise.all([
    admin.from('vocabulary').select('id', { count: 'exact', head: true }),
    admin.from('word_synonyms').select('id', { count: 'exact', head: true }),
    admin.from('word_similar').select('id', { count: 'exact', head: true }),
    admin.from('word_antonyms').select('id', { count: 'exact', head: true }),
  ]);
  const totalVocabCount = totalVocab ?? 0;
  const totalRelated    = (totalSynCount ?? 0) + (totalSimCount ?? 0) + (totalAntCount ?? 0);

  // ── 학생별 학습 집계 ─────────────────────────────────────
  const [{ data: learningLogs }, { data: relatedLogsAll }] = studentIds.length > 0
    ? await Promise.all([
        admin.from('learning_logs').select('student_id, reviewed_at').in('student_id', studentIds),
        admin.from('related_word_logs').select('student_id, reviewed_at').in('student_id', studentIds),
      ])
    : [{ data: [] }, { data: [] }];

  const vocabCountMap: Record<string, number> = {};
  const lastVocabDate: Record<string, string> = {};
  for (const l of learningLogs ?? []) {
    vocabCountMap[l.student_id] = (vocabCountMap[l.student_id] ?? 0) + 1;
    const d = l.reviewed_at?.slice(0, 10) ?? '';
    if (!lastVocabDate[l.student_id] || d > lastVocabDate[l.student_id]) lastVocabDate[l.student_id] = d;
  }

  const relatedCountMap: Record<string, number> = {};
  const lastRelatedDate: Record<string, string> = {};
  for (const l of relatedLogsAll ?? []) {
    relatedCountMap[l.student_id] = (relatedCountMap[l.student_id] ?? 0) + 1;
    const d = l.reviewed_at?.slice(0, 10) ?? '';
    if (!lastRelatedDate[l.student_id] || d > lastRelatedDate[l.student_id]) lastRelatedDate[l.student_id] = d;
  }

  const classNameMap: Record<string, string> = Object.fromEntries(
    (allClasses ?? []).map((c: any) => [c.id, c.name])
  );

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  const rows = (students ?? []).map((s) => {
    const vStudied  = vocabCountMap[s.id]   ?? 0;
    const rStudied  = relatedCountMap[s.id] ?? 0;
    const vRate     = totalVocabCount > 0 ? Math.round((vStudied / totalVocabCount) * 100) : 0;
    const rRate     = totalRelated    > 0 ? Math.round((rStudied / totalRelated)    * 100) : 0;
    const lastDate  = lastVocabDate[s.id] ?? lastRelatedDate[s.id] ?? null;
    const daysSince = lastDate
      ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000)
      : null;
    const risk = daysSince === null ? 'none'
      : daysSince >= 3 ? 'danger'
      : daysSince >= 1 ? 'warning'
      : 'ok';
    return { ...s, vStudied, rStudied, vRate, rRate, lastDate, daysSince, risk,
      className: classNameMap[s.class_id ?? ''] ?? '-' };
  });

  // 반별 요약
  const displayClasses = selectedClassId
    ? yearFilteredClasses.filter((c: any) => c.id === selectedClassId)
    : yearFilteredClasses;

  const classStats = displayClasses.map((c: any) => {
    const classRows = rows.filter((r) => r.class_id === c.id);
    const avgVocab   = classRows.length > 0 ? Math.round(classRows.reduce((a, r) => a + r.vRate, 0) / classRows.length) : 0;
    const avgRelated = classRows.length > 0 ? Math.round(classRows.reduce((a, r) => a + r.rRate, 0) / classRows.length) : 0;
    const atRisk = classRows.filter((r) => r.risk === 'danger').length;
    return { id: c.id, name: c.name, avgVocab, avgRelated, atRisk, count: classRows.length };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">학습 진도 관리</h1>
        <p className="text-sm text-gray-500 mt-1">어휘 및 관련 단어 학습 현황</p>
      </div>

      {/* 검색 필터 */}
      <Suspense>
        <ProgressFilterBar
          branches={branches}
          years={availableYears}
          classes={classOptions}
          selectedBranchId={selectedBranchId}
          selectedYear={selectedYear}
          selectedClassId={selectedClassId}
          showBranch={role !== 'admin_class'}
        />
      </Suspense>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">
          {filteredClassIds.length === 0 ? '조건에 맞는 반이 없습니다.' : '등록된 학생이 없습니다.'}
        </p>
      ) : (
        <>
          {/* 반별 요약 카드 */}
          {classStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {classStats.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-800">{c.name}</h2>
                    <div className="flex items-center gap-2">
                      {c.atRisk > 0 && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          위험 {c.atRisk}명
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{c.count}명</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>어휘 평균</span><span>{c.avgVocab}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${c.avgVocab}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>관련 단어 평균</span><span>{c.avgRelated}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${c.avgRelated}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 학생 진도 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">
                학생별 학습 진도
                <span className="ml-2 text-xs font-normal text-gray-400">{rows.length}명</span>
              </h2>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />오늘</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />1~2일 전</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />3일+ 미학습</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">학생</th>
                    <th className="text-left px-3 py-3 text-gray-600 font-medium">반</th>
                    <th className="text-left px-3 py-3 text-gray-600 font-medium w-36">어휘 진도</th>
                    <th className="text-left px-3 py-3 text-gray-600 font-medium w-36">관련 단어</th>
                    <th className="text-left px-3 py-3 text-gray-600 font-medium">최근 학습</th>
                    <th className="px-3 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            r.risk === 'ok'      ? 'bg-green-500' :
                            r.risk === 'warning' ? 'bg-yellow-400' :
                            r.risk === 'danger'  ? 'bg-red-400' : 'bg-gray-200'
                          }`} />
                          <div>
                            <p className="font-medium text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.exam_no}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{r.className}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${r.vRate}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{r.vRate}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{r.vStudied}/{totalVocabCount}단어</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${r.rRate}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{r.rRate}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{r.rStudied}/{totalRelated}개</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.daysSince === null ? '-'
                          : r.daysSince === 0 ? '오늘'
                          : r.daysSince === 1 ? '어제'
                          : `${r.daysSince}일 전`}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/progress/${r.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          상세
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
