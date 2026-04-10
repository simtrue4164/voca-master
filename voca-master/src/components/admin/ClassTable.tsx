'use client';

import { useActionState, useState, useTransition } from 'react';
import { createClass, updateClass, deleteClass, assignTeacher } from '@/app/actions/classes';

type Branch = { id: string; name: string };
type Teacher = { id: string; name: string; branch_id: string | null };
type ClassRow = {
  id: string;
  name: string;
  branch_id: string;
  year: string;
  is_active: boolean;
  student_count: number;
  branch_name: string;
  teacher_id: string | null;
};

const initState = { error: null, success: false };

export default function ClassTable({
  classes,
  branches,
  teachers,
}: {
  classes: ClassRow[];
  branches: Branch[];
  teachers: Teacher[];
}) {
  const [createState, createAction, createPending] = useActionState(createClass, initState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, editAction, editPending] = useActionState(updateClass, initState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteClass, initState);
  const [filterBranch, setFilterBranch] = useState('');

  const filtered = filterBranch
    ? classes.filter((c) => c.branch_id === filterBranch)
    : classes;

  // 담임 ID로 프로필 조회
  function getTeacher(teacherId: string | null) {
    if (!teacherId) return null;
    return teachers.find((t) => t.id === teacherId) ?? null;
  }

  // 지점 내 모든 담임이 후보 (여러 반 담당 가능)
  function getCandidates(branchId: string) {
    return teachers.filter((t) => t.branch_id === branchId);
  }

  return (
    <div className="space-y-4">
      {/* 반 추가 */}
      <form action={createAction} className="grid grid-cols-4 gap-2">
        <input
          name="name"
          type="text"
          required
          placeholder="반 이름 (예: A반)"
          className="col-span-2 md:col-span-1 px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]"
        />
        <select
          name="branch_id"
          required
          className="px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f] bg-white"
        >
          <option value="">지점 선택</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <input
          name="year"
          type="text"
          required
          placeholder="학년도 (예: 2026)"
          className="px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]"
        />
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1.5 text-sm text-[#6e6e73] cursor-pointer">
            <input type="checkbox" name="is_active" value="true" defaultChecked
              className="rounded border-[#e5e5ea] text-[#0071e3]" />
            활성
          </label>
          <button
            type="submit"
            disabled={createPending}
            className="flex-1 px-4 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50 whitespace-nowrap"
          >
            {createPending ? '추가 중...' : '반 추가'}
          </button>
        </div>
      </form>
      {createState.error && <p className="text-sm text-red-500">{createState.error}</p>}
      {createState.success && <p className="text-sm text-green-600">반이 추가되었습니다.</p>}

      {/* 지점 필터 */}
      <div className="flex gap-2 items-center">
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-3 py-1.5 border border-[#e5e5ea] rounded-lg text-sm bg-white focus:outline-none"
        >
          <option value="">전체 지점</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <span className="text-sm text-[#6e6e73]">{filtered.length}개 반</span>
      </div>

      {/* 반 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">#</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">반 이름</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">소속 지점</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">학년도</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">담임</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">학생 수</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">상태</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f7]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-[#6e6e73]">
                  등록된 반이 없습니다
                </td>
              </tr>
            )}
            {filtered.map((cls, i) => (
              <tr key={cls.id} className="hover:bg-[#f5f5f7]">
                <td className="px-4 py-3 text-[#6e6e73]">{i + 1}</td>
                <td className="px-4 py-3">
                  {editingId === cls.id ? (
                    <form action={editAction} className="flex gap-2 flex-wrap" onSubmit={() => setEditingId(null)}>
                      <input type="hidden" name="id" value={cls.id} />
                      <input
                        name="name"
                        defaultValue={cls.name}
                        autoFocus
                        className="w-28 px-2 py-1 border border-[#e5e5ea] rounded text-sm"
                      />
                      <input
                        name="year"
                        defaultValue={cls.year}
                        placeholder="학년도"
                        className="w-20 px-2 py-1 border border-[#e5e5ea] rounded text-sm"
                      />
                      <label className="flex items-center gap-1 text-xs text-[#6e6e73]">
                        <input type="checkbox" name="is_active" value="true" defaultChecked={cls.is_active}
                          className="rounded border-[#e5e5ea] text-[#0071e3]" />
                        활성
                      </label>
                      <button type="submit" disabled={editPending} className="text-[11px] px-3 py-1 bg-[#1d1d1f] text-white rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity">저장</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 transition-opacity">취소</button>
                    </form>
                  ) : (
                    <span className="text-[#1d1d1f]">{cls.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#6e6e73]">{cls.branch_name}</td>
                <td className="px-4 py-3 text-[#6e6e73]">{cls.year || '-'}</td>
                <td className="px-4 py-3">
                  <TeacherAssignCell
                    classId={cls.id}
                    currentTeacher={getTeacher(cls.teacher_id)}
                    candidates={getCandidates(cls.branch_id)}
                  />
                </td>
                <td className="px-4 py-3 text-[#6e6e73]">{cls.student_count}명</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    cls.is_active ? 'bg-green-50 text-green-700' : 'bg-[#f5f5f7] text-[#6e6e73]'
                  }`}>
                    {cls.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setEditingId(cls.id)} className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity">
                      수정
                    </button>
                    <form action={deleteAction} onSubmit={(e) => {
                      if (!confirm(`'${cls.name}' 반을 삭제하시겠습니까?`)) e.preventDefault();
                    }}>
                      <input type="hidden" name="id" value={cls.id} />
                      <button
                        type="submit"
                        disabled={deletePending || cls.student_count > 0}
                        className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        title={cls.student_count > 0 ? '소속 학생이 있어 삭제 불가' : ''}
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

// ── 담임 배정 셀 ──────────────────────────────────────────────

function TeacherAssignCell({
  classId,
  currentTeacher,
  candidates,
}: {
  classId: string;
  currentTeacher: { id: string; name: string } | null;
  candidates: Teacher[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(currentTeacher?.id ?? '');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSave() {
    startTransition(async () => {
      const result = await assignTeacher(classId, selectedId || null);
      if (result.error) {
        setError(result.error);
      } else {
        setIsEditing(false);
        setError('');
      }
    });
  }

  function handleCancel() {
    setSelectedId(currentTeacher?.id ?? '');
    setIsEditing(false);
    setError('');
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        {currentTeacher ? (
          <span className="text-[#1d1d1f] text-sm">{currentTeacher.name}</span>
        ) : (
          <span className="text-xs text-[#6e6e73] bg-[#f5f5f7] px-2 py-0.5 rounded-full">미배정</span>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity"
        >
          배정
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isPending}
          className="px-2 py-1 border border-[#e5e5ea] rounded text-sm bg-white focus:outline-none focus:ring-1 focus:border-[#1d1d1f] max-w-36"
        >
          <option value="">담임 없음</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-[11px] px-3 py-1 bg-[#1d1d1f] text-white rounded-lg hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {isPending ? '저장 중' : '저장'}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-lg hover:opacity-80 transition-opacity"
        >
          취소
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {candidates.length === 0 && (
        <p className="text-xs text-[#6e6e73]">이 지점에 배정 가능한 담임이 없습니다</p>
      )}
    </div>
  );
}
