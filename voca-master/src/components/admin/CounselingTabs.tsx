'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Request = {
  id: string;
  source: 'student' | 'ai';
  request_note: string | null;
  status: string;
  created_at: string;
  student: { id: string; name: string; exam_no: string | null; class_id: string | null } | null;
  slot: { slot_date: string; slot_hour: number } | null;
  counseling_recommendations: { risk_score: number; reason: string } | null;
};

type Slot = {
  id: string;
  admin_id: string;
  slot_date: string;
  slot_hour: number;
  is_active: boolean;
};

type ClassTeacher = {
  id: string;          // teacher profile id (or placeholder)
  name: string | null;
  class_id: string;
  class_name: string;
};

const STATUS_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'scheduled', label: '예약' },
  { value: 'confirmed', label: '확정' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

const HOURS = Array.from({ length: 8 }, (_, i) => i + 9); // 9~16

const statusColors: Record<string, string> = {
  pending:   'bg-yellow-50 text-yellow-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-[#f5f5f7] text-[#6e6e73]',
  dismissed: 'bg-[#f5f5f7] text-[#6e6e73]',
};

const statusLabels: Record<string, string> = {
  pending:   '대기',
  scheduled: '예약',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  dismissed: '취소',
};

export default function CounselingTabs({
  tab,
  statusFilter,
  requests,
  slots,
  classes,
  classTeachers,
  role,
  adminId,
}: {
  tab: string;
  statusFilter: string;
  requests: Request[];
  slots: Slot[];
  classes: { id: string; name: string }[];
  classTeachers: ClassTeacher[];
  role: string;
  adminId: string;
}) {
  const router = useRouter();

  function changeTab(newTab: string) {
    router.push(`/admin/counseling?tab=${newTab}`);
  }

  function changeStatus(newStatus: string) {
    router.push(`/admin/counseling?tab=requests&status=${newStatus}`);
  }

  return (
    <div>
      {/* 탭 헤더 */}
      <div className="flex border-b border-[#e5e5ea] mb-5">
        {[
          { key: 'requests', label: '상담 신청 목록' },
          { key: 'slots', label: '시간대 관리' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-[#0071e3]'
                : 'border-transparent text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <RequestsTab
          requests={requests}
          statusFilter={statusFilter}
          onStatusChange={changeStatus}
        />
      )}

      {tab === 'slots' && (
        role === 'admin_class'
          ? <ClassAdminSlotsTab
              adminId={adminId}
              slots={slots}
            />
          : <BranchSlotsTab
              classTeachers={classTeachers}
              slots={slots}
            />
      )}
    </div>
  );
}

// ── 상담 신청 목록 탭 ──────────────────────────────────────────

function RequestsTab({
  requests,
  statusFilter,
  onStatusChange,
}: {
  requests: Request[];
  statusFilter: string;
  onStatusChange: (s: string) => void;
}) {
  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s.value
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-[#f5f5f7] text-[#6e6e73] hover:opacity-80'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
            <tr>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">구분</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">학생</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">내용</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">예약일시</th>
              <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f5f5f7]">
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[#6e6e73]">
                  상담 신청이 없습니다
                </td>
              </tr>
            )}
            {requests.map((req) => (
              <tr key={req.id} className="hover:bg-[#f5f5f7] transition-colors">
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    req.source === 'ai' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {req.source === 'ai' ? 'AI' : '학생'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-[#1d1d1f]">{req.student?.name ?? '-'}</p>
                  <p className="text-xs text-[#6e6e73]">{req.student?.exam_no ?? ''}</p>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-[#1d1d1f] text-xs truncate">
                    {req.source === 'ai'
                      ? req.counseling_recommendations?.reason ?? 'AI 분석'
                      : req.request_note ?? '요청 내용 없음'}
                  </p>
                  {req.source === 'ai' && req.counseling_recommendations && (
                    <p className="text-xs text-purple-600 mt-0.5">
                      위험도 {Math.round(req.counseling_recommendations.risk_score * 100)}%
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#6e6e73]">
                  {req.slot ? `${req.slot.slot_date} ${req.slot.slot_hour}:00` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[req.status] ?? ''}`}>
                    {statusLabels[req.status] ?? req.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/counseling/${req.id}`}
                    className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] rounded-lg hover:opacity-80 transition-opacity"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 반담임용 슬롯 관리 (admin_class) ──────────────────────────

function ClassAdminSlotsTab({
  adminId,
  slots,
}: {
  adminId: string;
  slots: Slot[];
}) {
  const router = useRouter();
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  const mySlots = slots.filter((s) => s.admin_id === adminId);
  const todaySlots = mySlots.filter((s) => s.slot_date === slotDate);

  const slotsByDate = mySlots.reduce<Record<string, Slot[]>>((acc, s) => {
    acc[s.slot_date] = [...(acc[s.slot_date] ?? []), s];
    return acc;
  }, {});

  async function toggleSlot(hour: number) {
    const existing = todaySlots.find((s) => s.slot_hour === hour);
    setIsLoading(true);
    try {
      if (existing) {
        await fetch('/api/admin/counseling/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id, is_active: !existing.is_active }),
        });
      } else {
        await fetch('/api/admin/counseling/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: adminId, slot_date: slotDate, slot_hour: hour }),
        });
      }
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function bulkActivate() {
    setIsLoading(true);
    try {
      await fetch('/api/admin/counseling/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId, slot_date: slotDate, hours: HOURS }),
      });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function bulkDeactivate() {
    setIsLoading(true);
    try {
      await fetch('/api/admin/counseling/slots/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: adminId, slot_date: slotDate }),
      });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            className="border border-[#e5e5ea] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1d1d1f]"
          />
          <button
            onClick={bulkActivate}
            disabled={isLoading}
            className="px-4 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50"
          >
            전체 활성화
          </button>
          <button
            onClick={bulkDeactivate}
            disabled={isLoading}
            className="px-4 py-2 bg-[#f5f5f7] text-[#6e6e73] text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50"
          >
            전체 비활성화
          </button>
        </div>

        <SlotHourGrid slots={todaySlots} onToggle={toggleSlot} disabled={isLoading} />
        <p className="text-xs text-[#6e6e73] mt-4">활성화(파란색) 슬롯만 학생이 예약 가능합니다.</p>
      </div>

      {Object.keys(slotsByDate).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f5f5f7] bg-[#f5f5f7]">
            <p className="text-xs font-medium text-[#6e6e73]">예약 가능 일정 요약</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
              <tr>
                <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">날짜</th>
                <th className="text-left px-4 py-3 text-[#6e6e73] font-medium">활성 시간대</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f5f7]">
              {Object.entries(slotsByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateSlots]) => (
                <tr key={date} className="hover:bg-[#f5f5f7] cursor-pointer" onClick={() => setSlotDate(date)}>
                  <td className="px-4 py-3 text-[#1d1d1f]">{date}</td>
                  <td className="px-4 py-3 text-[#6e6e73] text-xs">
                    {dateSlots.filter((s) => s.is_active).map((s) => `${s.slot_hour}:00`).join(', ') || '없음'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 지점/슈퍼 관리자용 담임별 슬롯 관리 ─────────────────────────

function BranchSlotsTab({
  classTeachers,
  slots,
}: {
  classTeachers: ClassTeacher[];
  slots: Slot[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  function getTeacherSlots(teacherAdminId: string) {
    return slots.filter((s) => s.admin_id === teacherAdminId);
  }

  function getActiveCount(teacherAdminId: string) {
    return getTeacherSlots(teacherAdminId).filter((s) => s.is_active).length;
  }

  function getDateSummary(teacherAdminId: string) {
    const active = getTeacherSlots(teacherAdminId)
      .filter((s) => s.is_active && s.slot_date === slotDate)
      .map((s) => `${s.slot_hour}:00`);
    return active.length > 0 ? active.join(', ') : null;
  }

  async function toggleSlot(teacherAdminId: string, hour: number) {
    const teacherSlots = getTeacherSlots(teacherAdminId).filter((s) => s.slot_date === slotDate);
    const existing = teacherSlots.find((s) => s.slot_hour === hour);
    setIsLoading(true);
    try {
      if (existing) {
        await fetch('/api/admin/counseling/slots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id, is_active: !existing.is_active }),
        });
      } else {
        await fetch('/api/admin/counseling/slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: teacherAdminId, slot_date: slotDate, slot_hour: hour }),
        });
      }
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function bulkActivate(teacherAdminId: string) {
    setIsLoading(true);
    try {
      await fetch('/api/admin/counseling/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: teacherAdminId, slot_date: slotDate, hours: HOURS }),
      });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  async function bulkDeactivate(teacherAdminId: string) {
    setIsLoading(true);
    try {
      await fetch('/api/admin/counseling/slots/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: teacherAdminId, slot_date: slotDate }),
      });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  if (classTeachers.length === 0) {
    return (
      <div className="text-center py-12 text-[#6e6e73] text-sm bg-white rounded-2xl shadow-sm">
        관리 가능한 반이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 날짜 선택 (전체 공통) */}
      <div className="flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3">
        <span className="text-sm text-[#6e6e73] shrink-0">조회 날짜</span>
        <input
          type="date"
          value={slotDate}
          onChange={(e) => setSlotDate(e.target.value)}
          className="border border-[#e5e5ea] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1d1d1f]"
        />
      </div>

      {/* 담임별 아코디언 */}
      {classTeachers.map((teacher) => {
        const isExpanded = expandedId === teacher.id;
        const activeCount = getActiveCount(teacher.id);
        const dateSummary = getDateSummary(teacher.id);
        const teacherDaySlots = getTeacherSlots(teacher.id).filter((s) => s.slot_date === slotDate);

        return (
          <div key={teacher.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 헤더 행 */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : teacher.id)}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#f5f5f7] transition-colors"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-[#0071e3] text-xs font-bold">
                    {teacher.name ? teacher.name.charAt(0) : '?'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">
                    {teacher.name ?? '담임 미배정'}
                  </p>
                  <p className="text-xs text-[#6e6e73]">{teacher.class_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {dateSummary ? (
                  <span className="text-xs text-[#0071e3] bg-blue-50 px-2 py-0.5 rounded-full max-w-32 truncate">
                    {dateSummary}
                  </span>
                ) : (
                  <span className="text-xs text-[#6e6e73] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                    해당일 없음
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeCount > 0 ? 'bg-green-50 text-green-600' : 'bg-[#f5f5f7] text-[#6e6e73]'
                }`}>
                  전체 {activeCount}개
                </span>
                <svg
                  className={`w-4 h-4 text-[#6e6e73] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* 펼쳐진 슬롯 관리 영역 */}
            {isExpanded && (
              <div className="border-t border-[#f5f5f7] bg-[#f5f5f7] p-4">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => bulkActivate(teacher.id)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-[#1d1d1f] text-white text-xs font-medium rounded-lg hover:opacity-80 disabled:opacity-50"
                  >
                    전체 활성화
                  </button>
                  <button
                    onClick={() => bulkDeactivate(teacher.id)}
                    disabled={isLoading}
                    className="px-3 py-1.5 bg-[#f5f5f7] text-[#6e6e73] text-xs font-medium rounded-lg hover:opacity-80 disabled:opacity-50 transition-opacity"
                  >
                    전체 비활성화
                  </button>
                </div>

                <SlotHourGrid
                  slots={teacherDaySlots}
                  onToggle={(hour) => toggleSlot(teacher.id, hour)}
                  disabled={isLoading}
                />

                <TeacherScheduleSummary
                  slots={getTeacherSlots(teacher.id)}
                  onSelectDate={() => {}}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 공통: 시간 슬롯 그리드 ────────────────────────────────────

function SlotHourGrid({
  slots,
  onToggle,
  disabled,
}: {
  slots: Slot[];
  onToggle: (hour: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {HOURS.map((hour) => {
        const slot = slots.find((s) => s.slot_hour === hour);
        const isActive = slot?.is_active ?? false;
        return (
          <button
            key={hour}
            onClick={() => onToggle(hour)}
            disabled={disabled}
            className={`py-2.5 rounded-xl text-xs font-medium transition-colors border-2 ${
              isActive
                ? 'bg-[#1d1d1f] border-blue-600 text-white'
                : slot
                ? 'bg-[#f5f5f7] border-[#e5e5ea] text-[#6e6e73] line-through'
                : 'bg-white border-[#e5e5ea] text-[#6e6e73] hover:border-blue-300'
            }`}
          >
            {`${hour}:00`}
          </button>
        );
      })}
    </div>
  );
}

// ── 공통: 담임 일정 요약 ──────────────────────────────────────

function TeacherScheduleSummary({
  slots,
  onSelectDate,
}: {
  slots: Slot[];
  onSelectDate: (date: string) => void;
}) {
  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    acc[s.slot_date] = [...(acc[s.slot_date] ?? []), s];
    return acc;
  }, {});

  const sortedDates = Object.keys(slotsByDate).sort();
  if (sortedDates.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[#e5e5ea]">
      <p className="text-xs font-medium text-[#6e6e73] mb-2">등록된 일정</p>
      <div className="space-y-1">
        {sortedDates.map((date) => {
          const active = slotsByDate[date].filter((s) => s.is_active);
          return (
            <div key={date} className="flex items-center justify-between text-xs">
              <span className="text-[#6e6e73]">{date}</span>
              <span className={active.length > 0 ? 'text-[#0071e3]' : 'text-[#c7c7cc]'}>
                {active.length > 0
                  ? active.map((s) => `${s.slot_hour}:00`).join(', ')
                  : '활성 없음'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
