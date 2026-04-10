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
        <label className="block text-xs font-medium text-[#6e6e73] mb-1">이름</label>
        <input name="name" type="text" required placeholder="홍길동"
          className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#6e6e73] mb-1">수험번호</label>
        <input name="exam_no" type="text" required placeholder="1001"
          className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#6e6e73] mb-1">초기 비밀번호</label>
        <input name="password" type="text" required placeholder="수험번호와 동일하게 설정 권장"
          className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]" />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#6e6e73] mb-2">
          소속 반 <span className="text-[#6e6e73]">(복수 선택 가능)</span>
        </label>
        <div className="border border-[#e5e5ea] rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
          {classes.map((cls) => (
            <label key={cls.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#f5f5f7] px-2 py-1 rounded">
              <input
                type="checkbox"
                name="class_ids"
                value={cls.id}
                checked={selectedClassIds.includes(cls.id)}
                onChange={() => toggleClass(cls.id)}
                className="rounded border-[#e5e5ea] text-[#0071e3]"
              />
              <span className="text-xs text-[#1d1d1f]">
                {getBranchName(cls) && <span className="text-[#6e6e73]">[{getBranchName(cls)}] </span>}
                {cls.name}
              </span>
            </label>
          ))}
          {classes.length === 0 && <p className="text-xs text-[#6e6e73] px-2">반이 없습니다</p>}
        </div>
      </div>

      {state.error && <p className="col-span-2 text-sm text-red-500">{state.error}</p>}
      {state.success && <p className="col-span-2 text-sm text-green-600">학생 계정이 생성되었습니다.</p>}

      <div className="col-span-2">
        <button type="submit" disabled={isPending}
          className="px-6 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50">
          {isPending ? '생성 중...' : '학생 추가'}
        </button>
      </div>
    </form>
  );
}
