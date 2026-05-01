/**
 * 作品詳細・スケジュールページ
 * 選択作品の全上映日程・時刻・スタジオ・フォーマットを一覧表示する（要件4.1）
 * fetchMovieById で単一映画を取得し、description フィールドを条件付き表示する（要件6.1〜6.5）
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ScheduleCard } from '../components/schedule/ScheduleCard';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { fetchMovieById, fetchMovieSchedules } from '../api/client';
import type { Schedule, Movie } from '../types/index';

/**
 * 作品詳細・スケジュールページ
 */
export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [movie, setMovie] = useState<Movie | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      // 映画詳細情報とスケジュールを並行取得する（要件6.1）
      const [movieResult, schedulesResult] = await Promise.all([
        fetchMovieById(id as string),
        fetchMovieSchedules(id as string),
      ]);

      if (cancelled) return;

      // 映画詳細の取得結果を処理する（要件6.4, 6.5）
      if (movieResult.error) {
        setErrorMessage(movieResult.error.message ?? '映画情報の取得に失敗しました。');
        setIsLoading(false);
        return;
      }
      if (movieResult.data) {
        setMovie(movieResult.data.data);
      }

      // スケジュールの取得結果を処理する
      if (schedulesResult.error) {
        setErrorMessage(schedulesResult.error.message ?? 'スケジュールの取得に失敗しました。');
      } else if (schedulesResult.data) {
        setSchedules(schedulesResult.data.data);
      }

      setIsLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, [id]);

  // 日付別にスケジュールをグループ化する
  const schedulesByDate = schedules.reduce<Record<string, Schedule[]>>((acc, schedule) => {
    if (!acc[schedule.date]) acc[schedule.date] = [];
    acc[schedule.date]!.push(schedule);
    return acc;
  }, {});

  const sortedDates = Object.keys(schedulesByDate).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="前のページに戻る"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            戻る
          </button>
          {movie && (
            <h1 className="text-xl font-bold text-gray-900">{movie.title}</h1>
          )}
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading && <LoadingIndicator message="スケジュールを読み込み中..." />}

        {!isLoading && errorMessage && (
          <ErrorMessage message={errorMessage} />
        )}

        {/* 作品紹介セクション: description が空でない文字列の場合のみ表示する（要件6.2, 6.3） */}
        {!isLoading && !errorMessage && movie?.description && (
          <section
            aria-labelledby="movie-description-heading"
            className="mb-6 bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
          >
            <h2
              id="movie-description-heading"
              className="text-base font-semibold text-gray-700 mb-2"
            >
              作品紹介
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {movie.description}
            </p>
          </section>
        )}

        {!isLoading && !errorMessage && schedules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">この作品のスケジュール情報がありません</p>
          </div>
        )}

        {!isLoading && !errorMessage && schedules.length > 0 && (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <section key={date} aria-labelledby={`date-${date}`}>
                <h2
                  id={`date-${date}`}
                  className="text-base font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-200"
                >
                  {date}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {schedulesByDate[date]!.map(schedule => (
                    <ScheduleCard key={schedule.id} schedule={schedule} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
