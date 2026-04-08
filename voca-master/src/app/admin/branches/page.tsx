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
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">지점 관리</h1>
      <BranchTable branches={rows} />
    </div>
  );
}
