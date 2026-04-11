'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';

export default function ExamQRButton({
  examId,
  examTitle,
}: {
  examId: string;
  examTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // 클라이언트 컴포넌트이므로 window 직접 접근 가능
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const examUrl = `${origin}/student/exam/${examId}`;

  function handleCopy() {
    navigator.clipboard.writeText(examUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] px-3 py-1 bg-[#f5f5f7] text-[#1d1d1f] font-medium rounded-lg hover:opacity-80 transition-opacity"
        title="QR코드 보기"
      >
        QR
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-4 border-b border-[#f5f5f7] flex items-start justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-[#1d1d1f]">시험 입장 QR코드</h2>
                <p className="text-[12px] text-[#6e6e73] mt-0.5 truncate max-w-xs">{examTitle}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#6e6e73] hover:text-[#1d1d1f] text-xl leading-none ml-2 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-6 flex flex-col items-center gap-5">
              <div className="p-4 bg-white border border-[#e5e5ea] rounded-2xl">
                {origin ? (
                  <QRCode value={examUrl} size={200} />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-[12px] text-[#6e6e73]">
                    로딩 중...
                  </div>
                )}
              </div>

              <div className="w-full">
                <p className="text-[12px] font-medium text-[#6e6e73] mb-1.5">시험 링크</p>
                <div className="flex items-center gap-2 px-3 py-2 bg-[#f5f5f7] rounded-xl">
                  <span className="text-[12px] text-[#1d1d1f] flex-1 break-all leading-relaxed">
                    {examUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    className={`text-[11px] font-medium shrink-0 px-2.5 py-1 rounded-lg transition-opacity ${
                      copied
                        ? 'bg-[#f0faf4] text-[#34c759]'
                        : 'bg-white text-[#1d1d1f] hover:opacity-80'
                    }`}
                  >
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>

              <p className="text-[12px] text-[#6e6e73] text-center">
                학생이 QR코드를 스캔하면 로그인 후 바로 시험 화면으로 이동합니다
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
