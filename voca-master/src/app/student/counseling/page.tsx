import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import StudentCounselingClient from '@/components/student/StudentCounselingClient';

export default async function StudentCounselingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // 학생 프로필
  const { data: profile } = await admin
    .from('profiles')
    .select('class_id')
    .eq('id', user!.id)
    .single();

  // 담당 관리자 (admin_class_assignments 기반, 2단계 조회)
  let adminProfile = null;
  if (profile?.class_id) {
    const { data: assignment } = await admin
      .from('admin_class_assignments')
      .select('admin_id')
      .eq('class_id', profile.class_id)
      .maybeSingle();
    if (assignment?.admin_id) {
      const { data } = await admin
        .from('profiles')
        .select('id, name, role')
        .eq('id', assignment.admin_id)
        .maybeSingle();
      adminProfile = data;
    }
  }

  // 담임 admin_id 조회 → 해당 담임의 활성 슬롯 (이미 예약된 슬롯 제외)
  const today = new Date().toISOString().split('T')[0];

  const [rawSlots, bookedResult] = await Promise.all([
    adminProfile?.id
      ? admin
          .from('counseling_slots')
          .select('*')
          .eq('admin_id', adminProfile.id)
          .eq('is_active', true)
          .gte('slot_date', today)
          .order('slot_date')
          .order('slot_hour')
      : Promise.resolve({ data: [] }),
    admin
      .from('counseling_requests')
      .select('slot_id')
      .in('status', ['scheduled', 'confirmed'])
      .not('slot_id', 'is', null),
  ]);

  const bookedSlotIds = new Set((bookedResult.data ?? []).map((r) => r.slot_id));
  const availableSlots = ((rawSlots as any).data ?? []).filter(
    (s: any) => !bookedSlotIds.has(s.id)
  );

  // 내 상담 신청 이력
  const { data: myRequests } = await admin
    .from('counseling_requests')
    .select(`
      id, source, request_note, status, created_at, slot_id,
      slot:counseling_slots(slot_date, slot_hour)
    `)
    .eq('student_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">상담 신청</h1>

      <StudentCounselingClient
        adminProfile={adminProfile as any}
        availableSlots={availableSlots as any[]}
        myRequests={(myRequests ?? []) as any[]}
        studentId={user!.id}
        adminId={adminProfile?.id ?? null}
      />
    </div>
  );
}
