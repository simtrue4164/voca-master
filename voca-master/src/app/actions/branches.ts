'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type BranchActionState = { error: string | null; success: boolean };
const fail = (error: string): BranchActionState => ({ error, success: false });
const ok: BranchActionState = { error: null, success: true };

export async function createBranch(
  _prev: BranchActionState,
  formData: FormData
): Promise<BranchActionState> {
  const name = (formData.get('name') as string)?.trim();
  if (!name) return fail('지점명을 입력해주세요.');

  const supabase = await createClient();
  const { error } = await supabase.from('branches').insert({ name });
  if (error) return fail(error.message);

  revalidatePath('/admin/branches');
  return ok;
}

export async function updateBranch(
  _prev: BranchActionState,
  formData: FormData
): Promise<BranchActionState> {
  const id = (formData.get('id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  if (!id || !name) return fail('입력값이 올바르지 않습니다.');

  const supabase = await createClient();
  const { error } = await supabase.from('branches').update({ name }).eq('id', id);
  if (error) return fail(error.message);

  revalidatePath('/admin/branches');
  return ok;
}

export async function deleteBranch(
  _prev: BranchActionState,
  formData: FormData
): Promise<BranchActionState> {
  const id = (formData.get('id') as string)?.trim();
  if (!id) return fail('지점 ID가 없습니다.');

  const supabase = await createClient();

  // 소속 반이 있으면 삭제 불가
  const { count } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', id);

  if ((count ?? 0) > 0) return fail('소속 반이 있는 지점은 삭제할 수 없습니다.');

  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) return fail(error.message);

  revalidatePath('/admin/branches');
  return ok;
}
