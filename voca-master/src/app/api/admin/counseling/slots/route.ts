import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// 해당 담임(targetAdminId)의 슬롯을 관리할 권한 확인
async function canManageTeacher(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  targetAdminId: string
): Promise<boolean> {
  if (userId === targetAdminId) return true;
  const { data: profile } = await admin
    .from('profiles')
    .select('role, branch_id')
    .eq('id', userId)
    .single();
  if (!profile) return false;
  if (profile.role === 'admin_super') return true;
  if (profile.role === 'admin_branch') {
    const { data: target } = await admin
      .from('profiles')
      .select('branch_id')
      .eq('id', targetAdminId)
      .single();
    return target?.branch_id === profile.branch_id;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { admin_id, slot_date, slot_hour } = await req.json();
  const targetAdminId: string = admin_id ?? user.id;

  const admin = createAdminClient();
  if (!(await canManageTeacher(admin, user.id, targetAdminId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await admin.from('counseling_slots').upsert({
    admin_id: targetAdminId,
    slot_date,
    slot_hour,
    is_active: true,
  }, { onConflict: 'admin_id,slot_date,slot_hour' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, is_active } = await req.json();
  const admin = createAdminClient();

  const { data: slot } = await admin
    .from('counseling_slots')
    .select('admin_id')
    .eq('id', id)
    .single();

  if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!(await canManageTeacher(admin, user.id, slot.admin_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await admin
    .from('counseling_slots')
    .update({ is_active })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
