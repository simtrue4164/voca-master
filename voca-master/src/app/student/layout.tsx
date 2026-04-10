import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import BottomNav from '@/components/student/BottomNav';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // service_role로 조회 → RLS 우회
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  if (profile.role !== 'student') redirect('/admin/dashboard');

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-16">
      {children}
      <BottomNav />
    </div>
  );
}
