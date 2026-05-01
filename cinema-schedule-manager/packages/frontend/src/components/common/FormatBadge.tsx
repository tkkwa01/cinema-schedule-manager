/**
 * フォーマットバッジコンポーネント
 * 通常・極音・極爆の上映フォーマットを色分けバッジで表示する（要件4.4）
 */

interface FormatBadgeProps {
  /** 上映フォーマット */
  format: string;
}

/**
 * フォーマットに対応するスタイルクラスを返す
 */
function getFormatStyle(format: string): string {
  switch (format) {
    case '極音':
      return 'bg-purple-100 text-purple-800 border border-purple-300';
    case '極爆':
      return 'bg-red-100 text-red-800 border border-red-300';
    case '通常':
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-300';
  }
}

/**
 * フォーマットバッジ
 * 上映フォーマットを視覚的に区別できるバッジで表示する
 */
export function FormatBadge({ format }: FormatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getFormatStyle(format)}`}
      aria-label={`上映フォーマット: ${format}`}
    >
      {format}
    </span>
  );
}
