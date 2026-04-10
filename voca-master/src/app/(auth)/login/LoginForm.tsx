'use client';

import { useState, useActionState } from 'react';
import { loginStudent, loginAdmin, type LoginState } from '@/app/actions/auth';

const initialState: LoginState = { error: null };

export default function LoginForm({ next }: { next: string }) {
  const [tab, setTab] = useState<'student' | 'admin'>('student');

  const [studentState, studentAction, studentPending] = useActionState(
    loginStudent,
    initialState
  );
  const [adminState, adminAction, adminPending] = useActionState(
    loginAdmin,
    initialState
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-center text-[#1d1d1f] mb-2">
          Voca-Master
        </h1>
        <p className="text-sm text-center text-[#6e6e73] mb-6">
          편입영어 통합 학습 관리 시스템
        </p>

        {/* 탭 */}
        <div className="flex rounded-lg bg-[#f5f5f7] p-1 mb-6">
          <button
            type="button"
            onClick={() => setTab('student')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'student'
                ? 'bg-white text-[#1d1d1f] shadow-sm'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            학생
          </button>
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'admin'
                ? 'bg-white text-[#1d1d1f] shadow-sm'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            관리자
          </button>
        </div>

        {/* 학생 로그인 */}
        {tab === 'student' && (
          <form action={studentAction} className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div>
              <label htmlFor="exam_no" className="block text-sm font-medium text-[#1d1d1f] mb-1">
                수험번호
              </label>
              <input
                id="exam_no"
                name="exam_no"
                type="text"
                required
                placeholder="수험번호를 입력하세요"
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none  focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#1d1d1f] mb-1">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="비밀번호를 입력하세요"
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none  focus:border-transparent"
              />
            </div>
            {next && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                로그인 후 시험 화면으로 이동합니다
              </p>
            )}
            {studentState.error && (
              <p className="text-sm text-red-500">{studentState.error}</p>
            )}
            <button
              type="submit"
              disabled={studentPending}
              className="w-full py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {studentPending ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}

        {/* 관리자 로그인 */}
        {tab === 'admin' && (
          <form action={adminAction} className="space-y-4">
            <div>
              <label htmlFor="employee_no" className="block text-sm font-medium text-[#1d1d1f] mb-1">
                사번
              </label>
              <input
                id="employee_no"
                name="employee_no"
                type="text"
                required
                placeholder="사번을 입력하세요"
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none  focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-[#1d1d1f] mb-1">
                비밀번호
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                required
                placeholder="비밀번호를 입력하세요"
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none  focus:border-transparent"
              />
            </div>
            {adminState.error && (
              <p className="text-sm text-red-500">{adminState.error}</p>
            )}
            <p className="text-xs text-[#6e6e73] text-center">관리자 계정은 시스템에서 발급된 사번으로 로그인합니다</p>
            <button
              type="submit"
              disabled={adminPending}
              className="w-full py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {adminPending ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
