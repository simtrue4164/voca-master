import { createAdminClient } from '@/lib/supabase/admin';

// 해당 담임(targetAdminId)의 슬롯을 관리할 권한 확인
export async function canManageTeacher(
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
