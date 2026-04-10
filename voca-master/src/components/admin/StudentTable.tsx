'use client';

import { useState, useActionState } from 'react';
import { updateStudentFull, updateStudentPassword, toggleStudentMonth, setBulkMonthEnrollment } from '@/app/actions/students';
import Link from 'next/link';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'] as const;

type ClassOption = { id: string; name: string };
type StudentRow = {
  id: string;
  name: string;
  exam_no: string | null;
  class_id: string | null;
  class_ids: string[];
  class_names: string[];
  is_active: boolean;
  yearMemberships: Record<string, string[]>; // year_month → class_ids[]
};

const initState = { error: null, success: false };

export default function StudentTable({
  students,
  classes,
}: {
  students: StudentRow[];
  classes: ClassOption[];
}) {
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const tableYear = new Date().getFullYear().toString();

  // 낙관적 UI: studentId → 배정된 월 Set ('MM')
  const [enrolledMonths, setEnrolledMonths] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(
      students.map((s) => [
        s.id,
        new Set(
          Object.keys(s.yearMemberships)
            .filter((ym) => ym.startsWith(tableYear))
            .map((ym) => ym.slice(5, 7))
        ),
      ])
    )
  );

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (q && !s.name.toLowerCase().includes(q) && !(s.exam_no ?? '').includes(q)) return false;
    if (filterClass && !s.class_ids.includes(filterClass)) return false;
    if (filterStatus === 'active' && !s.is_active) return false;
    if (filterStatus === 'inactive' && s.is_active) return false;
    return true;
  });

  function isMonthChecked(studentId: string, mm: string) {
    return enrolledMonths[studentId]?.has(mm) ?? false;
  }

  function isAllMonthChecked(mm: string) {
    return filtered.length > 0 && filtered.every((s) => isMonthChecked(s.id, mm));
  }

  async function handleMonthToggle(student: StudentRow, mm: string) {
    const ym = `${tableYear}-${mm}`;
    const nowChecked = !isMonthChecked(student.id, mm);
    setEnrolledMonths((prev) => {
      const next = { ...prev, [student.id]: new Set(prev[student.id]) };
      if (nowChecked) next[student.id].add(mm);
      else next[student.id].delete(mm);
      return next;
    });
    await toggleStudentMonth(student.id, ym, student.class_ids, nowChecked);
  }

  async function handleAllMonthToggle(mm: string) {
    const allChecked = isAllMonthChecked(mm);
    const ym = `${tableYear}-${mm}`;
    setEnrolledMonths((prev) => {
      const next = { ...prev };
      for (const s of filtered) {
        next[s.id] = new Set(prev[s.id]);
        if (allChecked) next[s.id].delete(mm);
        else next[s.id].add(mm);
      }
      return next;
    });
    await setBulkMonthEnrollment(
      filtered.map((s) => ({ studentId: s.id, classIds: s.class_ids })),
      ym,
      !allChecked
    );
  }

  return (
    <>
      {/* 검색/필터 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="이름 또는 수험번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-40 px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]"
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm bg-white focus:outline-none focus:border-[#1d1d1f]"
        >
          <option value="">전체 반</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm bg-white focus:outline-none focus:border-[#1d1d1f]"
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
        <span className="text-sm text-[#6e6e73]">{filtered.length}명</span>
        <span className="text-xs text-[#c7c7cc] ml-auto">{tableYear}년도 배정 현황</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: '860px' }}>
          <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium whitespace-nowrap">수험번호</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium whitespace-nowrap">이름</th>
              <th className="text-left px-3 py-3 text-[#6e6e73] font-medium whitespace-nowrap">소속 반</th>
              {MONTHS.map((mm, i) => (
                <th key={mm} className="px-1 py-2 text-center w-9">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs text-[#6e6e73] font-medium leading-none">{i + 1}</span>
                    <input
                      type="checkbox"
                      checked={isAllMonthChecked(mm)}
                      onChange={() => handleAllMonthToggle(mm)}
                      title={`${i + 1}월 전체`}
                      className="w-3.5 h-3.5 rounded border-[#e5e5ea] text-[#0071e3] cursor-pointer"
                    />
                  </div>
                </th>
              ))}
              <th className="text-left px-3 py-3 text-[#6e6e73] font-medium whitespace-nowrap">상태</th>
              <th className="px-3 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f7]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={17} className="text-center py-8 text-[#6e6e73]">
                  {students.length === 0 ? '등록된 학생이 없습니다' : '검색 결과가 없습니다'}
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-[#f5f5f7]">
                <td className="px-4 py-2.5 font-mono text-[#1d1d1f] whitespace-nowrap">{s.exam_no}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/admin/students/${s.id}`} className="font-medium text-[#1d1d1f] hover:text-[#0071e3]">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[#6e6e73] text-xs whitespace-nowrap">
                  {s.class_names.length > 0
                    ? s.class_names.join(', ')
                    : <span className="text-[#c7c7cc]">-</span>}
                </td>
                {MONTHS.map((mm) => (
                  <td key={mm} className="px-1 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isMonthChecked(s.id, mm)}
                      onChange={() => handleMonthToggle(s, mm)}
                      disabled={s.class_ids.length === 0 && !isMonthChecked(s.id, mm)}
                      title={s.class_ids.length === 0 && !isMonthChecked(s.id, mm) ? '배정된 반 없음' : ''}
                      className="w-3.5 h-3.5 rounded border-[#e5e5ea] text-[#0071e3] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    s.is_active ? 'bg-green-50 text-green-700' : 'bg-[#f5f5f7] text-[#6e6e73]'
                  }`}>
                    {s.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => setEditing(s)} className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity">
                    수정
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <StudentEditModal
          student={editing}
          classes={classes}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function StudentEditModal({
  student,
  classes,
  onClose,
}: {
  student: StudentRow;
  classes: ClassOption[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updateStudentFull, initState);
  const [pwState, pwAction, pwIsPending] = useActionState(updateStudentPassword, initState);
  const [isActive, setIsActive] = useState(student.is_active);
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(student.class_ids);

  // 선택된 연도의 배정된 월 목록 (MM 형식)
  const enrolledMonths = Object.keys(student.yearMemberships)
    .filter((ym) => ym.startsWith(selectedYear))
    .map((ym) => ym.slice(5, 7));
  const [selectedMonths, setSelectedMonths] = useState<string[]>(enrolledMonths);

  function handleYearChange(year: string) {
    setSelectedYear(year);
    const months = Object.keys(student.yearMemberships)
      .filter((ym) => ym.startsWith(year))
      .map((ym) => ym.slice(5, 7));
    setSelectedMonths(months);
  }

  function toggleMonth(mm: string) {
    setSelectedMonths((prev) =>
      prev.includes(mm) ? prev.filter((m) => m !== mm) : [...prev, mm]
    );
  }

  function toggleClass(id: string) {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  if (state.success) { onClose(); return null; }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-[#e5e5ea] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1d1d1f]">학생 수정</h2>
            <p className="text-xs text-[#6e6e73] mt-0.5">수험번호: {student.exam_no}</p>
          </div>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#6e6e73] text-xl">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* 통합 수정 폼 */}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="student_id" value={student.id} />
            <input type="hidden" name="is_active" value={String(isActive)} />
            <input type="hidden" name="year" value={selectedYear} />
            {selectedMonths.map((mm) => (
              <input key={mm} type="hidden" name="months" value={mm} />
            ))}
            {selectedClassIds.map((cid) => (
              <input key={cid} type="hidden" name="class_ids" value={cid} />
            ))}

            <div>
              <label className="block text-xs font-medium text-[#6e6e73] mb-1">이름</label>
              <input name="name" defaultValue={student.name} required
                className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]" />
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-medium text-[#6e6e73]">계정 상태</span>
              <button type="button" onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-[#1d1d1f]' : 'bg-[#e5e5ea]'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* 반 배정: 학년도 + 월 체크박스 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-[#6e6e73]">반 배정</span>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  min="2020" max="2035"
                  className="w-20 px-2 py-1 border border-[#e5e5ea] rounded text-sm text-center focus:outline-none focus:border-[#1d1d1f]"
                />
                <span className="text-xs text-[#6e6e73]">학년도</span>
              </div>

              {/* 월 체크박스 */}
              <div className="grid grid-cols-4 gap-1 mb-3 p-2 bg-[#f5f5f7] rounded-lg">
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map((mm, i) => (
                  <label key={mm} className="flex items-center gap-1.5 px-1 py-1 rounded cursor-pointer hover:bg-white">
                    <input
                      type="checkbox"
                      checked={selectedMonths.includes(mm)}
                      onChange={() => toggleMonth(mm)}
                      className="rounded border-[#e5e5ea] text-[#0071e3]"
                    />
                    <span className="text-xs text-[#1d1d1f]">{i + 1}월</span>
                  </label>
                ))}
              </div>

              {/* 반 체크박스 */}
              <div className="border border-[#e5e5ea] rounded-lg p-2 max-h-28 overflow-y-auto space-y-1">
                {classes.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-[#f5f5f7] px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="rounded border-[#e5e5ea] text-[#0071e3]"
                    />
                    <span className="text-sm text-[#1d1d1f]">{c.name}</span>
                  </label>
                ))}
                {classes.length === 0 && <p className="text-xs text-[#6e6e73] px-2">반이 없습니다</p>}
              </div>
              <p className="text-xs text-[#6e6e73] mt-1">
                선택한 월에 위 반이 일괄 배정됩니다. 체크 해제된 월의 기존 배정은 삭제됩니다.
              </p>
            </div>

            {state.error && <p className="text-sm text-red-500">{state.error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending}
                className="flex-1 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50">
                {isPending ? '저장 중...' : '저장'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 bg-[#f5f5f7] text-[#6e6e73] text-sm font-medium rounded-lg hover:opacity-80">
                취소
              </button>
            </div>
          </form>

          {/* 비밀번호 초기화 */}
          <div className="border-t border-[#f5f5f7] pt-4">
            <p className="text-xs font-medium text-[#6e6e73] mb-2">비밀번호 초기화</p>
            <form action={pwAction} className="flex gap-2">
              <input type="hidden" name="user_id" value={student.id} />
              <input name="password" type="text" placeholder="새 비밀번호" required
                className="flex-1 px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]" />
              <button type="submit" disabled={pwIsPending}
                className="px-3 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-[#1d1d1f] disabled:opacity-50">
                {pwIsPending ? '...' : '변경'}
              </button>
            </form>
            {pwState.error && <p className="text-xs text-red-500 mt-1">{pwState.error}</p>}
            {pwState.success && <p className="text-xs text-green-600 mt-1">비밀번호가 변경되었습니다.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
