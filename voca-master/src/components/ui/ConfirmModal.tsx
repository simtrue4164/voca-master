'use client';

import { useState } from 'react';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ModalState = ConfirmOptions & { resolve: (v: boolean) => void };

export function useConfirmModal() {
  const [state, setState] = useState<ModalState | null>(null);

  function openConfirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setState({ ...opts, resolve });
    });
  }

  const confirmModal = state ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      danger={state.danger}
      onConfirm={() => { state.resolve(true); setState(null); }}
      onCancel={() => { state.resolve(false); setState(null); }}
    />
  ) : null;

  return { confirmModal, openConfirm };
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        {title && (
          <h3 className="text-base font-bold text-[#1d1d1f] mb-2">{title}</h3>
        )}
        <p className="text-[14px] text-[#1d1d1f] leading-relaxed whitespace-pre-line">{message}</p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-[#f5f5f7] text-[#1d1d1f] text-sm font-medium rounded-xl hover:bg-[#e5e5ea] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1d1d1f] hover:opacity-80'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
