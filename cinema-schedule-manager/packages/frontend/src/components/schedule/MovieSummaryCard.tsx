/**
 * 映画サマリーカードコンポーネント
 * 同一映画の複数上映回を1枚のカードに統合して表示する（要件1.2, 1.3, 1.4, 1.6, 1.7, 1.8）
 * クリックでアコーディオン展開し、詳細コンテンツを表示する
 */

import { FormatBadge } from '../common/FormatBadge';

interface MovieSummaryCardProps {
  /** 映画ID（nullの場合はクリック無効） */
  movieId: string | null;
  /** 映画タイトル */
  title: string;
  /** 上映フォーマット一覧（重複除去済み） */
  formats: string[];
  /** 上映時刻一覧（開始時刻のみ） */
  startTimes: string[];
  /** 展開状態 */
  isExpanded?: boolean;
  /** クリック時のコールバック */
  onClick?: (movieId: string, title: string) => void;
  /** 展開時に表示するコンテンツ */
  children?: React.ReactNode;
}

/**
 * 映画サマリーカード
 * 1作品の全上映回をまとめてカード形式で表示する。
 * クリックでアコーディオン展開し、詳細コンテンツを表示する。
 */
export function MovieSummaryCard({
  movieId,
  title,
  formats,
  startTimes,
  isExpanded = false,
  onClick,
  children,
}: MovieSummaryCardProps) {
  /** クリック可能かどうか（onClick が渡されている場合は常にクリック可能） */
  const isClickable = onClick !== undefined;

  /** クリックハンドラー */
  const handleClick = () => {
    if (onClick) {
      onClick(movieId ?? '', title);
    }
  };

  /** キーボード操作ハンドラー（Enter キーでクリックと同等の動作を行う） */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && onClick) {
      onClick(movieId ?? '', title);
    }
  };

  return (
    <article
      className={`bg-white rounded-lg border transition-shadow ${
        isExpanded
          ? 'border-blue-400 shadow-md'
          : 'border-gray-200'
      } ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : 'cursor-default'}`}
    >
      {/* カードヘッダー（クリック可能エリア） */}
      <div
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? handleClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        aria-expanded={isClickable ? isExpanded : undefined}
        aria-label={isClickable ? `${title} の詳細を${isExpanded ? '閉じる' : '表示'}` : title}
        className="p-4"
      >
        {/* 映画タイトルとフォーマットバッジ */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">
            {title}
          </h3>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* フォーマットバッジ一覧（要件1.3） */}
            {formats.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formats.map((format) => (
                  <FormatBadge key={format} format={format} />
                ))}
              </div>
            )}

            {/* 展開インジケーター */}
            {isClickable && (
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>

        {/* 上映時刻一覧（要件1.4） */}
        {startTimes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {startTimes.map((time) => (
              <span
                key={time}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
              >
                <time>{time}</time>
              </span>
            ))}
          </div>
        )}

        {/* 上映時刻が存在しない場合のフォールバック表示 */}
        {startTimes.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">上映時刻なし</p>
        )}
      </div>

      {/* アコーディオン展開コンテンツ */}
      {isExpanded && children && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </article>
  );
}
