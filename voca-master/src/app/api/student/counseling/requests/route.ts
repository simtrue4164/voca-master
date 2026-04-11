import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { student_id, admin_id, slot_id, request_note } = await req.json();

  // 본인 확인
  if (student_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // admin_id가 학생의 담당 관리자인지 확인
  const { data: profile } = await admin
    .from('profiles')
    .select('class_id')
    .eq('id', student_id)
    .single();

  if (profile?.class_id) {
    const { data: assignment } = await admin
      .from('admin_class_assignments')
      .select('admin_id')
      .eq('class_id', profile.class_id)
      .maybeSingle();

    if (assignment && assignment.admin_id !== admin_id) {
      return NextResponse.json({ error: '담당 관리자가 아닙니다.' }, { status: 403 });
    }
  }

  // 중복 신청 방지 (pending/scheduled 상태인 기존 요청 확인)
  const { data: existing } = await admin
    .from('counseling_requests')
    .select('id')
    .eq('student_id', student_id)
    .eq('admin_id', admin_id)
    .in('status', ['pending', 'scheduled'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: '이미 진행 중인 상담 신청이 있습니다.' }, { status: 409 });
  }

  const { error } = await admin.from('counseling_requests').insert({
    student_id,
    admin_id,
    source: 'student',
    slot_id: slot_id || null,
    request_note: request_note || null,
    status: slot_id ? 'scheduled' : 'pending',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
