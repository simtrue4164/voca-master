import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

// 전체 활성화
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { admin_id, slot_date, hours } = await req.json() as {
    admin_id?: string;
    slot_date: string;
    hours: number[];
  };
  const targetAdminId = admin_id ?? user.id;

  const admin = createAdminClient();
  if (!(await canManageTeacher(admin, user.id, targetAdminId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = hours.map((h) => ({
    admin_id: targetAdminId,
    slot_date,
    slot_hour: h,
    is_active: true,
  }));

  const { error } = await admin
    .from('counseling_slots')
    .upsert(rows, { onConflict: 'admin_id,slot_date,slot_hour' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 전체 비활성화
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { admin_id, slot_date } = await req.json() as { admin_id?: string; slot_date: string };
  const targetAdminId = admin_id ?? user.id;

  const admin = createAdminClient();
  if (!(await canManageTeacher(admin, user.id, targetAdminId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await admin
    .from('counseling_slots')
    .update({ is_active: false })
    .eq('admin_id', targetAdminId)
    .eq('slot_date', slot_date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
