import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import CounselingDetail from '@/components/admin/CounselingDetail';

export default async function CounselingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // 반담임(admin_class)만 접근 허용
  const { data: myProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (myProfile?.role !== 'admin_class') {
    redirect('/admin/counseling');
  }

  const { data: req } = await admin
    .from('counseling_requests')
    .select(`
      id, source, request_note, status, created_at,
      student:profiles!counseling_requests_student_id_fkey(id, name, exam_no, class_id),
      admin:profiles!counseling_requests_admin_id_fkey(id, name),
      slot:counseling_slots(slot_date, slot_hour),
      counseling_recommendations(risk_score, reason, factors)
    `)
    .eq('id', id)
    .single();

  if (!req) notFound();

  // 기존 상담 기록
  const { data: record } = await admin
    .from('counseling_records')
    .select('*')
    .eq('request_id', id)
    .single();

  // 학생 이전 상담 이력
  const { data: history } = await admin
    .from('counseling_records')
    .select(`
      id, content, outcome, created_at,
      counseling_requests!inner(student_id)
    `)
    .eq('counseling_requests.student_id', (req.student as any)?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(5);

  // 활성 슬롯 목록 (담당 담임의 admin_id 기준, 이미 예약된 슬롯 제외)
  const today = new Date().toISOString().split('T')[0];
  const studentClassId = (req.student as any)?.class_id;

  // 학생 반의 담임 admin_id 조회
  let teacherAdminId: string | null = null;
  if (studentClassId) {
    const { data: assignment } = await admin
      .from('admin_class_assignments')
      .select('admin_id')
      .eq('class_id', studentClassId)
      .maybeSingle();
    teacherAdminId = assignment?.admin_id ?? null;
    // fallback: counseling_request의 admin_id
    if (!teacherAdminId) teacherAdminId = (req as any).admin_id ?? null;
  }

  const [{ data: rawSlots }, { data: bookedRequests }] = await Promise.all([
    teacherAdminId
      ? admin
          .from('counseling_slots')
          .select('*')
          .eq('admin_id', teacherAdminId)
          .eq('is_active', true)
          .gte('slot_date', today)
          .order('slot_date')
          .order('slot_hour')
      : Promise.resolve({ data: [] }),
    admin
      .from('counseling_requests')
      .select('slot_id')
      .in('status', ['scheduled', 'confirmed'])
      .neq('id', id)
      .not('slot_id', 'is', null),
  ]);

  const bookedSlotIds = new Set((bookedRequests ?? []).map((r) => r.slot_id));
  const availableSlots = (rawSlots ?? []).filter((s) => !bookedSlotIds.has(s.id));

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Link href="/admin/counseling" className="text-[#6e6e73] hover:text-[#6e6e73] text-sm">
          ← 목록
        </Link>
        <span className="text-[#c7c7cc]">/</span>
        <span className="text-sm text-[#6e6e73]">상담 상세</span>
      </div>

      <CounselingDetail
        request={req as any}
        record={record as any}
        history={(history ?? []) as any[]}
        availableSlots={(availableSlots ?? []) as any[]}
        currentAdminId={user!.id}
      />
    </div>
  );
}
