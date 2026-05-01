/**
 * タイムライン表示ページ
 * シネマ・ワンとシネマ・ツーを切り替えるタブ付きのタイムラインを表示する（要件5.5）
 */

import { useState, useEffect } from 'react';
import { Timeline } from '../components/timeline/Timeline';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAppContext } from '../store/AppContext';
import { fetchSchedules } from '../api/client';
import type { Schedule, Theater } from '../types/index';

/** 劇場タブの定義 */
const THEATER_TABS: Array<{ value: Theater; label: string }> = [
  { value: 'cinema-one', label: 'シネマ・ワン' },
  { value: 'cinema-two', label: 'シネマ・ツー' },
];

/**
 * タイムライン表示ページ
 */
export function TimelinePage() {
  const { state, setLastUpdatedAt } = useAppContext();
  const { selectedDate, isInitialized } = state;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTheater, setActiveTheater] = useState<Theater>('cinema-one');

  useEffect(() => {
    if (!isInitialized) return;  // 初期化完了前はスキップ

    let cancelled = false;

    async function loadSchedules() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await fetchSchedules(selectedDate);

      if (cancelled) return;

      if (error) {
        if (error.type !== 'not_found') {
          setErrorMessage(error.message ?? 'データの取得に失敗しました。');
        }
        setSchedules([]);
      } else if (data) {
        setSchedules(data.data);
        setLastUpdatedAt(data.lastUpdatedAt);
      }

      setIsLoading(false);
    }

    loadSchedules();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, isInitialized]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 劇場切り替えタブ（要件5.5） */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div
            role="tablist"
            aria-label="劇場切り替え"
            className="flex"
          >
            {THEATER_TABS.map(tab => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTheater === tab.value}
                aria-controls={`panel-${tab.value}`}
                onClick={() => setActiveTheater(tab.value)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  activeTheater === tab.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 選択中の日付表示 */}
        <p className="text-sm text-gray-500 mb-4">
          <time dateTime={selectedDate}>{selectedDate}</time> のタイムライン
        </p>

        {isLoading && <LoadingIndicator message="スケジュールを読み込み中..." />}

        {!isLoading && errorMessage && (
          <ErrorMessage message={errorMessage} />
        )}

        {!isLoading && !errorMessage && (
          <div
            id={`panel-${activeTheater}`}
            role="tabpanel"
            aria-label={`${activeTheater === 'cinema-one' ? 'シネマ・ワン' : 'シネマ・ツー'}のタイムライン`}
          >
            <Timeline
              theater={activeTheater}
              date={selectedDate}
              schedules={schedules}
              onBlockClick={() => {/* ポップアップはTimeline内で管理 */}}
            />
          </div>
        )}
      </main>
    </div>
  );
}
