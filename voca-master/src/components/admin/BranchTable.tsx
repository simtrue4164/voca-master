'use client';

import { useActionState, useState } from 'react';
import { createBranch, updateBranch, deleteBranch } from '@/app/actions/branches';

type Branch = { id: string; name: string; class_count: number };

const initState = { error: null, success: false };

export default function BranchTable({ branches }: { branches: Branch[] }) {
  const [createState, createAction, createPending] = useActionState(createBranch, initState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, editAction, editPending] = useActionState(updateBranch, initState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteBranch, initState);

  return (
    <div className="space-y-4">
      {/* 지점 추가 */}
      <form action={createAction} className="flex gap-2">
        <input
          name="name"
          type="text"
          required
          placeholder="지점명 입력 (예: 대구본원)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={createPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {createPending ? '추가 중...' : '지점 추가'}
        </button>
      </form>
      {createState.error && <p className="text-sm text-red-500">{createState.error}</p>}
      {createState.success && <p className="text-sm text-green-600">지점이 추가되었습니다.</p>}

      {/* 지점 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">지점명</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">반 수</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-400">
                  등록된 지점이 없습니다
                </td>
              </tr>
            )}
            {branches.map((branch, i) => (
              <tr key={branch.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3">
                  {editingId === branch.id ? (
                    <form action={editAction} className="flex gap-2" onSubmit={() => setEditingId(null)}>
                      <input type="hidden" name="id" value={branch.id} />
                      <input
                        name="name"
                        defaultValue={branch.name}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="submit" disabled={editPending} className="text-blue-600 text-xs font-medium">저장</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-gray-400 text-xs">취소</button>
                    </form>
                  ) : (
                    <span className="text-gray-900">{branch.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{branch.class_count}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setEditingId(branch.id)}
                      className="text-xs text-gray-500 hover:text-blue-600"
                    >
                      수정
                    </button>
                    <form action={deleteAction} onSubmit={(e) => {
                      if (!confirm(`'${branch.name}' 지점을 삭제하시겠습니까?`)) e.preventDefault();
                    }}>
                      <input type="hidden" name="id" value={branch.id} />
                      <button
                        type="submit"
                        disabled={deletePending || branch.class_count > 0}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                        title={branch.class_count > 0 ? '소속 반이 있어 삭제 불가' : ''}
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deleteState.error && <p className="text-sm text-red-500">{deleteState.error}</p>}
    </div>
  );
}
