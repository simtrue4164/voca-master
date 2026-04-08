'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type AdminActionState = { error: string | null; success: boolean };

export async function createAdmin(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  // 요청자가 admin_super인지 확인
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: requester } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  if (requester?.role !== 'admin_super') {
    return { error: '권한이 없습니다. (admin_super만 관리자 생성 가능)', success: false };
  }

  const name = (formData.get('name') as string)?.trim();
  const employeeNo = (formData.get('employee_no') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  const role = (formData.get('role') as string)?.trim();
  const branchId = (formData.get('branch_id') as string)?.trim() || null;

  if (!name || !employeeNo || !password || !role) {
    return { error: '이름, 사번, 비밀번호, 역할은 필수입니다.', success: false };
  }

  const email = `${employeeNo}@voca-master.internal`;
  if ((role === 'admin_branch' || role === 'admin_class') && !branchId) {
    return { error: '담당 지점을 선택해야 합니다.', success: false };
  }

  const admin = createAdminClient();

  // Auth 유저 생성
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('email address')) {
      return { error: '이미 사용 중인 사번입니다.', success: false };
    }
    return { error: authError.message, success: false };
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: authData.user.id,
    role,
    name,
    employee_no: employeeNo,
    branch_id: branchId,
  }, { onConflict: 'id' });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: profileError.message, success: false };
  }

  revalidatePath('/admin/admins');
  return { error: null, success: true };
}

export async function updateAdmin(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const targetId = (formData.get('id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const role = (formData.get('role') as string)?.trim();
  const branchId = (formData.get('branch_id') as string)?.trim() || null;
  if (role === 'admin_branch' && !branchId) return { error: '지점 관리자는 담당 지점을 선택해야 합니다.', success: false };
  if (role === 'admin_class' && !branchId) return { error: '반 담임은 담당 지점을 선택해야 합니다.', success: false };

  const admin = createAdminClient();

  const { error } = await admin
    .from('profiles')
    .update({
      name,
      role,
      branch_id: role === 'admin_super' ? null : branchId,
    })
    .eq('id', targetId);

  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/admins');
  return { error: null, success: true };
}

export async function deactivateAdmin(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const targetId = (formData.get('id') as string)?.trim();
  if (!targetId) return { error: 'ID가 없습니다.', success: false };

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ is_active: false }).eq('id', targetId);
  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/admins');
  return { error: null, success: true };
}

export async function activateAdmin(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const targetId = (formData.get('id') as string)?.trim();
  if (!targetId) return { error: 'ID가 없습니다.', success: false };

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ is_active: true }).eq('id', targetId);
  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/admins');
  return { error: null, success: true };
}
