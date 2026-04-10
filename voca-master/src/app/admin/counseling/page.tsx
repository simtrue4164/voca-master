import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import CounselingTabs from '@/components/admin/CounselingTabs';
import { getAdminYear } from '@/lib/adminYear';

export default async function AdminCounselingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === 'slots' ? 'slots' : 'requests';
  const statusFilter = params.status ?? 'all';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, branch_id, class_id')
    .eq('id', user!.id)
    .single();

  const selectedYear = await getAdminYear();

  // 역할별 접근 가능한 반 목록 (연도 필터 포함)
  let classQuery = admin.from('classes').select('id, name').eq('year', selectedYear);
  if (profile?.role === 'admin_class') {
    classQuery = classQuery.eq('id', profile.class_id!);
  } else if (profile?.role === 'admin_branch') {
    classQuery = classQuery.eq('branch_id', profile.branch_id!);
  }
  // admin_super: 필터 없음 (전체)
  const { data: classes } = await classQuery.order('name');

  // 반담임 목록 (admin_class 프로필)
  const classIds = (classes ?? []).map((c) => c.id);
  const { data: teacherProfiles } = classIds.length > 0
    ? await admin
        .from('profiles')
        .select('id, name, class_id')
        .eq('role', 'admin_class')
        .in('class_id', classIds)
    : { data: [] };

  const classTeachers = (classes ?? []).map((c) => {
    const teacher = (teacherProfiles ?? []).find((t) => t.class_id === c.id);
    return {
      id: teacher?.id ?? `no-teacher-${c.id}`,
      name: teacher?.name ?? null,
      class_id: c.id,
      class_name: c.name,
    };
  });

  // 상담 신청 목록 (역할별 필터)
  let requestQuery = admin
    .from('counseling_requests')
    .select(`
      id, source, request_note, status, created_at,
      student:profiles!counseling_requests_student_id_fkey(id, name, exam_no, class_id),
      slot:counseling_slots(slot_date, slot_hour),
      counseling_recommendations(risk_score, reason)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    requestQuery = requestQuery.eq('status', statusFilter);
  }

  if (profile?.role === 'admin_class') {
    // admin_id 기준 + 담임이 배정된 반의 학생 기준 둘 다 포함
    const { data: myAssignments } = await admin
      .from('admin_class_assignments')
      .select('class_id')
      .eq('admin_id', user!.id);
    const myClassIds = (myAssignments ?? []).map((a) => a.class_id);

    if (myClassIds.length > 0) {
      const { data: myStudents } = await admin
        .from('profiles')
        .select('id')
        .in('class_id', myClassIds)
        .eq('role', 'student');
      const studentIdList = (myStudents ?? []).map((s) => s.id);
      // admin_id 일치 OR 소속 학생의 요청
      requestQuery = studentIdList.length > 0
        ? requestQuery.or(`admin_id.eq.${user!.id},student_id.in.(${studentIdList.join(',')})`)
        : requestQuery.eq('admin_id', user!.id);
    } else {
      requestQuery = requestQuery.eq('admin_id', user!.id);
    }
  } else if (profile?.role === 'admin_branch') {
    if (classIds.length > 0) {
      const { data: studentIds } = await admin
        .from('profiles')
        .select('id')
        .in('class_id', classIds)
        .eq('role', 'student');
      requestQuery = requestQuery.in('student_id', (studentIds ?? []).map((s) => s.id));
    }
  }

  const { data: requests } = await requestQuery;

  // 담당 범위 내 담임 admin_id 목록 조회 → 슬롯 조회 기준
  const today = new Date().toISOString().split('T')[0];

  let teacherIds: string[] = [];
  if (profile?.role === 'admin_class') {
    teacherIds = [user!.id];
  } else if (classIds.length > 0) {
    const { data: assignments } = await admin
      .from('admin_class_assignments')
      .select('admin_id')
      .in('class_id', classIds);
    teacherIds = [...new Set((assignments ?? []).map((a) => a.admin_id))];
  }

  let slotsQuery = admin
    .from('counseling_slots')
    .select('*')
    .gte('slot_date', today)
    .order('slot_date')
    .order('slot_hour');

  if (teacherIds.length > 0) {
    slotsQuery = slotsQuery.in('admin_id', teacherIds);
  } else if (profile?.role !== 'admin_super') {
    slotsQuery = slotsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data: slots } = await slotsQuery;

  // 상담 요청 통계 - 상태 필터 무관하게 전체 건수 별도 조회
  let statsQuery = admin
    .from('counseling_requests')
    .select('status');

  if (profile?.role === 'admin_class') {
    const { data: myAssignments2 } = await admin
      .from('admin_class_assignments')
      .select('class_id')
      .eq('admin_id', user!.id);
    const myClassIds2 = (myAssignments2 ?? []).map((a) => a.class_id);
    if (myClassIds2.length > 0) {
      const { data: myStudents2 } = await admin
        .from('profiles').select('id').in('class_id', myClassIds2).eq('role', 'student');
      const ids2 = (myStudents2 ?? []).map((s) => s.id);
      statsQuery = ids2.length > 0
        ? statsQuery.or(`admin_id.eq.${user!.id},student_id.in.(${ids2.join(',')})`)
        : statsQuery.eq('admin_id', user!.id);
    } else {
      statsQuery = statsQuery.eq('admin_id', user!.id);
    }
  } else if (profile?.role === 'admin_branch') {
    if (classIds.length > 0) {
      const { data: branchStudents } = await admin
        .from('profiles').select('id').in('class_id', classIds).eq('role', 'student');
      statsQuery = statsQuery.in('student_id', (branchStudents ?? []).map((s) => s.id));
    }
  }

  const { data: allStatusRows } = await statsQuery;
  const statsBase = allStatusRows ?? [];
  const stats = {
    scheduled: statsBase.filter((r) => r.status === 'scheduled').length,
    confirmed: statsBase.filter((r) => r.status === 'confirmed').length,
    completed: statsBase.filter((r) => r.status === 'completed').length,
    cancelled: statsBase.filter((r) => r.status === 'cancelled' || r.status === 'dismissed').length,
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">상담 관리</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">AI 추천 및 학생 신청 상담 관리</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: '예약', value: stats.scheduled, color: 'bg-blue-50 text-blue-700' },
          { label: '확정', value: stats.confirmed, color: 'bg-indigo-50 text-indigo-700' },
          { label: '완료', value: stats.completed, color: 'bg-green-50 text-green-700' },
          { label: '취소', value: stats.cancelled, color: 'bg-gray-100 text-gray-500' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
            <p className="text-xs font-medium opacity-70">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <CounselingTabs
        tab={tab}
        statusFilter={statusFilter}
        requests={(requests ?? []) as any[]}
        slots={(slots ?? []) as any[]}
        classes={(classes ?? []) as { id: string; name: string }[]}
        classTeachers={classTeachers}
        role={profile?.role ?? ''}
        adminId={user!.id}
      />
    </div>
  );
}
