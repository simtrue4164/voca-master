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

// 예약 → 확정
export async function confirmAppointment(requestId: string) {
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

// 확정 → 완료 (상담 기록 저장)
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

// 취소
export async function cancelRequest(requestId: string) {
  if (!requestId) return { error: '필수 값이 없습니다.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('counseling_requests')
    .update({ status: 'cancelled', slot_id: null })
    .eq('id', requestId);
  if (error) return { error: error.message };
  revalidate(requestId);
  return { ok: true };
}

// 하위 호환 (기존 코드에서 사용 중인 경우)
export async function confirmSchedule(requestId: string, slotId: string) {
  return reserveSlot(requestId, slotId);
}
export async function dismissRequest(requestId: string) {
  return cancelRequest(requestId);
}
export async function saveCounselingRecord(
  requestId: string,
  recordId: string | undefined,
  content: string,
  outcome: string | null
) {
  return completeSession(requestId, recordId, content, outcome);
}
