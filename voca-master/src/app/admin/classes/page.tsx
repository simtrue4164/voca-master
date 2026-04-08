import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ClassTable from '@/components/admin/ClassTable';
import ProgressFilterBar from '@/components/admin/ProgressFilterBar';
import { Suspense } from 'react';

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string; year?: string }>;
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

  // 담당 범위 내 전체 반 (필터 옵션용)
  let allClassQuery = admin
    .from('classes')
    .select('id, name, year, branch_id, branches(id, name)')
    .not('year', 'is', null)
    .order('name');
  if (role === 'admin_branch') allClassQuery = allClassQuery.eq('branch_id', profile!.branch_id!);
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

  // 지점 필터 후 연도 목록
  const branchFiltered = (allClasses ?? []).filter((c: any) => !selectedBranchId || c.branch_id === selectedBranchId);
  const availableYears = [...new Set(branchFiltered.map((c: any) => c.year).filter(Boolean) as number[])].sort((a, b) => a - b);

  // 서버 필터링된 반 조회
  let classQuery = admin
    .from('classes')
    .select('id, name, branch_id, year, is_active, branches(name)')
    .order('name');
  if (role === 'admin_branch') classQuery = classQuery.eq('branch_id', profile!.branch_id!);
  if (selectedBranchId) classQuery = classQuery.eq('branch_id', selectedBranchId);
  if (selectedYear)     classQuery = classQuery.eq('year', selectedYear);
  const { data: classes } = await classQuery;

  const classIdList = (classes ?? []).map((c) => c.id);

  // 담임 목록
  let teacherQuery = admin.from('profiles').select('id, name, branch_id').eq('role', 'admin_class').eq('is_active', true);
  if (role === 'admin_branch') teacherQuery = teacherQuery.eq('branch_id', profile!.branch_id!);
  else if (role === 'admin_class') teacherQuery = teacherQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  const { data: teachers } = await teacherQuery.order('name');

  // 반별 담임 배정
  const { data: assignments } = classIdList.length > 0
    ? await admin.from('admin_class_assignments').select('class_id, admin_id').in('class_id', classIdList)
    : { data: [] };
  const assignmentMap: Record<string, string> = {};
  for (const a of assignments ?? []) assignmentMap[a.class_id] = a.admin_id;

  // 반별 학생 수
  const { data: studentCounts } = await admin.from('profiles').select('class_id').eq('role', 'student');
  const countMap: Record<string, number> = {};
  for (const s of studentCounts ?? []) {
    if (s.class_id) countMap[s.class_id] = (countMap[s.class_id] ?? 0) + 1;
  }

  const rows = (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    branch_id: c.branch_id,
    year: (c as any).year ?? '',
    is_active: (c as any).is_active ?? true,
    student_count: countMap[c.id] ?? 0,
    branch_name: Array.isArray(c.branches) ? (c.branches[0] as any)?.name ?? '-' : (c.branches as any)?.name ?? '-',
    teacher_id: assignmentMap[c.id] ?? null,
  }));

  // 반 추가 폼용 전체 지점 목록
  let branchListQuery = admin.from('branches').select('id, name').order('name');
  if (role === 'admin_branch') branchListQuery = branchListQuery.eq('id', profile!.branch_id!);
  const { data: branchList } = await branchListQuery;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">반 관리</h1>
      <Suspense>
        <ProgressFilterBar
          branches={branches}
          years={availableYears}
          classes={[]}
          selectedBranchId={selectedBranchId}
          selectedYear={selectedYear}
          selectedClassId=""
          showBranch={role !== 'admin_class'}
          hideClass
        />
      </Suspense>
      <ClassTable
        classes={rows}
        branches={branchList ?? []}
        teachers={(teachers ?? []) as { id: string; name: string; branch_id: string | null }[]}
      />
    </div>
  );
}
