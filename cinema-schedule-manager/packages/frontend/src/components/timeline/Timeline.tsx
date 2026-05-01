/**
 * タイムラインコンポーネント
 * 横軸を時刻・縦軸をスタジオとしたガントチャート形式のタイムラインを表示する（要件5.1〜5.4）
 */

import { useState } from 'react';
import { calculateBlockWidth, calculateBlockLeft, timeToMinutes } from '../../utils/scheduleUtils';
import type { Schedule, Theater } from '../../types/index';

interface TimelineProps {
  /** 表示する劇場 */
  theater: Theater;
  /** 表示する日付（YYYY-MM-DD形式） */
  date: string;
  /** スケジュールの配列 */
  schedules: Schedule[];
  /** ブロッククリック時のコールバック */
  onBlockClick: (schedule: Schedule) => void;
}

/** タイムラインの開始時刻（開館時間） */
const TIMELINE_START = '09:00';
/** タイムラインの終了時刻（閉館時間） */
const TIMELINE_END = '24:00';
/** タイムライン全体の時間（分） */
const TIMELINE_TOTAL_MINUTES =
  (timeToMinutes(TIMELINE_END) ?? 1440) - (timeToMinutes(TIMELINE_START) ?? 540);

/** フォーマットに対応するブロックの色 */
function getFormatColor(format: string): string {
  switch (format) {
    case '極音':
      return 'bg-purple-500 hover:bg-purple-600 border-purple-600';
    case '極爆':
      return 'bg-red-500 hover:bg-red-600 border-red-600';
    default:
      return 'bg-blue-500 hover:bg-blue-600 border-blue-600';
  }
}

/** 時刻ラベルを生成する（1時間ごと） */
function generateTimeLabels(): string[] {
  const labels: string[] = [];
  const startMinutes = timeToMinutes(TIMELINE_START) ?? 540;
  const endMinutes = timeToMinutes(TIMELINE_END) ?? 1440;

  for (let m = startMinutes; m <= endMinutes; m += 60) {
    const h = Math.floor(m / 60) % 24;
    labels.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return labels;
}

/**
 * タイムラインコンポーネント
 * ガントチャート形式で上映スケジュールを表示する
 */
export function Timeline({ theater, date: _date, schedules, onBlockClick }: TimelineProps) {
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // 劇場でフィルタリングしてスタジオ別にグループ化する
  const theaterSchedules = schedules.filter(s => s.theater === theater);
  const studios = [...new Set(theaterSchedules.map(s => s.studio))].sort();

  const timeLabels = generateTimeLabels();

  const handleBlockClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    onBlockClick(schedule);
  };

  const closePopup = () => setSelectedSchedule(null);

  if (theaterSchedules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">この日付のスケジュールはまだ取得されていません</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* タイムライングリッド */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: '800px' }}>
          {/* 時刻ヘッダー */}
          <div className="flex border-b border-gray-200 mb-1">
            {/* スタジオ名列のスペース */}
            <div className="w-24 flex-shrink-0" aria-hidden="true" />
            {/* 時刻ラベル */}
            <div className="flex-1 relative h-6">
              {timeLabels.map((label, i) => (
                <span
                  key={label}
                  className="absolute text-xs text-gray-500 -translate-x-1/2"
                  style={{ left: `${(i / (timeLabels.length - 1)) * 100}%` }}
                  aria-hidden="true"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* スタジオ行 */}
          {studios.map(studio => {
            const studioSchedules = theaterSchedules.filter(s => s.studio === studio);

            return (
              <div key={studio} className="flex items-center mb-2 min-h-[40px]">
                {/* スタジオ名 */}
                <div
                  className="w-24 flex-shrink-0 text-xs text-gray-600 font-medium pr-2 text-right"
                  aria-label={`スタジオ: ${studio}`}
                >
                  {studio}
                </div>

                {/* タイムラインバー */}
                <div
                  className="flex-1 relative h-8 bg-gray-100 rounded"
                  role="row"
                  aria-label={`${studio}のタイムライン`}
                >
                  {studioSchedules.map(schedule => {
                    const left = calculateBlockLeft(
                      schedule.startTime,
                      TIMELINE_START,
                      TIMELINE_TOTAL_MINUTES
                    );
                    const width = calculateBlockWidth(
                      schedule.startTime,
                      schedule.endTime,
                      TIMELINE_TOTAL_MINUTES
                    );

                    if (width <= 0) return null;

                    return (
                      <button
                        key={schedule.id}
                        onClick={() => handleBlockClick(schedule)}
                        className={`absolute top-0.5 bottom-0.5 rounded text-white text-xs font-medium overflow-hidden border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${getFormatColor(schedule.format)}`}
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 1)}%`,
                        }}
                        aria-label={`${schedule.movieTitle} ${schedule.startTime}〜${schedule.endTime} ${schedule.format}`}
                        title={`${schedule.movieTitle} (${schedule.startTime}〜${schedule.endTime})`}
                      >
                        <span className="px-1 truncate block">
                          {schedule.movieTitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ポップアップ（要件5.4） */}
      {selectedSchedule && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedSchedule.movieTitle}の詳細`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closePopup}
        >
          {/* オーバーレイ */}
          <div className="absolute inset-0 bg-black bg-opacity-40" aria-hidden="true" />

          {/* ポップアップカード */}
          <div
            className="relative bg-white rounded-xl shadow-xl p-5 max-w-sm w-full z-10"
            onClick={e => e.stopPropagation()}
          >
            {/* 閉じるボタン */}
            <button
              onClick={closePopup}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 映画タイトル */}
            <h3 className="text-base font-bold text-gray-900 mb-3 pr-6">
              {selectedSchedule.movieTitle}
            </h3>

            {/* 詳細情報 */}
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-16 flex-shrink-0">時刻</dt>
                <dd className="text-gray-900 font-medium">
                  {selectedSchedule.startTime}〜{selectedSchedule.endTime}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-16 flex-shrink-0">スタジオ</dt>
                <dd className="text-gray-900">{selectedSchedule.studio}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-16 flex-shrink-0">フォーマット</dt>
                <dd className="text-gray-900">{selectedSchedule.format}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
