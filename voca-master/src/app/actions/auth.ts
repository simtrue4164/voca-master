'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type LoginState = {
  error: string | null;
};

// 학생 로그인: 수험번호 → {exam_no}@voca-master.internal 변환
export async function loginStudent(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const examNo = (formData.get('exam_no') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();
  const next = (formData.get('next') as string)?.trim();

  if (!examNo || !password) {
    return { error: '수험번호와 비밀번호를 입력해주세요.' };
  }

  const email = `${examNo}@voca-master.internal`;
  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: '수험번호 또는 비밀번호가 올바르지 않습니다.' };
  }

  // 이번 달 수강 등록 여부 확인
  const thisMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from('student_class_memberships')
    .select('student_id')
    .eq('student_id', authData.user.id)
    .eq('year_month', thisMonth)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    // 등록 없음 → 로그아웃 후 에러 반환
    await supabase.auth.signOut();
    return { error: `${thisMonth.replace('-', '년 ')}월 수강 등록이 되어 있지 않습니다. 담당 선생님께 문의해주세요.` };
  }

  // next가 유효한 내부 학생 경로면 그쪽으로, 아니면 대시보드 (Open Redirect 방지)
  const isValidNext = next && next.startsWith('/student/') && !next.startsWith('//');
  redirect(isValidNext ? next : '/student/dashboard');
}

// 관리자 로그인: 사번 → {employee_no}@voca-master.internal 변환
export async function loginAdmin(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const employeeNo = (formData.get('employee_no') as string)?.trim();
  const password = (formData.get('password') as string)?.trim();

  if (!employeeNo || !password) {
    return { error: '사번과 비밀번호를 입력해주세요.' };
  }

  const email = `${employeeNo}@voca-master.internal`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: '사번 또는 비밀번호가 올바르지 않습니다.' };
  }

  // is_active / role 체크는 admin layout에서 처리
  redirect('/admin/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
