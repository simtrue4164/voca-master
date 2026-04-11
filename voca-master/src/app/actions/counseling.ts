'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

function revalidate(requestId: string) {
  revalidatePath(`/admin/counseling/${requestId}`);
  revalidatePath('/admin/counseling');
}

// 슬롯 배정 → 예약
export async function reserveSlot(requestId: string, slotId: string) {
  if (!requestId || !slotId) return { error: '필수 값이 없습니다.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('counseling_requests')
    .update({ status: 'scheduled', slot_id: slotId })
    .eq('id', requestId);
  if (error) return { error: error.message };
  revalidate(requestId);
  return { ok: true };
}

// 예약 → 완료 (상담 기록 저장)
export async function completeSession(
  requestId: string,
  recordId: string | undefined,
  content: string,
  outcome: string | null
) {
  if (!requestId || !content) return { error: '필수 값이 없습니다.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (recordId) {
    const { error } = await admin
      .from('counseling_records')
      .update({ content, outcome })
      .eq('id', recordId);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from('counseling_records')
      .insert({ request_id: requestId, admin_id: user!.id, content, outcome });
    if (error) return { error: error.message };
  }

  await admin
    .from('counseling_requests')
    .update({ status: 'completed' })
    .eq('id', requestId);

  revalidate(requestId);
  return { ok: true };
}

// 예약 → 확정 (scheduled → confirmed)
export async function confirmSchedule(requestId: string) {
  if (!requestId) return { error: '필수 값이 없습니다.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('counseling_requests')
    .update({ status: 'confirmed' })
    .eq('id', requestId);
  if (error) return { error: error.message };
  revalidate(requestId);
  return { ok: true };
}

// 예약 → 확정 완료 (메모 없이 빠른 완료 처리)
export async function confirmComplete(requestId: string) {
  if (!requestId) return { error: '필수 값이 없습니다.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { error: recordError } = await admin
    .from('counseling_records')
    .insert({ request_id: requestId, admin_id: user!.id, content: '상담 완료', outcome: null });
  if (recordError) return { error: recordError.message };

  const { error } = await admin
    .from('counseling_requests')
    .update({ status: 'completed' })
    .eq('id', requestId);
  if (error) return { error: error.message };

  revalidate(requestId);
  return { ok: true };
}

// 취소
export async function cancelRequest(requestId: string) {
  if (!requestId) return { error: '필수 값이 없습니다.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('counseling_requests')
    .update({ status: 'dismissed', slot_id: null })
    .eq('id', requestId);
  if (error) return { error: error.message };
  revalidate(requestId);
  return { ok: true };
}
