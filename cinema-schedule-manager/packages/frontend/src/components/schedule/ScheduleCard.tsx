/**
 * スケジュールカードコンポーネント
 * 映画タイトル・スタジオ名・開始時刻・終了時刻・上映フォーマットを表示する（要件3.3）
 */

import { FormatBadge } from '../common/FormatBadge';
import type { Schedule } from '../../types/index';

interface ScheduleCardProps {
  /** 表示するスケジュールデータ */
  schedule: Schedule;
  /** フォーマットバッジを表示するか（デフォルト: true） */
  showFormatBadge?: boolean;
}

/**
 * スケジュールカード
 * 1つの上映枠の情報をカード形式で表示する
 */
export function ScheduleCard({ schedule, showFormatBadge = true }: ScheduleCardProps) {
  return (
    <article
      className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow"
      aria-label={`${schedule.movieTitle} ${schedule.startTime}〜${schedule.endTime}`}
    >
      {/* 映画タイトルとフォーマットバッジ */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
          {schedule.movieTitle}
        </h3>
        {showFormatBadge && (
          <div className="flex-shrink-0">
            <FormatBadge format={schedule.format} />
          </div>
        )}
      </div>

      {/* スタジオ名 */}
      <p className="text-xs text-gray-500 mb-1">
        <span className="sr-only">スタジオ: </span>
        {schedule.studio}
      </p>

      {/* 上映時刻 */}
      <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
        <time dateTime={`${schedule.date}T${schedule.startTime}`}>
          {schedule.startTime}
        </time>
        <span aria-hidden="true">〜</span>
        <time dateTime={`${schedule.date}T${schedule.endTime}`}>
          {schedule.endTime}
        </time>
      </div>
    </article>
  );
}
