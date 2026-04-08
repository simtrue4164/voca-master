import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // 본인 요청인지 + 수정 가능 상태인지 확인
  const { data: existing } = await admin
    .from('counseling_requests')
    .select('student_id, status')
    .eq('id', id)
    .single();

  if (!existing) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  if (existing.student_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['scheduled', 'pending'].includes(existing.status)) {
    return NextResponse.json({ error: '수정할 수 없는 상태입니다.' }, { status: 400 });
  }

  const body = await req.json();
  const update: Record<string, any> = {};

  if (body.status === 'cancelled') {
    update.status = 'cancelled';
    update.slot_id = null;
  } else {
    if (body.slot_id !== undefined) update.slot_id = body.slot_id;
    if (body.request_note !== undefined) update.request_note = body.request_note;
  }

  const { error } = await admin.from('counseling_requests').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
