'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

export default function ExamQRButton({
  examId,
  examTitle,
}: {
  examId: string;
  examTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
        className="text-xs px-2.5 py-1 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
            {/* 헤더 */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">시험 입장 QR코드</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{examTitle}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-2"
              >
                ×
              </button>
            </div>

            {/* QR 코드 */}
            <div className="px-6 py-6 flex flex-col items-center gap-5">
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                {origin ? (
                  <QRCode value={examUrl} size={200} />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-xs text-gray-400">
                    로딩 중...
                  </div>
                )}
              </div>

              {/* URL */}
              <div className="w-full">
                <p className="text-xs font-medium text-gray-500 mb-1.5">시험 링크</p>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-xs text-gray-700 flex-1 break-all leading-relaxed">
                    {examUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    className={`text-xs font-medium shrink-0 px-2 py-1 rounded transition-colors ${
                      copied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-white text-blue-600 hover:bg-blue-50 border border-gray-200'
                    }`}
                  >
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 text-center">
                학생이 QR코드를 스캔하면 로그인 후 바로 시험 화면으로 이동합니다
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
