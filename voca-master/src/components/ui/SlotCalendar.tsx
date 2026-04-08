'use client';

import { useState } from 'react';

export default function SlotCalendar({
  availableDates,
  selectedDate,
  onSelectDate,
}: {
  availableDates: Set<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstAvailable = [...availableDates].sort()[0];
  const initDate = firstAvailable ? new Date(firstAvailable + 'T00:00:00') : today;

  const [year, setYear] = useState(initDate.getFullYear());
  const [month, setMonth] = useState(initDate.getMonth());

  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function pad(n: number) { return String(n).padStart(2, '0'); }
  function dateStr(d: number) { return `${year}-${pad(month + 1)}-${pad(d)}`; }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">{year}년 {month + 1}월</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1 font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const ds = dateStr(day);
          const isAvailable = availableDates.has(ds) && ds >= todayStr;
          const isSelected = selectedDate === ds;

          return (
            <button
              key={ds}
              onClick={() => isAvailable && onSelectDate(ds)}
              disabled={!isAvailable}
              className={`
                mx-auto w-8 h-8 rounded-full text-sm flex items-center justify-center transition-colors
                ${isSelected
                  ? 'bg-blue-600 text-white font-bold'
                  : isAvailable
                    ? 'bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 border border-blue-200'
                    : 'text-gray-300 cursor-default'}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
