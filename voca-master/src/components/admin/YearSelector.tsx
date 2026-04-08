'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminYear } from '@/app/actions/year';

export default function YearSelector({
  years,
  currentYear,
}: {
  years: number[];
  currentYear: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    await setAdminYear(e.target.value);
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={currentYear}
      onChange={handleChange}
      disabled={isPending}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  );
}
