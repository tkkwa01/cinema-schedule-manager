/**
 * 最終更新日時表示コンポーネント
 * データが最後に更新された日時を画面上に表示する（要件9.3）
 */

interface LastUpdatedDisplayProps {
  /** 最終更新日時（ISO 8601形式）。null の場合は「未取得」を表示 */
  lastUpdatedAt: string | null;
}

/**
 * ISO 8601形式の日時文字列を日本語表示用にフォーマットする
 */
function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '不明';

    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '不明';
  }
}

/**
 * 最終更新日時表示
 * ナビゲーションバーなどに配置して最終更新日時を表示する
 */
export function LastUpdatedDisplay({ lastUpdatedAt }: LastUpdatedDisplayProps) {
  return (
    <div
      className="text-xs text-gray-500"
      aria-label={lastUpdatedAt ? `最終更新: ${formatDateTime(lastUpdatedAt)}` : '最終更新: 未取得'}
    >
      <span aria-hidden="true">最終更新: </span>
      <time
        dateTime={lastUpdatedAt ?? undefined}
        className="font-medium"
      >
        {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '未取得'}
      </time>
    </div>
  );
}
