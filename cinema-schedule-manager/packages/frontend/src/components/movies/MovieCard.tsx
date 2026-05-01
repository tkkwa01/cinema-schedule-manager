/**
 * 作品カードコンポーネント
 * 映画情報・お気に入りボタン・特殊フォーマットバッジを表示する（要件4.4, 6.1, 6.3）
 */

import { FormatBadge } from '../common/FormatBadge';
import type { Movie } from '../../types/index';

interface MovieCardProps {
  /** 表示する映画データ */
  movie: Movie;
  /** ウォッチリストに登録済みかどうか */
  isWatchlisted: boolean;
  /** ウォッチリスト追加/削除のコールバック */
  onWatchlistToggle: (movieId: string) => void;
}

/** 上映ステータスの表示名 */
const STATUS_LABELS: Record<string, string> = {
  showing: '上映中',
  upcoming: '上映予定',
  ending_soon: '終了間近',
};

/** 上映ステータスのスタイル */
const STATUS_STYLES: Record<string, string> = {
  showing: 'bg-green-100 text-green-800',
  upcoming: 'bg-blue-100 text-blue-800',
  ending_soon: 'bg-orange-100 text-orange-800',
};

/**
 * 作品カード
 * 映画情報をカード形式で表示し、ウォッチリスト操作ボタンを提供する
 */
export function MovieCard({ movie, isWatchlisted, onWatchlistToggle }: MovieCardProps) {
  const statusLabel = STATUS_LABELS[movie.status] ?? movie.status;
  const statusStyle = STATUS_STYLES[movie.status] ?? 'bg-gray-100 text-gray-800';

  // 特殊フォーマット（極音・極爆）を抽出する
  const specialFormats = movie.formats.filter(f => f === '極音' || f === '極爆');

  return (
    <article
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
      aria-label={movie.title}
    >
      {/* ヘッダー: タイトルとお気に入りボタン */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight">
          {movie.title}
        </h3>

        {/* お気に入りボタン（要件6.1, 6.3） */}
        <button
          onClick={() => onWatchlistToggle(movie.id)}
          aria-label={isWatchlisted ? `${movie.title}をウォッチリストから削除` : `${movie.title}をウォッチリストに追加`}
          aria-pressed={isWatchlisted}
          className={`flex-shrink-0 p-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
            isWatchlisted
              ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50'
              : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
          }`}
        >
          <svg
            className="w-5 h-5"
            fill={isWatchlisted ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      </div>

      {/* ステータスバッジ */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle}`}>
          {statusLabel}
        </span>

        {/* 日本語字幕バッジ */}
        {movie.hasSubtitle && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
            字幕
          </span>
        )}
      </div>

      {/* 特殊フォーマットバッジ（要件4.4） */}
      {specialFormats.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {specialFormats.map(format => (
            <FormatBadge key={format} format={format} />
          ))}
        </div>
      )}
    </article>
  );
}
