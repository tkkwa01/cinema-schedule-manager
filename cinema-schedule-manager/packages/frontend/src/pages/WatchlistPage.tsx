/**
 * ウォッチリストページ
 * ウォッチリスト登録済み映画の最新上映スケジュールを一覧表示する（要件6.2, 6.3）
 */

import { useState, useEffect } from 'react';
import { ScheduleCard } from '../components/schedule/ScheduleCard';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAppContext } from '../store/AppContext';
import { fetchSchedules, fetchMovies } from '../api/client';
import { filterByWatchlist } from '../utils/watchlistUtils';
import type { Schedule, Movie } from '../types/index';

/**
 * ウォッチリストページ
 */
export function WatchlistPage() {
  const { state, removeFromWatchlist } = useAppContext();
  const { watchlist, selectedDate } = state;

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 映画一覧を取得してタイトル補完に使用する（要件2.8, 2.9）
  useEffect(() => {
    async function loadMovies() {
      const { data } = await fetchMovies();
      if (data) setMovies(data.data);
    }
    loadMovies();
  }, []);

  useEffect(() => {
    if (watchlist.length === 0) {
      setSchedules([]);
      return;
    }

    let cancelled = false;

    async function loadSchedules() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await fetchSchedules(selectedDate);

      if (cancelled) return;

      if (error && error.type !== 'not_found') {
        setErrorMessage(error.message ?? 'データの取得に失敗しました。');
        setSchedules([]);
      } else if (data) {
        // ウォッチリストに登録された映画のスケジュールのみを表示する（要件6.2）
        const filtered = filterByWatchlist(watchlist, data.data);
        setSchedules(filtered);
      } else {
        setSchedules([]);
      }

      setIsLoading(false);
    }

    loadSchedules();
    return () => { cancelled = true; };
  }, [watchlist, selectedDate]);

  // ウォッチリストに登録された映画IDごとにスケジュールをグループ化する
  const schedulesByMovie = schedules.reduce<Record<string, Schedule[]>>((acc, schedule) => {
    if (!acc[schedule.movieId]) acc[schedule.movieId] = [];
    acc[schedule.movieId]!.push(schedule);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">ウォッチリスト</h1>
          <p className="text-sm text-gray-500 mt-1">
            {watchlist.length}件の映画を登録中
          </p>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ウォッチリストが空の場合 */}
        {watchlist.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">ウォッチリストに映画が登録されていません</p>
            <p className="text-sm text-gray-400 mt-2">
              作品一覧ページから気になる映画を追加してください
            </p>
          </div>
        )}

        {isLoading && <LoadingIndicator message="スケジュールを読み込み中..." />}

        {!isLoading && errorMessage && (
          <ErrorMessage message={errorMessage} />
        )}

        {/* ウォッチリスト映画のスケジュール一覧 */}
        {!isLoading && !errorMessage && watchlist.length > 0 && (
          <div className="space-y-6">
            {watchlist.map(movieId => {
              const movieSchedules = schedulesByMovie[movieId] ?? [];
              // スケジュールからタイトルを取得できない場合は映画一覧から補完する（要件2.8, 2.9）
              const movieTitle =
                movieSchedules[0]?.movieTitle ??
                movies.find(m => m.id === movieId)?.title ??
                movieId;

              return (
                <section key={movieId} aria-labelledby={`movie-${movieId}`}>
                  {/* 映画タイトルと削除ボタン */}
                  <div className="flex items-center justify-between mb-3">
                    <h2
                      id={`movie-${movieId}`}
                      className="text-base font-semibold text-gray-900"
                    >
                      {movieTitle}
                    </h2>

                    {/* ウォッチリストから削除ボタン（要件6.3） */}
                    <button
                      onClick={() => removeFromWatchlist(movieId)}
                      className="text-sm text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
                      aria-label={`${movieTitle}をウォッチリストから削除`}
                    >
                      削除
                    </button>
                  </div>

                  {/* スケジュール一覧 */}
                  {movieSchedules.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {movieSchedules.map(schedule => (
                        <ScheduleCard key={schedule.id} schedule={schedule} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 py-2">
                      {selectedDate} のスケジュールはありません
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
