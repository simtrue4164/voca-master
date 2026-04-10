'use client';

import { useActionState, useState } from 'react';
import { createExam } from '@/app/actions/exams';

type ClassOption = { id: string; name: string };
const initState = { error: null, success: false };

export default function CreateExamForm({ classes }: { classes: ClassOption[] }) {
  const [state, action, isPending] = useActionState(createExam, initState);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= 2) return [prev[1], day]; // 2개 초과 시 첫 번째 제거
      return [...prev, day];
    });
  }

  const day1 = selectedDays[0] ?? null;
  const day2 = selectedDays[1] ?? null;

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#6e6e73] mb-1">시험명</label>
          <input
            name="title"
            type="text"
            required
            placeholder="예: 1회 실전 모의고사"
            className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm focus:outline-none focus:border-[#1d1d1f]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6e6e73] mb-1">대상 반</label>
          <select
            name="class_id"
            required
            className="w-full px-3 py-2 border border-[#e5e5ea] rounded-lg text-sm bg-white focus:outline-none focus:border-[#1d1d1f]"
          >
            <option value="">반 선택</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

      </div>

      {/* Day 선택 그리드 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[#6e6e73]">
            시험 범위 Day 선택 <span className="text-[#6e6e73]">(2개 선택 · 각 25문항)</span>
          </label>
          <div className="flex gap-3 text-xs">
            {day1 !== null && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                Day {day1}
              </span>
            )}
            {day2 !== null && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                Day {day2}
              </span>
            )}
            {selectedDays.length === 0 && (
              <span className="text-[#6e6e73]">아직 선택 안됨</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 60 }, (_, i) => i + 1).map((day) => {
            const isFirst = day === day1;
            const isSecond = day === day2;
            const isSelected = isFirst || isSecond;

            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`py-1.5 rounded text-xs font-medium transition-colors border ${
                  isFirst
                    ? 'bg-[#1d1d1f] border-blue-600 text-white'
                    : isSecond
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-[#e5e5ea] text-[#6e6e73] hover:border-blue-400 hover:text-[#0071e3]'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#6e6e73] mt-2">
          순서대로 선택 · 3번째 선택 시 첫 번째 Day가 교체됩니다
        </p>
      </div>

      {/* hidden inputs */}
      <input type="hidden" name="day_1" value={day1 ?? ''} />
      <input type="hidden" name="day_2" value={day2 ?? ''} />

      <p className="text-xs text-[#6e6e73]">총 50문항 · 8분 고정 · 기출 빈도 낮은 단어 우선 출제</p>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">시험이 출제되었습니다.</p>}

      <button
        type="submit"
        disabled={isPending || selectedDays.length < 2}
        className="px-6 py-2 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? '출제 중...' : `시험 출제 (Day ${day1 ?? '?'} + Day ${day2 ?? '?'})`}
      </button>
    </form>
  );
}
