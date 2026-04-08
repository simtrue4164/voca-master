'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ClassActionState = { error: string | null; success: boolean };
const fail = (error: string): ClassActionState => ({ error, success: false });
const ok: ClassActionState = { error: null, success: true };

export async function createClass(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const name = (formData.get('name') as string)?.trim();
  const branchId = (formData.get('branch_id') as string)?.trim();
  const year = (formData.get('year') as string)?.trim();
  const isActive = formData.get('is_active') === 'true';

  if (!name || !branchId || !year) return fail('반 이름, 지점, 학년도를 입력해주세요.');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { error } = await admin.from('classes').insert({
    name,
    branch_id: branchId,
    year,
    is_active: isActive,
  });
  if (error) return fail(error.message);

  revalidatePath('/admin/classes');
  return ok;
}

export async function updateClass(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const id = (formData.get('id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const year = (formData.get('year') as string)?.trim();
  const isActive = formData.get('is_active') === 'true';

  if (!id || !name) return fail('입력값이 올바르지 않습니다.');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { error } = await admin.from('classes').update({ name, year, is_active: isActive }).eq('id', id);
  if (error) return fail(error.message);

  revalidatePath('/admin/classes');
  return ok;
}

export async function assignTeacher(
  classId: string,
  teacherId: string | null
): Promise<ClassActionState> {
  if (!classId) return fail('반 ID가 없습니다.');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  // 이 반의 기존 배정 제거
  await admin.from('admin_class_assignments').delete().eq('class_id', classId);

  // 새 담임 배정 (한 담임이 여러 반 가능)
  if (teacherId) {
    const { error } = await admin
      .from('admin_class_assignments')
      .insert({ admin_id: teacherId, class_id: classId });
    if (error) return fail(error.message);
  }

  revalidatePath('/admin/classes');
  return ok;
}

export async function deleteClass(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const id = (formData.get('id') as string)?.trim();
  if (!id) return fail('반 ID가 없습니다.');

  const supabase = await createClient();

  // 소속 학생이 있으면 삭제 불가
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', id)
    .eq('role', 'student');

  if ((count ?? 0) > 0) return fail('소속 학생이 있는 반은 삭제할 수 없습니다.');

  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) return fail(error.message);

  revalidatePath('/admin/classes');
  return ok;
}
