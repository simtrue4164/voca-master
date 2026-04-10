import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import CreateExamForm from '@/components/admin/CreateExamForm';
import ExamStatusButton from '@/components/admin/ExamStatusButton';
import ExamQRButton from '@/components/admin/ExamQRButton';
import ProgressFilterBar from '@/components/admin/ProgressFilterBar';
import Link from 'next/link';
import { Suspense } from 'react';

export default async function AdminExamsPage({
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
    .select('role, branch_id, class_id')
    .eq('id', user!.id)
    .single();

  const role = profile?.role ?? '';

  // admin_class 담당 반 조회
  let managedClassIds: string[] = [];
  if (role === 'admin_class') {
    const { data: assignments } = await admin
      .from('admin_class_assignments')
      .select('class_id')
      .eq('admin_id', user!.id);
    managedClassIds = (assignments ?? []).map((a) => a.class_id);
    if (managedClassIds.length === 0 && profile?.class_id) {
      managedClassIds = [profile.class_id];
    }
  }

  // 담당 범위 내 전체 반 (필터 옵션용)
  let allClassQuery = admin
    .from('classes')
    .select('id, name, year, branch_id, branches(id, name)')
    .not('year', 'is', null)
    .eq('is_active', true)
    .order('name');
  if (role === 'admin_branch') allClassQuery = allClassQuery.eq('branch_id', profile!.branch_id!);
  else if (role === 'admin_class') {
    if (managedClassIds.length > 0) allClassQuery = allClassQuery.in('id', managedClassIds);
    else allClassQuery = allClassQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  const { data: allClasses } = await allClassQuery;

  // 지점 목록
  const branchMap: Record<string, string> = {};
  for (const c of allClasses ?? []) {
    const b = (c as any).branches;
    if (b?.id) branchMap[b.id] = b.name;
  }
  const branches = Object.entries(branchMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  // 검색 파라미터
  const selectedBranchId = params.branch_id ?? (role === 'admin_branch' ? profile!.branch_id! : '');
  const selectedYear     = params.year ? parseInt(params.year) : null;
  const selectedClassId  = params.class_id ?? '';

  // 지점 필터 후 연도 목록
  const branchFiltered = (allClasses ?? []).filter((c: any) => !selectedBranchId || c.branch_id === selectedBranchId);
  const availableYears = [...new Set(branchFiltered.map((c: any) => c.year).filter(Boolean) as number[])].sort((a, b) => a - b);

  // 지점+연도 필터 후 반 목록
  const yearFiltered = branchFiltered.filter((c: any) => !selectedYear || Number(c.year) === selectedYear);
  const classOptions = yearFiltered.map((c: any) => ({ id: c.id, name: c.name }));

  // 최종 class_id 목록
  const filteredClassIds = selectedClassId
    ? [selectedClassId]
    : yearFiltered.map((c: any) => c.id);

  const effectiveClassIds = role === 'admin_class'
    ? filteredClassIds.filter((id) => managedClassIds.includes(id))
    : filteredClassIds;

  const { data: exams } = effectiveClassIds.length > 0
    ? await admin
        .from('exams')
        .select('id, title, day_1, day_2, starts_at, ends_at, status, class_id, classes(name)')
        .in('class_id', effectiveClassIds)
        .order('starts_at', { ascending: false })
    : { data: [] };

  const statusLabel: Record<string, string> = { scheduled: '예정', active: '진행중', closed: '종료' };
  const statusColor: Record<string, string> = {
    scheduled: 'bg-[#f5f5f7] text-[#6e6e73]',
    active: 'bg-[#1d1d1f] text-white',
    closed: 'bg-[#f5f5f7] text-[#c7c7cc]',
  };

  // 시험 출제 폼용 반 목록 (전체 담당 범위)
  const allClassOptions = (allClasses ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">시험 관리</h1>

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

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-[13px] font-semibold text-[#1d1d1f] mb-4">시험 출제</h2>
        <CreateExamForm classes={allClassOptions} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">시험명</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">반</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">범위</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">시작</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f7]">
            {(!exams || exams.length === 0) && (
              <tr><td colSpan={6} className="text-center py-8 text-[#6e6e73]">출제된 시험이 없습니다</td></tr>
            )}
            {exams?.map((exam) => (
              <tr key={exam.id} className="hover:bg-[#f5f5f7] transition-colors">
                <td className="px-4 py-3 font-medium text-[#1d1d1f]">
                  <Link href={`/admin/exams/${exam.id}`} className="hover:text-[#0071e3] transition-colors">
                    {exam.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#6e6e73]">
                  {Array.isArray(exam.classes) ? (exam.classes[0] as any)?.name : (exam.classes as any)?.name}
                </td>
                <td className="px-4 py-3 text-gray-500">Day {exam.day_1} + {exam.day_2}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(exam.starts_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[exam.status]}`}>
                    {statusLabel[exam.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 justify-end">
                    {exam.status !== 'closed' && (
                      <ExamQRButton examId={exam.id} examTitle={exam.title} />
                    )}
                    <ExamStatusButton examId={exam.id} currentStatus={exam.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
