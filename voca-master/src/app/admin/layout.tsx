import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import AdminNav from '@/components/admin/AdminNav';
import YearSelector from '@/components/admin/YearSelector';
import { logout } from '@/app/actions/auth';
import { getAdminYear } from '@/lib/adminYear';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // service_role로 조회 → RLS 우회, 항상 정확한 profile 반환
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, name, branch_id, is_active')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  if (profile.role === 'student') redirect('/student/dashboard');
  if (!profile.is_active) redirect('/login');

  // 연도 목록 조회 (담당 범위 기준)
  let yearQuery = admin.from('classes').select('year').not('year', 'is', null);
  if (profile.role === 'admin_branch') {
    yearQuery = yearQuery.eq('branch_id', (profile as any).branch_id);
  } else if (profile.role === 'admin_class') {
    const { data: assignments } = await admin
      .from('admin_class_assignments')
      .select('class_id')
      .eq('admin_id', user.id);
    const classIds = (assignments ?? []).map((a) => a.class_id);
    if (classIds.length > 0) yearQuery = yearQuery.in('id', classIds);
  }
  const { data: yearRows } = await yearQuery;
  const availableYears = [...new Set((yearRows ?? []).map((r: any) => r.year).filter(Boolean) as number[])]
    .sort((a, b) => b - a);

  const currentYear = await getAdminYear();
  const selectedYear = availableYears.includes(currentYear)
    ? currentYear
    : (availableYears[0] ?? new Date().getFullYear());

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-gray-900">Voca-Master 관리자</span>
        <div className="flex items-center gap-3">
          {availableYears.length > 0 && (
            <YearSelector years={availableYears} currentYear={selectedYear} />
          )}
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        <AdminNav role={profile.role} name={profile.name} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
