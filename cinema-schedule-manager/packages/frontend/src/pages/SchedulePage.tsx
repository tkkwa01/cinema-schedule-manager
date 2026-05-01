/**
 * 日付別スケジュールページ
 * 選択した日付のシネマ・ワンとシネマ・ツーの全上映スケジュールを作品単位で表示する（要件1.1〜1.8）
 * カードクリックでアコーディオン展開し、その日のスケジュール一覧を表示する
 */

import { useState, useEffect, useRef } from 'react';
import { MovieSummaryCard } from '../components/schedule/MovieSummaryCard';
import { ScheduleCard } from '../components/schedule/ScheduleCard';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAppContext } from '../store/AppContext';
import { fetchSchedules } from '../api/client';
import { groupByTheater, groupSchedulesByMovieId, generateDateRangeFromToday, sortByStartTime } from '../utils/scheduleUtils';
import type { Schedule } from '../types/index';

const THEATER_LABELS: Record<string, string> = {
  'cinema-one': 'シネマ・ワン',
  'cinema-two': 'シネマ・ツー',
};

export function SchedulePage() {
  const { state, setDate, setLastUpdatedAt, setSchedules, dispatch } = useAppContext();
  const { selectedDate, refreshTrigger, schedulesCache, availableDates } = state;

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** 展開中のカードキー（movieId__title の形式） */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const setLastUpdatedAtRef = useRef(setLastUpdatedAt);
  setLastUpdatedAtRef.current = setLastUpdatedAt;
  const setSchedulesRef = useRef(setSchedules);
  setSchedulesRef.current = setSchedules;

  // availableDates が空の場合は今日から14日間をフォールバックとして使用する
  const _navDates = availableDates.length > 0 ? availableDates : generateDateRangeFromToday();
  const cachedSchedules = schedulesCache[selectedDate] ?? null;

  // 日付が変わったら展開状態をリセットする
  useEffect(() => {
    setExpandedKey(null);
  }, [selectedDate]);

  useEffect(() => {
    if (cachedSchedules !== null && cachedSchedules.length > 0 && refreshTrigger === 0) {
      return;
    }

    let cancelled = false;

    async function loadSchedules() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await fetchSchedules(selectedDate);

      if (cancelled) return;

      if (error) {
        if (error.type === 'not_found') {
          const { triggerRefresh } = await import('../api/client');
          const refreshResult = await triggerRefresh(selectedDate);
          if (!cancelled && refreshResult.data) {
            const actualDate = refreshResult.data.data.actualDate;
            if (actualDate && actualDate !== selectedDate) {
              const { data: newData } = await fetchSchedules(actualDate);
              if (!cancelled && newData) {
                setSchedulesRef.current(actualDate, newData.data);
                setLastUpdatedAtRef.current(newData.lastUpdatedAt);
                dispatch({ type: 'SET_DATE', payload: actualDate });
              }
            } else {
              const { data: newData } = await fetchSchedules(selectedDate);
              if (!cancelled && newData) {
                setSchedulesRef.current(selectedDate, newData.data);
                setLastUpdatedAtRef.current(newData.lastUpdatedAt);
              }
            }
          }
        } else {
          setErrorMessage(error.message ?? 'データの取得に失敗しました。');
          setSchedulesRef.current(selectedDate, []);
        }
      } else if (data) {
        setSchedulesRef.current(selectedDate, data.data);
        if (data.lastUpdatedAt) {
          setLastUpdatedAtRef.current(data.lastUpdatedAt);
        }
      }

      setIsLoading(false);
    }

    loadSchedules();
    return () => { cancelled = true; };
  }, [selectedDate, refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedules = cachedSchedules ?? [];
  const grouped = groupByTheater(schedules);
  const hasSchedules = schedules.length > 0;

  /** カードのトグルキーを生成する（movieId + タイトルの組み合わせ） */
  function makeCardKey(movieId: string | null, title: string): string {
    return `${movieId ?? '__no_id__'}__${title}`;
  }

  /** カードクリック時のハンドラー */
  function handleCardClick(_movieId: string, title: string) {
    // _movieId は空文字列の場合もあるため title も使ってキーを作る
    const key = makeCardKey(_movieId || null, title);
    setExpandedKey(prev => (prev === key ? null : key));
  }

  /** 劇場のスケジュールを MovieSummaryCard で表示するコンポーネント（要件1.5） */
  function TheaterSection({ theaterId, theaterSchedules }: { theaterId: string; theaterSchedules: Schedule[] }) {
    if (theaterSchedules.length === 0) return null;

    // 同一 movieId + タイトルの上映回を1枚のカードに統合する（要件1.1）
    const movieSummaries = groupSchedulesByMovieId(theaterSchedules);

    return (
      <section aria-labelledby={`${theaterId}-heading`}>
        <h2 id={`${theaterId}-heading`} className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
          {THEATER_LABELS[theaterId] ?? theaterId}
        </h2>

        {/* 作品単位のカード一覧（要件1.2, 1.3, 1.4） */}
        <div className="space-y-3">
          {movieSummaries.map((summary) => {
            const cardKey = makeCardKey(summary.movieId, summary.title);
            const isExpanded = expandedKey === cardKey;

            // この作品の当日スケジュール（この劇場分）を取得する
            const cardSchedules = theaterSchedules.filter(
              s => s.movieTitle === summary.title
            );
            const sortedCardSchedules = sortByStartTime(cardSchedules);

            return (
              <MovieSummaryCard
                key={cardKey}
                movieId={summary.movieId}
                title={summary.title}
                formats={summary.formats}
                startTimes={summary.startTimes}
                isExpanded={isExpanded}
                onClick={handleCardClick}
              >
                {/* アコーディオン展開コンテンツ: スケジュール一覧 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sortedCardSchedules.map(schedule => (
                    <ScheduleCard key={schedule.id} schedule={schedule} />
                  ))}
                </div>
              </MovieSummaryCard>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-4">
        {isLoading && <LoadingIndicator message="スケジュールを読み込み中..." />}

        {!isLoading && errorMessage && (
          <ErrorMessage message={errorMessage} onRetry={() => setDate(selectedDate)} />
        )}

        {!isLoading && !errorMessage && !hasSchedules && (
          <div className="text-center py-12">
            <p className="text-gray-500">この日付のスケジュールはまだ取得されていません</p>
          </div>
        )}

        {!isLoading && !errorMessage && hasSchedules && (
          <div className="space-y-8">
            <TheaterSection theaterId="cinema-one" theaterSchedules={grouped['cinema-one']} />
            <TheaterSection theaterId="cinema-two" theaterSchedules={grouped['cinema-two']} />
          </div>
        )}
      </main>
    </div>
  );
}
