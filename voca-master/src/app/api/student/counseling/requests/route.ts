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
