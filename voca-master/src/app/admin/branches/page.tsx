import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import BranchTable from '@/components/admin/BranchTable';

export default async function AdminBranchesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (profile?.role !== 'admin_super') redirect('/admin/dashboard');

  const { data: branches } = await admin
    .from('branches')
    .select('id, name, classes(id)')
    .order('name');

  const rows = (branches ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    class_count: (b.classes as any[]).length,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">지점 관리</h1>
      <BranchTable branches={rows} />
    </div>
  );
}
