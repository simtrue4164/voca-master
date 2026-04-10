import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import AdminNav from '@/components/admin/AdminNav';
import { logout } from '@/app/actions/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role, name, is_active')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  if (profile.role === 'student') redirect('/student/dashboard');
  if (!profile.is_active) redirect('/login');

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="bg-white/80 backdrop-blur-xl border-b border-[#e5e5ea] px-5 py-3 flex items-center justify-between sticky top-0 z-40">
        <span className="text-[15px] font-semibold text-[#1d1d1f]">Voca-Master</span>
        <form action={logout}>
          <button type="submit" className="text-[13px] text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
            로그아웃
          </button>
        </form>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-6 flex gap-5">
        <AdminNav role={profile.role} name={profile.name} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
