/**
 * エラーメッセージコンポーネント
 * ネットワークエラー・データなしメッセージを表示する（要件9.1）
 */

interface ErrorMessageProps {
  /** エラーメッセージ */
  message: string;
  /** 再試行ボタンのコールバック（省略時はボタン非表示） */
  onRetry?: () => void;
}

/**
 * エラーメッセージ
 * エラー内容と再試行ボタンを表示する
 */
export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {/* エラーアイコン */}
      <div
        className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4"
        aria-hidden="true"
      >
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* エラーメッセージ */}
      <p className="text-gray-700 text-center max-w-md">{message}</p>

      {/* 再試行ボタン */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          aria-label="データを再取得する"
        >
          再試行
        </button>
      )}
    </div>
  );
}
