/**
 * トースト通知コンポーネント
 * 手動更新の成功/失敗通知を表示する（要件9.4）
 */

import { useEffect } from 'react';

type ToastType = 'success' | 'error';

interface ToastNotificationProps {
  /** 通知の種類 */
  type: ToastType;
  /** 通知メッセージ */
  message: string;
  /** 通知を閉じるコールバック */
  onClose: () => void;
  /** 自動的に閉じるまでの時間（ミリ秒）。デフォルト3000ms */
  duration?: number;
}

/**
 * トースト通知
 * 画面右下に一時的に表示される通知コンポーネント
 */
export function ToastNotification({
  type,
  message,
  onClose,
  duration = 3000,
}: ToastNotificationProps) {
  // 指定時間後に自動的に閉じる
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const isSuccess = type === 'success';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white z-50 max-w-sm ${
        isSuccess ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {/* アイコン */}
      <span aria-hidden="true" className="flex-shrink-0">
        {isSuccess ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </span>

      {/* メッセージ */}
      <p className="text-sm flex-1">{message}</p>

      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1 rounded"
        aria-label="通知を閉じる"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
