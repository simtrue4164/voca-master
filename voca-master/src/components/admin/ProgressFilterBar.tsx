'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type Option = { id: string; name: string };

export default function ProgressFilterBar({
  branches,
  years,
  classes,
  selectedBranchId,
  selectedYear,
  selectedClassId,
  showBranch,
  hideClass,
}: {
  branches: Option[];
  years: number[];
  classes: Option[];
  selectedBranchId: string;
  selectedYear: number | null;
  selectedClassId: string;
  showBranch: boolean;
  hideClass?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // 상위 조건 변경 시 하위 초기화
    if (key === 'branch_id') { params.delete('year'); params.delete('class_id'); }
    if (key === 'year') { params.delete('class_id'); }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilter = selectedBranchId || selectedYear !== null || (!hideClass && selectedClassId);

  return (
    <div className="flex flex-wrap gap-2 items-center bg-white rounded-xl border border-gray-200 px-4 py-3">
      <span className="text-sm font-medium text-gray-600 shrink-0">검색 조건</span>
      <div className="h-4 w-px bg-gray-200 shrink-0" />

      {/* 지점 */}
      {showBranch && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">지점</span>
          <select
            value={selectedBranchId}
            onChange={(e) => update('branch_id', e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 지점</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 학년도 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400">학년도</span>
        <select
          value={selectedYear ?? ''}
          onChange={(e) => update('year', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 연도</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      {/* 반 */}
      {!hideClass && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">반</span>
          <select
            value={selectedClassId}
            onChange={(e) => update('class_id', e.target.value)}
            disabled={classes.length === 0}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
          >
            <option value="">전체 반</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 초기화 */}
      {hasFilter && (
        <button
          onClick={() => router.push(pathname)}
          className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
        >
          초기화
        </button>
      )}
    </div>
  );
}
