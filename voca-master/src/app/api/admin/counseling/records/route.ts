import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { request_id, content, outcome } = await req.json();

  const admin = createAdminClient();
  const { error } = await admin.from('counseling_records').insert({
    request_id,
    admin_id: user.id,
    content,
    outcome: outcome || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { record_id, content, outcome } = await req.json();

  const admin = createAdminClient();
  const { error } = await admin
    .from('counseling_records')
    .update({ content, outcome: outcome || null })
    .eq('id', record_id)
    .eq('admin_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
