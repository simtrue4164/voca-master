'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SlotCalendar from '@/components/ui/SlotCalendar';

type Slot = { id: string; slot_date: string; slot_hour: number };
type Request = {
  id: string;
  source: string;
  request_note: string | null;
  status: string;
  created_at: string;
  slot_id: string | null;
  slot: { slot_date: string; slot_hour: number } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending:   '대기',
  scheduled: '예약',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  dismissed: '취소',
};
const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-50 text-yellow-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  dismissed: 'bg-gray-100 text-gray-500',
};

export default function StudentCounselingClient({
  adminProfile,
  availableSlots,
  myRequests,
  studentId,
  adminId,
}: {
  adminProfile: { id: string; name: string } | null;
  availableSlots: Slot[];
  myRequests: Request[];
  studentId: string;
  adminId: string | null;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // 편집 중인 요청 ID
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSlotId, setEditSlotId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // 날짜별 슬롯 맵 (신규 신청용)
  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of availableSlots) {
    slotsByDate[s.slot_date] = [...(slotsByDate[s.slot_date] ?? []), s];
  }
  const availableDates = new Set(Object.keys(slotsByDate));
  const hoursForDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];
  const selectedSlot = hoursForDate.find((s) => s.id === selectedSlotId);

  async function handleSubmit() {
    if (!adminId) { setMsg('담당 선생님이 배정되어 있지 않습니다.'); return; }
    if (!selectedSlotId) { setMsg('상담 시간을 선택해주세요.'); return; }

    setIsSubmitting(true);
    setMsg('');
    try {
      const res = await fetch('/api/student/counseling/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          admin_id: adminId,
          slot_id: selectedSlotId,
          request_note: note.trim() || null,
        }),
      });
      if (res.ok) {
        setMsg('상담 신청이 완료되었습니다!');
        setNote('');
        setSelectedDate('');
        setSelectedSlotId('');
        router.refresh();
      } else {
        const j = await res.json();
        setMsg(`오류: ${j.error}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEdit(req: Request) {
    setEditingId(req.id);
    setEditDate(req.slot?.slot_date ?? '');
    setEditSlotId(req.slot_id ?? '');
    setEditNote(req.request_note ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDate('');
    setEditSlotId('');
    setEditNote('');
  }

  // 편집 모드용 슬롯 맵: 현재 예약된 슬롯도 포함 (본인 것이니 선택 가능)
  function getEditSlotsForRequest(req: Request) {
    const slots = [...availableSlots];
    // 현재 예약 슬롯이 available에 없으면 추가
    if (req.slot_id && req.slot && !slots.find((s) => s.id === req.slot_id)) {
      slots.push({ id: req.slot_id, slot_date: req.slot.slot_date, slot_hour: req.slot.slot_hour });
    }
    const byDate: Record<string, Slot[]> = {};
    for (const s of slots) {
      byDate[s.slot_date] = [...(byDate[s.slot_date] ?? []), s];
    }
    return byDate;
  }

  async function handleSaveEdit(req: Request) {
    setIsEditing(true);
    try {
      const body: Record<string, any> = {};
      if (editSlotId && editSlotId !== req.slot_id) body.slot_id = editSlotId;
      if (editNote !== (req.request_note ?? '')) body.request_note = editNote.trim() || null;

      if (Object.keys(body).length === 0) { cancelEdit(); return; }

      const res = await fetch(`/api/student/counseling/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        cancelEdit();
        router.refresh();
      } else {
        const j = await res.json();
        setMsg(`오류: ${j.error}`);
      }
    } finally {
      setIsEditing(false);
    }
  }

  async function handleCancel(reqId: string) {
    if (!confirm('상담 신청을 취소하시겠습니까?')) return;
    setIsEditing(true);
    try {
      const res = await fetch(`/api/student/counseling/requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const j = await res.json();
        setMsg(`오류: ${j.error}`);
      }
    } finally {
      setIsEditing(false);
    }
  }

  return (
    <div className="space-y-5">
      {!adminProfile ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          담당 선생님이 배정되어 있지 않습니다. 관리자에게 문의해주세요.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">상담 신청</h2>
          <p className="text-xs text-gray-400 mb-4">담당 선생님: {adminProfile.name}</p>

          {availableSlots.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              현재 예약 가능한 상담 시간이 없습니다.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-gray-600 mb-2">날짜 선택</p>
              <SlotCalendar
                availableDates={availableDates}
                selectedDate={selectedDate}
                onSelectDate={(d) => { setSelectedDate(d); setSelectedSlotId(''); }}
              />

              {selectedDate && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    {selectedDate} 예약 가능 시간
                  </p>
                  {hoursForDate.length === 0 ? (
                    <p className="text-sm text-gray-400">해당 날짜에 가능한 시간이 없습니다.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {hoursForDate.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlotId(slot.id)}
                          className={`px-4 py-2 rounded-lg text-sm border-2 font-medium transition-colors ${
                            selectedSlotId === slot.id
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300'
                          }`}
                        >
                          {slot.slot_hour}:00
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedSlot && (
                <p className="mt-3 text-sm text-blue-700 font-medium">
                  선택: {selectedDate} {selectedSlot.slot_hour}:00
                </p>
              )}

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-600 mb-2">상담 요청 내용 (선택)</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="상담을 신청하는 이유나 어려운 점을 적어주세요..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedSlotId}
                className="mt-3 w-full py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? '신청 중...' : '상담 신청하기'}
              </button>
            </>
          )}

          {msg && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              msg.includes('오류') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {msg}
            </div>
          )}
        </div>
      )}

      {/* 신청 이력 */}
      {myRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">신청 이력</h2>
          <div className="space-y-3">
            {myRequests.map((req) => {
              const isEditMode = editingId === req.id;
              const canEdit = req.status === 'scheduled' || req.status === 'pending';

              if (isEditMode) {
                const editSlotsByDate = getEditSlotsForRequest(req);
                const editAvailableDates = new Set(Object.keys(editSlotsByDate));
                const editHours = editDate ? (editSlotsByDate[editDate] ?? []) : [];
                const editSelectedSlot = editHours.find((s) => s.id === editSlotId);

                return (
                  <div key={req.id} className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                    <p className="text-xs font-semibold text-blue-700 mb-3">상담 내용 수정</p>

                    <p className="text-xs font-medium text-gray-600 mb-2">날짜 선택</p>
                    <SlotCalendar
                      availableDates={editAvailableDates}
                      selectedDate={editDate}
                      onSelectDate={(d) => { setEditDate(d); setEditSlotId(''); }}
                    />

                    {editDate && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-600 mb-2">{editDate} 가능 시간</p>
                        {editHours.length === 0 ? (
                          <p className="text-sm text-gray-400">해당 날짜에 가능한 시간이 없습니다.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {editHours.map((slot) => (
                              <button
                                key={slot.id}
                                onClick={() => setEditSlotId(slot.id)}
                                className={`px-4 py-2 rounded-lg text-sm border-2 font-medium transition-colors ${
                                  editSlotId === slot.id
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                                }`}
                              >
                                {slot.slot_hour}:00
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {editSelectedSlot && (
                      <p className="mt-2 text-sm text-blue-700 font-medium">
                        선택: {editDate} {editSelectedSlot.slot_hour}:00
                      </p>
                    )}

                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-600 mb-1">상담 요청 내용</p>
                      <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                      />
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleSaveEdit(req)}
                        disabled={isEditing}
                        className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isEditing ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={isEditing}
                        className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={req.id} className="py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800">
                        {req.slot ? `${req.slot.slot_date} ${req.slot.slot_hour}:00` : '시간 미정'}
                      </p>
                      {req.request_note && (
                        <p className="text-xs text-gray-400 truncate max-w-48">{req.request_note}</p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] ?? ''}`}>
                      {STATUS_LABELS[req.status] ?? req.status}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => startEdit(req)}
                        className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleCancel(req.id)}
                        disabled={isEditing}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
