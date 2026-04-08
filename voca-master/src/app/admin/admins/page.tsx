import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import CreateAdminForm from '@/components/admin/CreateAdminForm';
import AdminTable from '@/components/admin/AdminTable';

export default async function AdminAdminsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: me } = await admin.from('profiles').select('role').eq('id', user!.id).single();
  if (me?.role !== 'admin_super') redirect('/admin/dashboard');

  const { data: branches } = await admin.from('branches').select('id, name').order('name');
  const { data: admins } = await admin
    .from('profiles')
    .select('id, name, role, branch_id, class_id, is_active, employee_no, branches(name)')
    .neq('role', 'student')
    .order('role');

  const rows = (admins ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    branch_id: a.branch_id,
    class_id: null,
    is_active: a.is_active,
    employee_no: (a as any).employee_no ?? null,
    branch_name: Array.isArray(a.branches) ? (a.branches[0] as any)?.name ?? null : (a.branches as any)?.name ?? null,
    class_ids: [],
    class_names: [],
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">관리자 관리</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">관리자 추가</h2>
        <CreateAdminForm branches={branches ?? []} />
      </div>

      <AdminTable
        admins={rows}
        branches={branches ?? []}
        currentUserId={user!.id}
      />
    </div>
  );
}
