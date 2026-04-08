'use client';

import { useState, useActionState, useTransition } from 'react';
import { updateAdmin, activateAdmin, deactivateAdmin } from '@/app/actions/admins';

type Branch = { id: string; name: string };
type AdminRow = {
  id: string;
  name: string;
  role: string;
  branch_id: string | null;
  class_id: string | null;
  is_active: boolean;
  employee_no: string | null;
  branch_name: string | null;
  class_ids: string[];
  class_names: string[];
};

const ROLE_OPTIONS = [
  { value: 'admin_super', label: '전체 관리자' },
  { value: 'admin_branch', label: '지점 관리자' },
  { value: 'admin_class', label: '반 담임' },
];

const initState = { error: null, success: false };

export default function AdminTable({
  admins,
  branches,
  currentUserId,
}: {
  admins: AdminRow[];
  branches: Branch[];
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<AdminRow | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">사번</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">이름</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">역할</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">담당</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map((adm) => (
              <AdminRow
                key={adm.id}
                adm={adm}
                isSelf={adm.id === currentUserId}
                onEdit={() => setEditing(adm)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdminEditModal
          admin={editing}
          branches={branches}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin_super: '전체 관리자',
  admin_branch: '지점 관리자',
  admin_class: '반 담임',
};

function AdminRow({ adm, isSelf, onEdit }: { adm: AdminRow; isSelf: boolean; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const msg = adm.is_active
      ? `${adm.name} 관리자를 비활성화하시겠습니까?`
      : `${adm.name} 관리자를 활성화하시겠습니까?`;
    if (!confirm(msg)) return;
    const fd = new FormData();
    fd.set('id', adm.id);
    startTransition(async () => {
      if (adm.is_active) {
        await deactivateAdmin({ error: null, success: false }, fd);
      } else {
        await activateAdmin({ error: null, success: false }, fd);
      }
    });
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-gray-500 text-xs">{adm.employee_no ?? '-'}</td>
      <td className="px-4 py-3 font-medium text-gray-900">{adm.name}</td>
      <td className="px-4 py-3 text-gray-500">{ROLE_LABEL[adm.role] ?? adm.role}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {adm.branch_name ? (
          <span className="font-medium text-gray-700">{adm.branch_name}</span>
        ) : (
          <span className="text-gray-300">전체</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          adm.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {adm.is_active ? '활성' : '비활성'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            수정
          </button>
          {!isSelf && (
            <button
              onClick={handleToggle}
              disabled={isPending}
              className={`text-xs font-medium disabled:opacity-50 ${
                adm.is_active ? 'text-red-400 hover:text-red-600' : 'text-blue-500 hover:text-blue-700'
              }`}
            >
              {isPending ? '처리중...' : adm.is_active ? '비활성화' : '활성화'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AdminEditModal({
  admin,
  branches,
  onClose,
}: {
  admin: AdminRow;
  branches: Branch[];
  onClose: () => void;
}) {
  const [state, action, isPending] = useActionState(updateAdmin, initState);
  const [selectedRole, setSelectedRole] = useState(admin.role);
  const [selectedBranch, setSelectedBranch] = useState(admin.branch_id ?? '');

  if (state.success) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">관리자 수정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form action={action} className="p-5 space-y-4">
          <input type="hidden" name="id" value={admin.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
            <input
              name="name"
              defaultValue={admin.name}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">역할</label>
            <select
              name="role"
              value={selectedRole}
              onChange={(e) => { setSelectedRole(e.target.value); setSelectedBranch(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {(selectedRole === 'admin_branch' || selectedRole === 'admin_class') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">담당 지점</label>
              <select
                name="branch_id"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">지점 선택</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {state.error && <p className="text-sm text-red-500">{state.error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '저장 중...' : '저장'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
