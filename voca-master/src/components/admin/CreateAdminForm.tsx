'use client';

import { useActionState, useState } from 'react';
import { createAdmin } from '@/app/actions/admins';

type Branch = { id: string; name: string };
const initState = { error: null, success: false };

export default function CreateAdminForm({ branches }: { branches: Branch[] }) {
  const [state, action, isPending] = useActionState(createAdmin, initState);
  const [selectedRole, setSelectedRole] = useState('admin_class');

  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
        <input name="name" type="text" required placeholder="홍길동"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">사번 (로그인 ID)</label>
        <input name="employee_no" type="text" required placeholder="예: A001"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">초기 비밀번호</label>
        <input name="password" type="text" required placeholder="초기 비밀번호"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">역할</label>
        <select name="role" required value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="admin_super">전체 관리자</option>
          <option value="admin_branch">지점 관리자</option>
          <option value="admin_class">반 담임</option>
        </select>
      </div>

      {(selectedRole === 'admin_branch' || selectedRole === 'admin_class') && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">담당 지점</label>
          <select name="branch_id" required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">지점 선택</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {state.error && <p className="col-span-2 text-sm text-red-500">{state.error}</p>}
      {state.success && <p className="col-span-2 text-sm text-green-600">관리자 계정이 생성되었습니다.</p>}

      <div className="col-span-2">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {isPending ? '생성 중...' : '관리자 추가'}
        </button>
      </div>
    </form>
  );
}
