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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">관리자 관리</h1>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-[13px] font-semibold text-[#1d1d1f] mb-4">관리자 추가</h2>
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
