'use client';

import { useActionState } from 'react';
import { activateAdmin, deactivateAdmin } from '@/app/actions/admins';

const initState = { error: null, success: false };

export default function AdminToggleButton({ id, isActive }: { id: string; isActive: boolean }) {
  const action = isActive ? deactivateAdmin : activateAdmin;
  const [state, formAction, isPending] = useActionState(action, initState);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className={`text-xs font-medium disabled:opacity-50 ${
          isActive ? 'text-red-400 hover:text-red-600' : 'text-blue-500 hover:text-blue-700'
        }`}
      >
        {isPending ? '처리중...' : isActive ? '비활성화' : '활성화'}
      </button>
    </form>
  );
}
