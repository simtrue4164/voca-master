'use client';

import { useActionState, useState } from 'react';
import { createStudent } from '@/app/actions/students';

type ClassOption = {
  id: string;
  name: string;
  branches?: { name: string } | { name: string }[] | null;
};

const initialState = { error: null, success: false };

export default function CreateStudentForm({ classes }: { classes: ClassOption[] }) {
  const [state, action, isPending] = useActionState(createStudent, initialState);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  function toggleClass(id: string) {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function getBranchName(cls: ClassOption) {
    if (Array.isArray(cls.branches)) return cls.branches[0]?.name ?? '';
    return cls.branches?.name ?? '';
  }

  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
        <input name="name" type="text" required placeholder="홍길동"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">수험번호</label>
        <input name="exam_no" type="text" required placeholder="1001"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">초기 비밀번호</label>
        <input name="password" type="text" required placeholder="수험번호와 동일하게 설정 권장"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          소속 반 <span className="text-gray-400">(복수 선택 가능)</span>
        </label>
        <div className="border border-gray-200 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
          {classes.map((cls) => (
            <label key={cls.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
              <input
                type="checkbox"
                name="class_ids"
                value={cls.id}
                checked={selectedClassIds.includes(cls.id)}
                onChange={() => toggleClass(cls.id)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-xs text-gray-700">
                {getBranchName(cls) && <span className="text-gray-400">[{getBranchName(cls)}] </span>}
                {cls.name}
              </span>
            </label>
          ))}
          {classes.length === 0 && <p className="text-xs text-gray-400 px-2">반이 없습니다</p>}
        </div>
      </div>

      {state.error && <p className="col-span-2 text-sm text-red-500">{state.error}</p>}
      {state.success && <p className="col-span-2 text-sm text-green-600">학생 계정이 생성되었습니다.</p>}

      <div className="col-span-2">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {isPending ? '생성 중...' : '학생 추가'}
        </button>
      </div>
    </form>
  );
}
