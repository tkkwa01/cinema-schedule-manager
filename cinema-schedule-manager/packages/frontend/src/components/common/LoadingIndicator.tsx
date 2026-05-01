/**
 * ローディングインジケーターコンポーネント
 * データ取得中に表示するスピナー（要件8.5）
 */

interface LoadingIndicatorProps {
  /** 表示するメッセージ（省略時はデフォルトメッセージ） */
  message?: string;
}

/**
 * ローディングインジケーター
 * データ取得中にスピナーとメッセージを表示する
 */
export function LoadingIndicator({ message = 'データを読み込み中...' }: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className="flex flex-col items-center justify-center py-12"
    >
      {/* スピナー */}
      <div
        className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
        aria-hidden="true"
      />
      {/* メッセージ */}
      <p className="mt-4 text-gray-600 text-sm">{message}</p>
    </div>
  );
}
