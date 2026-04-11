'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export type StudentActionState = {
  error: string | null;
  success: boolean;
};

// 학생 생성: Auth 유저 + profiles 동시 생성
export async function createStudent(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const name = (formData.get('name') as string)?.trim();
  const examNo = (formData.get('exam_no') as string)?.trim();
  const classIds = formData.getAll('class_ids').map((v) => (v as string).trim()).filter(Boolean);
  const password = (formData.get('password') as string)?.trim();

  if (!name || !examNo || !password) {
    return { error: '이름, 수험번호, 비밀번호를 입력해주세요.', success: false };
  }

  const admin = createAdminClient();
  const email = `${examNo}@voca-master.internal`;

  // 1. Auth 유저 생성
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // 이메일 인증 생략
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { error: `수험번호 ${examNo}는 이미 등록되어 있습니다.`, success: false };
    }
    return { error: authError.message, success: false };
  }

  // 2. profiles 생성 (트리거가 이미 삽입했을 수 있으므로 upsert)
  const primaryClassId = classIds[0] ?? null;
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      role: 'student',
      name,
      exam_no: examNo,
      class_id: primaryClassId,
    }, { onConflict: 'id' });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: profileError.message, success: false };
  }

  // student_class_memberships 등록 (이번 달)
  if (classIds.length > 0) {
    const yearMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    await admin.from('student_class_memberships').insert(
      classIds.map((cid) => ({ student_id: authData.user.id, class_id: cid, year_month: yearMonth }))
    );
  }

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 학생 비밀번호 변경
export async function updateStudentPassword(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const userId = (formData.get('user_id') as string)?.trim();
  const newPassword = (formData.get('password') as string)?.trim();

  if (!userId || !newPassword) {
    return { error: '입력값이 올바르지 않습니다.', success: false };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 학생 정보 + 연간 반 배정 통합 수정 (학년도 + 월 체크박스)
export async function updateStudentFull(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const studentId = (formData.get('student_id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const isActive = formData.get('is_active') === 'true';
  const year = (formData.get('year') as string)?.trim();
  const months = formData.getAll('months').map((v) => (v as string).trim()).filter(Boolean); // ['01','03',...]
  const classIds = formData.getAll('class_ids').map((v) => (v as string).trim()).filter(Boolean);

  if (!studentId || !name) return { error: '이름을 입력해주세요.', success: false };

  const admin = createAdminClient();
  const primaryClassId = classIds[0] ?? null;

  const { error } = await admin
    .from('profiles')
    .update({ name, class_id: primaryClassId, is_active: isActive })
    .eq('id', studentId);
  if (error) return { error: error.message, success: false };

  // 연간 반 배정 일괄 교체
  if (year) {
    // 해당 연도 전체 배정 삭제
    await admin.from('student_class_memberships')
      .delete()
      .eq('student_id', studentId)
      .gte('year_month', `${year}-01`)
      .lte('year_month', `${year}-12`);

    // 체크된 월 × 선택된 반 조합으로 재등록
    if (months.length > 0 && classIds.length > 0) {
      const rows = months.flatMap((mm) =>
        classIds.map((cid) => ({
          student_id: studentId,
          class_id: cid,
          year_month: `${year}-${mm}`,
        }))
      );
      const { error: insertError } = await admin.from('student_class_memberships').insert(rows);
      if (insertError) return { error: insertError.message, success: false };
    }

    // 이번 달이 해당 연도에 속하면 profiles.class_id 동기화
    const now = new Date();
    const nowYear = now.getFullYear().toString();
    const nowMM = String(now.getMonth() + 1).padStart(2, '0');
    if (year === nowYear) {
      const thisMonthClassId = months.includes(nowMM) ? primaryClassId : null;
      await admin.from('profiles').update({ class_id: thisMonthClassId }).eq('id', studentId);
    }
  }

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 학생 정보 수정 (이름, 반, 활성 상태)
export async function updateStudent(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const studentId = (formData.get('student_id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const classIds = formData.getAll('class_ids').map((v) => (v as string).trim()).filter(Boolean);
  const isActive = formData.get('is_active') === 'true';

  if (!studentId || !name) return { error: '이름을 입력해주세요.', success: false };

  const admin = createAdminClient();
  const primaryClassId = classIds[0] ?? null;
  const { error } = await admin
    .from('profiles')
    .update({ name, class_id: primaryClassId, is_active: isActive })
    .eq('id', studentId);

  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 월별 반 배정 추가/변경
export async function upsertMonthlyEnrollment(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const studentId = (formData.get('student_id') as string)?.trim();
  const classId = (formData.get('class_id') as string)?.trim();
  const yearMonth = (formData.get('year_month') as string)?.trim();

  if (!studentId || !classId || !yearMonth) return { error: '항목을 모두 입력해주세요.', success: false };

  const admin = createAdminClient();

  // 해당 월 배정 upsert
  const { error } = await admin.from('student_class_memberships').upsert(
    { student_id: studentId, class_id: classId, year_month: yearMonth },
    { onConflict: 'student_id,class_id,year_month' }
  );
  if (error) return { error: error.message, success: false };

  // 이번 달이면 profiles.class_id도 동기화
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (yearMonth === thisMonth) {
    await admin.from('profiles').update({ class_id: classId }).eq('id', studentId);
  }

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 특정 월의 반 배정을 한 번에 교체 (기존 삭제 후 재등록)
export async function setMonthlyEnrollments(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const studentId = (formData.get('student_id') as string)?.trim();
  const yearMonth = (formData.get('year_month') as string)?.trim();
  const classIds = formData.getAll('class_ids').map((v) => (v as string).trim()).filter(Boolean);

  if (!studentId || !yearMonth) return { error: '항목이 없습니다.', success: false };

  const admin = createAdminClient();

  // 해당 월 기존 배정 전체 삭제 후 재등록
  await admin.from('student_class_memberships')
    .delete()
    .eq('student_id', studentId)
    .eq('year_month', yearMonth);

  if (classIds.length > 0) {
    const { error } = await admin.from('student_class_memberships').insert(
      classIds.map((cid) => ({ student_id: studentId, class_id: cid, year_month: yearMonth }))
    );
    if (error) return { error: error.message, success: false };
  }

  // 이번 달이면 profiles.class_id 동기화
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (yearMonth === thisMonth) {
    await admin.from('profiles')
      .update({ class_id: classIds[0] ?? null })
      .eq('id', studentId);
  }

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 월별 배정 삭제
export async function deleteMonthlyEnrollment(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const studentId = (formData.get('student_id') as string)?.trim();
  const yearMonth = (formData.get('year_month') as string)?.trim();

  if (!studentId || !yearMonth) return { error: '항목이 없습니다.', success: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from('student_class_memberships')
    .delete()
    .eq('student_id', studentId)
    .eq('year_month', yearMonth);

  if (error) return { error: error.message, success: false };
  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 개별 월 배정 토글 (목록에서 직접 클릭)
export async function toggleStudentMonth(
  studentId: string,
  yearMonth: string,
  classIds: string[],
  checked: boolean
): Promise<{ error: string | null }> {
  const admin = createAdminClient();

  if (!checked) {
    const { error } = await admin
      .from('student_class_memberships')
      .delete()
      .eq('student_id', studentId)
      .eq('year_month', yearMonth);
    if (error) return { error: error.message };
  } else {
    if (classIds.length === 0) return { error: null }; // 배정 반 없으면 스킵
    const { error } = await admin.from('student_class_memberships').insert(
      classIds.map((cid) => ({ student_id: studentId, class_id: cid, year_month: yearMonth }))
    );
    if (error) return { error: error.message };
    const thisMonth = new Date().toISOString().slice(0, 7);
    if (yearMonth === thisMonth && classIds.length > 0) {
      await admin.from('profiles').update({ class_id: classIds[0] }).eq('id', studentId);
    }
  }

  revalidatePath('/admin/students');
  return { error: null };
}

// 전체 학생 특정 월 일괄 배정/해제
export async function setBulkMonthEnrollment(
  entries: { studentId: string; classIds: string[] }[],
  yearMonth: string,
  checked: boolean
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const studentIds = entries.map((e) => e.studentId);

  await admin
    .from('student_class_memberships')
    .delete()
    .in('student_id', studentIds)
    .eq('year_month', yearMonth);

  if (checked) {
    const rows = entries.flatMap((e) =>
      e.classIds.map((cid) => ({ student_id: e.studentId, class_id: cid, year_month: yearMonth }))
    );
    if (rows.length > 0) {
      const { error } = await admin.from('student_class_memberships').insert(rows);
      if (error) return { error: error.message };
    }
    const thisMonth = new Date().toISOString().slice(0, 7);
    if (yearMonth === thisMonth) {
      for (const e of entries) {
        if (e.classIds.length > 0) {
          await admin.from('profiles').update({ class_id: e.classIds[0] }).eq('id', e.studentId);
        }
      }
    }
  }

  revalidatePath('/admin/students');
  return { error: null };
}

// 학생 반 이동
export async function moveStudentClass(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const studentId = (formData.get('student_id') as string)?.trim();
  const newClassId = (formData.get('class_id') as string)?.trim();

  if (!studentId || !newClassId) {
    return { error: '입력값이 올바르지 않습니다.', success: false };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ class_id: newClassId })
    .eq('id', studentId);

  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/students');
  return { error: null, success: true };
}

// 학생 삭제 (Auth + profiles 동시)
export async function deleteStudent(
  _prev: StudentActionState,
  formData: FormData
): Promise<StudentActionState> {
  const userId = (formData.get('user_id') as string)?.trim();
  if (!userId) return { error: '유저 ID가 없습니다.', success: false };

  const admin = createAdminClient();

  // profiles는 ON DELETE CASCADE로 자동 삭제됨
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message, success: false };

  revalidatePath('/admin/students');
  return { error: null, success: true };
}
