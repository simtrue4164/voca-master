'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  reserveSlot,
  confirmAppointment,
  completeSession,
  cancelRequest,
} from '@/app/actions/counseling';
import SlotCalendar from '@/components/ui/SlotCalendar';

type Slot = { id: string; slot_date: string; slot_hour: number; is_active: boolean };
type Record_ = { id: string; content: string; outcome: string | null; created_at: string };
type History = { id: string; content: string; outcome: string | null; created_at: string };

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  scheduled: '예약',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  dismissed: '취소',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-50 text-yellow-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-[#f5f5f7] text-[#6e6e73]',
  dismissed: 'bg-[#f5f5f7] text-[#6e6e73]',
};

export default function CounselingDetail({
  request,
  record,
  history,
  availableSlots,
  currentAdminId,
}: {
  request: any;
  record: Record_ | null;
  history: History[];
  availableSlots: Slot[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');
  const [content, setContent] = useState(record?.content ?? '');
  const [outcome, setOutcome] = useState<string>(record?.outcome ?? '');

  // 현재 예약된 슬롯 정보 (available에 없으면 별도 보관)
  const currentSlot: Slot | null = request.slot_id && request.slot
    ? { id: request.slot_id, slot_date: request.slot.slot_date, slot_hour: request.slot.slot_hour, is_active: true }
    : null;

  // 날짜별 슬롯 맵: available + 현재 예약 슬롯 포함 (관리자가 동일 슬롯 재선택 가능)
  const slotsForEdit = [...availableSlots];
  if (currentSlot && !slotsForEdit.find((s) => s.id === currentSlot.id)) {
    slotsForEdit.push(currentSlot);
  }
  const slotsByDate: Record<string, Slot[]> = {};
  for (const s of slotsForEdit) {
    slotsByDate[s.slot_date] = [...(slotsByDate[s.slot_date] ?? []), s];
  }
  const availableDates = new Set(Object.keys(slotsByDate));

  const [selectedDate, setSelectedDate] = useState<string>(currentSlot?.slot_date ?? '');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(request.slot_id ?? '');

  const hoursForDate = selectedDate ? (slotsByDate[selectedDate] ?? []) : [];
  const selectedSlot = hoursForDate.find((s) => s.id === selectedSlotId);

  const isEditable = request.status === 'pending' || request.status === 'scheduled' || request.status === 'confirmed';
  const isFinal = request.status === 'completed' || request.status === 'cancelled' || request.status === 'dismissed';

  function run(fn: () => Promise<{ ok?: boolean; error?: string } | undefined>) {
    setMsg('');
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setMsg(`오류: ${result.error}`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1d1d1f]">{request.student?.name ?? '-'}</h2>
            <p className="text-sm text-[#6e6e73]">수험번호: {request.student?.exam_no ?? '-'}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_COLOR[request.status]}`}>
            {STATUS_LABEL[request.status] ?? request.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[#6e6e73] mb-0.5">신청 구분</p>
            <p className="font-medium text-[#1d1d1f]">
              {request.source === 'ai' ? 'AI 추천' : '학생 직접 신청'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#6e6e73] mb-0.5">신청일</p>
            <p className="font-medium text-[#1d1d1f]">
              {new Date(request.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
          {request.slot && (
            <div className="col-span-2">
              <p className="text-xs text-[#6e6e73] mb-0.5">예약 일시</p>
              <p className="font-medium text-blue-700">
                {request.slot.slot_date} {request.slot.slot_hour}:00
              </p>
            </div>
          )}
        </div>

        {request.counseling_recommendations && (
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-xs font-medium text-purple-700 mb-1">
              AI 위험도 {Math.round(request.counseling_recommendations.risk_score * 100)}%
            </p>
            <p className="text-sm text-purple-800">{request.counseling_recommendations.reason}</p>
          </div>
        )}
        {request.source === 'student' && request.request_note && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-medium text-blue-700 mb-1">학생 요청 내용</p>
            <p className="text-sm text-blue-800">{request.request_note}</p>
          </div>
        )}
      </div>

      {/* 일정 선택 (예약 가능 상태일 때) */}
      {isEditable && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-4">상담 일정 선택</h3>

          {availableDates.size === 0 ? (
            <p className="text-sm text-[#6e6e73]">예약 가능한 슬롯이 없습니다. 시간대 관리에서 슬롯을 활성화해주세요.</p>
          ) : (
            <>
              <SlotCalendar
                availableDates={availableDates}
                selectedDate={selectedDate}
                onSelectDate={(d) => { setSelectedDate(d); setSelectedSlotId(''); }}
              />

              {selectedDate && hoursForDate.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-[#6e6e73] mb-2">{selectedDate} 가능 시간</p>
                  <div className="flex gap-2 flex-wrap">
                    {hoursForDate.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`px-4 py-2 rounded-lg text-sm border-2 font-medium transition-colors ${
                          selectedSlotId === slot.id
                            ? 'border-blue-600 bg-[#1d1d1f] text-white'
                            : 'border-[#e5e5ea] text-[#6e6e73] hover:border-blue-300'
                        }`}
                      >
                        {slot.slot_hour}:00
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedSlotId && selectedSlot && (
                <p className="mt-3 text-sm text-blue-700 font-medium">
                  선택: {selectedDate} {selectedSlot.slot_hour}:00
                </p>
              )}
            </>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              onClick={() => {
                const label = request.status === 'confirmed' ? '일정을 변경' : '예약을 진행';
                const slotInfo = selectedSlot ? `${selectedDate} ${selectedSlot.slot_hour}:00` : '';
                if (!confirm(`${slotInfo} 일정으로 ${label}하시겠습니까?`)) return;
                run(() => reserveSlot(request.id, selectedSlotId));
              }}
              disabled={!selectedSlotId || isPending}
              className="px-5 py-2 bg-[#1d1d1f] text-white text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
            >
              {isPending ? '처리 중...' : request.status === 'confirmed' ? '일정 변경' : '예약'}
            </button>
            {request.status === 'scheduled' && (
              <button
                onClick={() => {
                  if (!confirm('상담 일정을 확정하시겠습니까?')) return;
                  run(() => confirmAppointment(request.id));
                }}
                disabled={isPending}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              >
                확정
              </button>
            )}
            <button
              onClick={() => {
                if (!confirm('상담 신청을 취소하시겠습니까?')) return;
                run(() => cancelRequest(request.id));
              }}
              disabled={isPending}
              className="px-4 py-2 bg-[#f5f5f7] text-[#6e6e73] text-sm font-medium rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 확정 상태: 완료 처리 버튼 노출 */}
      {request.status === 'confirmed' && !isFinal && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">상담 완료 처리</h3>
          </div>
          <RecordForm
            content={content}
            outcome={outcome}
            readonly={false}
            onChange={(c, o) => { setContent(c); setOutcome(o); }}
          />
          <button
            onClick={() => {
              if (!confirm('상담을 완료 처리하시겠습니까?')) return;
              run(() => completeSession(request.id, record?.id, content.trim(), outcome || null));
            }}
            disabled={!content.trim() || isPending}
            className="mt-4 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-40"
          >
            {isPending ? '저장 중...' : '완료 저장'}
          </button>
        </div>
      )}

      {/* 완료 상태: 기록 열람 */}
      {request.status === 'completed' && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">상담 기록</h3>
          <RecordForm content={content} outcome={outcome} readonly={!!record} onChange={() => {}} />
        </div>
      )}

      {/* 이전 상담 이력 */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">이전 상담 이력 ({history.length}건)</h3>
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="p-3 bg-[#f5f5f7] rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#6e6e73]">{new Date(h.created_at).toLocaleDateString('ko-KR')}</span>
                  {h.outcome && (
                    <span className="text-xs bg-[#e5e5ea] text-[#6e6e73] px-2 py-0.5 rounded-full">{h.outcome}</span>
                  )}
                </div>
                <p className="text-[#1d1d1f]">{h.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          msg.includes('오류') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ── 상담 기록 폼 ───────────────────────────────────────────────

function RecordForm({
  content,
  outcome,
  readonly,
  onChange,
}: {
  content: string;
  outcome: string;
  readonly: boolean;
  onChange: (content: string, outcome: string) => void;
}) {
  return (
    <>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value, outcome)}
        placeholder="상담 내용을 입력하세요..."
        rows={5}
        readOnly={readonly}
        className="w-full border border-[#e5e5ea] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1d1d1f] resize-none"
      />
      <div className="mt-3">
        <p className="text-xs text-[#6e6e73] mb-2">상담 결과</p>
        <div className="flex gap-2">
          {['정상복귀', '집중관리', '기타'].map((o) => (
            <button
              key={o}
              onClick={() => !readonly && onChange(content, o)}
              disabled={readonly}
              className={`px-3 py-1.5 text-xs rounded-full border-2 font-medium transition-colors ${
                outcome === o
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-[#e5e5ea] text-[#6e6e73] hover:border-[#e5e5ea]'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
