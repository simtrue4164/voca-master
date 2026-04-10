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
          className="flex-1 px-3 py-2.5 border border-[#e5e5ea] rounded-xl text-[13px] text-[#1d1d1f] placeholder-[#c7c7cc] focus:outline-none focus:border-[#1d1d1f]"
        />
        <button
          type="submit"
          disabled={createPending}
          className="px-4 py-2.5 bg-[#1d1d1f] text-white text-[13px] font-semibold rounded-xl hover:opacity-80 disabled:opacity-40 whitespace-nowrap transition-opacity"
        >
          {createPending ? '추가 중...' : '지점 추가'}
        </button>
      </form>
      {createState.error && <p className="text-[13px] text-[#ff3b30]">{createState.error}</p>}
      {createState.success && <p className="text-[13px] text-[#34c759]">지점이 추가되었습니다.</p>}

      {/* 지점 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">#</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">지점명</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">반 수</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f7]">
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-[#6e6e73]">
                  등록된 지점이 없습니다
                </td>
              </tr>
            )}
            {branches.map((branch, i) => (
              <tr key={branch.id} className="hover:bg-[#f5f5f7] transition-colors">
                <td className="px-4 py-3 text-[#c7c7cc]">{i + 1}</td>
                <td className="px-4 py-3">
                  {editingId === branch.id ? (
                    <form action={editAction} className="flex gap-2" onSubmit={() => setEditingId(null)}>
                      <input type="hidden" name="id" value={branch.id} />
                      <input
                        name="name"
                        defaultValue={branch.name}
                        autoFocus
                        className="flex-1 px-2 py-1 border border-[#e5e5ea] rounded-lg text-[13px] focus:outline-none focus:border-[#1d1d1f]"
                      />
                      <button type="submit" disabled={editPending} className="text-[11px] px-3 py-1 bg-[#1d1d1f] text-white rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity">저장</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 transition-opacity">취소</button>
                    </form>
                  ) : (
                    <span className="text-[#1d1d1f]">{branch.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#6e6e73]">{branch.class_count}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setEditingId(branch.id)}
                      className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity"
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
                        className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
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
      {deleteState.error && <p className="text-[13px] text-[#ff3b30]">{deleteState.error}</p>}
    </div>
  );
}
