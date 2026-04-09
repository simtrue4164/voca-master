import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import CreateStudentForm from '@/components/admin/CreateStudentForm';
import StudentTable from '@/components/admin/StudentTable';
import ProgressFilterBar from '@/components/admin/ProgressFilterBar';
import { Suspense } from 'react';

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string; year?: string; class_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: adminProfile } = await admin
    .from('profiles')
    .select('role, branch_id, class_id')
    .eq('id', user!.id)
    .single();

  const role = adminProfile?.role ?? '';

  // admin_class는 여러 반을 담당할 수 있으므로 admin_class_assignments 조회
  let managedClassIds: string[] = [];
  if (role === 'admin_class') {
    const { data: assignments } = await admin
      .from('admin_class_assignments')
      .select('class_id')
      .eq('admin_id', user!.id);
    managedClassIds = (assignments ?? []).map((a) => a.class_id);
    if (managedClassIds.length === 0 && adminProfile?.class_id) {
      managedClassIds = [adminProfile.class_id];
    }
  }

  // 담당 범위 내 전체 반 (필터 옵션용)
  let allClassQuery = admin
    .from('classes')
    .select('id, name, year, branch_id, branches(id, name)')
    .not('year', 'is', null)
    .eq('is_active', true)
    .order('name');
  if (role === 'admin_branch') allClassQuery = allClassQuery.eq('branch_id', adminProfile!.branch_id!);
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
  const selectedBranchId = params.branch_id ?? (role === 'admin_branch' ? adminProfile!.branch_id! : '');
  const selectedYear     = params.year ? parseInt(params.year) : null;
  const selectedClassId  = params.class_id ?? '';

  // 지점 필터 후 연도 목록
  const branchFiltered = (allClasses ?? []).filter((c: any) => !selectedBranchId || c.branch_id === selectedBranchId);
  const availableYears = [...new Set(branchFiltered.map((c: any) => c.year).filter(Boolean) as number[])].sort((a, b) => a - b);

  // 지점+연도 필터 후 반 목록
  const yearFiltered = branchFiltered.filter((c: any) => !selectedYear || Number(c.year) === selectedYear);
  const classOptions = yearFiltered.map((c: any) => ({ id: c.id, name: c.name }));

  // 최종 필터링된 class_id 목록
  const filteredClassIds = selectedClassId
    ? [selectedClassId]
    : yearFiltered.map((c: any) => c.id);

  // admin_class인 경우 filteredClassIds를 managedClassIds와 교집합
  const effectiveClassIds = role === 'admin_class'
    ? filteredClassIds.filter((id) => managedClassIds.includes(id))
    : filteredClassIds;

  // allowedStudentIds 계산
  let allowedStudentIds: string[] | null = null;
  if (role === 'admin_branch' || role === 'admin_class') {
    if (effectiveClassIds.length > 0) {
      const [{ data: memberRows }, { data: profileRows }] = await Promise.all([
        admin.from('student_class_memberships').select('student_id').in('class_id', effectiveClassIds),
        admin.from('profiles').select('id').eq('role', 'student').in('class_id', effectiveClassIds),
      ]);
      const ids = new Set([
        ...(memberRows ?? []).map((m) => m.student_id),
        ...(profileRows ?? []).map((p) => p.id),
      ]);
      allowedStudentIds = [...ids];
    } else {
      allowedStudentIds = [];
    }
  } else if (selectedClassId || selectedYear || selectedBranchId) {
    // admin_super with filters applied
    if (effectiveClassIds.length > 0) {
      const [{ data: memberRows }, { data: profileRows }] = await Promise.all([
        admin.from('student_class_memberships').select('student_id').in('class_id', effectiveClassIds),
        admin.from('profiles').select('id').eq('role', 'student').in('class_id', effectiveClassIds),
      ]);
      const ids = new Set([
        ...(memberRows ?? []).map((m) => m.student_id),
        ...(profileRows ?? []).map((p) => p.id),
      ]);
      allowedStudentIds = [...ids];
    } else if (effectiveClassIds.length === 0 && (selectedClassId || selectedYear || selectedBranchId)) {
      allowedStudentIds = [];
    }
  }

  let studentQuery = admin
    .from('profiles')
    .select('id, name, exam_no, class_id, is_active')
    .eq('role', 'student')
    .order('exam_no');

  if (allowedStudentIds !== null) {
    if (allowedStudentIds.length > 0) {
      studentQuery = studentQuery.in('id', allowedStudentIds);
    } else {
      studentQuery = studentQuery.eq('id', 'none');
    }
  }

  const { data: students } = await studentQuery;

  // 반 목록 (반 이름 매핑용: 필터된 반 + 전체 범위 반)
  const classNameMap: Record<string, string> = Object.fromEntries(
    (allClasses ?? []).map((c: any) => [c.id, c.name])
  );

  // 올해 전체 반 배정 조회
  const studentIds = (students ?? []).map((s) => s.id);
  const thisYear = new Date().getFullYear().toString();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const { data: memberships } = studentIds.length > 0
    ? await admin
        .from('student_class_memberships')
        .select('student_id, class_id, year_month')
        .in('student_id', studentIds)
        .gte('year_month', `${thisYear}-01`)
        .lte('year_month', `${thisYear}-12`)
    : { data: [] };

  const membershipMap: Record<string, string[]> = {};
  const yearMembershipMap: Record<string, Record<string, string[]>> = {};

  for (const m of memberships ?? []) {
    if (!yearMembershipMap[m.student_id]) yearMembershipMap[m.student_id] = {};
    if (!yearMembershipMap[m.student_id][m.year_month]) yearMembershipMap[m.student_id][m.year_month] = [];
    yearMembershipMap[m.student_id][m.year_month].push(m.class_id);
    if (m.year_month === thisMonth) {
      if (!membershipMap[m.student_id]) membershipMap[m.student_id] = [];
      membershipMap[m.student_id].push(m.class_id);
    }
  }

  const studentRows = (students ?? []).map((s) => {
    const classIds = membershipMap[s.id] ?? (s.class_id ? [s.class_id] : []);
    return {
      id: s.id,
      name: s.name,
      exam_no: s.exam_no,
      class_id: classIds[0] ?? null,
      class_ids: classIds,
      class_names: classIds.map((cid) => classNameMap[cid]).filter(Boolean) as string[],
      is_active: s.is_active,
      yearMemberships: yearMembershipMap[s.id] ?? {},
    };
  });

  // 반 추가 폼용 전체 반 (필터된 연도 기준)
  const allClassOptions = (allClasses ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    branches: c.branches
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">학생 관리</h1>
        <span className="text-sm text-gray-500">총 {studentRows.length}명</span>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">학생 추가</h2>
        <CreateStudentForm classes={allClassOptions} />
      </div>

      <StudentTable students={studentRows} classes={allClassOptions} />
    </div>
  );
}
