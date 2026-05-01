/**
 * 作品一覧ページ
 * 上映ステータスフィルター・テキスト検索・ステータス順ソートで映画一覧を表示する（要件4.2〜4.5）
 * カードクリックでアコーディオン展開し、紹介文とスケジュール一覧を表示する
 */

import { useState, useEffect } from 'react';
import { MovieCard } from '../components/movies/MovieCard';
import { ScheduleCard } from '../components/schedule/ScheduleCard';
import { LoadingIndicator } from '../components/common/LoadingIndicator';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useAppContext } from '../store/AppContext';
import { fetchMovies, fetchMovieById, fetchMovieSchedules } from '../api/client';
import { filterByStatus, sortByStatus, searchMovies } from '../utils/movieUtils';
import type { Movie, Schedule, ShowingStatus } from '../types/index';

/** フィルタータブの定義 */
const FILTER_TABS: Array<{ value: ShowingStatus | 'all' | 'subtitle'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'showing', label: '上映中' },
  { value: 'upcoming', label: '上映予定' },
  { value: 'ending_soon', label: '終了間近' },
  { value: 'subtitle', label: '字幕' },
];

/** 展開中の映画の詳細データ */
interface ExpandedMovieData {
  description: string | undefined;
  schedules: Schedule[];
  isLoading: boolean;
  error: string | null;
}

/**
 * 作品一覧ページ
 */
export function MoviesPage() {
  const { state, addToWatchlist, removeFromWatchlist } = useAppContext();
  const { watchlist } = state;

  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ShowingStatus | 'all' | 'subtitle'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  /** 展開中の映画ID */
  const [expandedMovieId, setExpandedMovieId] = useState<string | null>(null);
  /** 展開中の映画の詳細データキャッシュ */
  const [expandedDataCache, setExpandedDataCache] = useState<Record<string, ExpandedMovieData>>({});

  // 映画一覧を取得する
  useEffect(() => {
    let cancelled = false;

    async function loadMovies() {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await fetchMovies();

      if (cancelled) return;

      if (error) {
        setErrorMessage(error.message ?? 'データの取得に失敗しました。');
      } else if (data) {
        setAllMovies(data.data);
      }

      setIsLoading(false);
    }

    loadMovies();
    return () => { cancelled = true; };
  }, []);

  // フィルタリングとソートを適用する（要件4.2, 4.3, 4.5）
  const filteredMovies = (() => {
    let movies = allMovies;

    // ステータスフィルター（要件4.2）
    if (activeFilter === 'subtitle') {
      movies = movies.filter(m => m.hasSubtitle);
    } else if (activeFilter !== 'all') {
      movies = filterByStatus(movies, activeFilter);
    }

    // テキスト検索（要件4.5）
    if (searchQuery.trim()) {
      movies = searchMovies(movies, searchQuery);
    }

    // ステータス順ソート（要件4.3）
    return sortByStatus(movies);
  })();

  const handleWatchlistToggle = (movieId: string) => {
    if (watchlist.includes(movieId)) {
      removeFromWatchlist(movieId);
    } else {
      addToWatchlist(movieId);
    }
  };

  /** 映画カードのクリックハンドラー: アコーディオン展開 */
  async function handleMovieClick(movieId: string) {
    // 同じカードをクリックしたら閉じる
    if (expandedMovieId === movieId) {
      setExpandedMovieId(null);
      return;
    }

    setExpandedMovieId(movieId);

    // キャッシュ済みの場合はスキップ
    if (expandedDataCache[movieId]) return;

    // ローディング状態をセット
    setExpandedDataCache(prev => ({
      ...prev,
      [movieId]: { description: undefined, schedules: [], isLoading: true, error: null },
    }));

    // 映画詳細とスケジュールを並行取得する
    const [movieResult, schedulesResult] = await Promise.all([
      fetchMovieById(movieId),
      fetchMovieSchedules(movieId),
    ]);

    const description = movieResult.data?.data.description;
    const schedules = schedulesResult.data?.data ?? [];
    const error = movieResult.error?.message ?? schedulesResult.error?.message ?? null;

    setExpandedDataCache(prev => ({
      ...prev,
      [movieId]: { description, schedules, isLoading: false, error },
    }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* フィルターとサーチバー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-3">
          {/* ステータスフィルタータブ（要件4.2） */}
          <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="上映ステータスフィルター">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeFilter === tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  activeFilter === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* テキスト検索（要件4.5） */}
          <div className="relative">
            <label htmlFor="movie-search" className="sr-only">映画タイトルで検索</label>
            <input
              id="movie-search"
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="映画タイトルで検索..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading && <LoadingIndicator message="作品情報を読み込み中..." />}

        {!isLoading && errorMessage && (
          <ErrorMessage message={errorMessage} />
        )}

        {!isLoading && !errorMessage && filteredMovies.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? '検索条件に一致する作品が見つかりませんでした' : '作品情報がありません'}
            </p>
          </div>
        )}

        {!isLoading && !errorMessage && filteredMovies.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">{filteredMovies.length}件</p>
            <div className="space-y-3">
              {filteredMovies.map(movie => {
                const isExpanded = expandedMovieId === movie.id;
                const expandedData = expandedDataCache[movie.id];

                return (
                  <div key={movie.id}>
                    {/* カードヘッダー（クリックでアコーディオン展開） */}
                    <div
                      onClick={() => handleMovieClick(movie.id)}
                      onKeyDown={e => e.key === 'Enter' && handleMovieClick(movie.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      aria-label={`${movie.title}の詳細を${isExpanded ? '閉じる' : '表示'}`}
                      className={`cursor-pointer rounded-lg border transition-shadow ${
                        isExpanded
                          ? 'border-blue-400 shadow-md rounded-b-none'
                          : 'border-gray-200 hover:shadow-md hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 p-1">
                        <div className="flex-1 min-w-0">
                          <MovieCard
                            movie={movie}
                            isWatchlisted={watchlist.includes(movie.id)}
                            onWatchlistToggle={(movieId: string) => {
                              handleWatchlistToggle(movieId);
                            }}
                          />
                        </div>
                        {/* 展開インジケーター */}
                        <div className="flex-shrink-0 pt-4 pr-3">
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* アコーディオン展開コンテンツ */}
                    {isExpanded && (
                      <div className="border border-t-0 border-blue-400 rounded-b-lg bg-white px-4 pb-4 pt-3">
                        {/* ローディング */}
                        {expandedData?.isLoading && (
                          <LoadingIndicator message="詳細情報を読み込み中..." />
                        )}

                        {/* エラー */}
                        {!expandedData?.isLoading && expandedData?.error && (
                          <p className="text-sm text-red-600">{expandedData.error}</p>
                        )}

                        {/* 作品紹介 */}
                        {!expandedData?.isLoading && !expandedData?.error && expandedData?.description && (
                          <section className="mb-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-1">作品紹介</h3>
                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                              {expandedData.description}
                            </p>
                          </section>
                        )}

                        {/* スケジュール一覧 */}
                        {!expandedData?.isLoading && !expandedData?.error && (
                          <section>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">上映スケジュール</h3>
                            {expandedData?.schedules.length === 0 ? (
                              <p className="text-sm text-gray-500">スケジュール情報がありません</p>
                            ) : (
                              <SchedulesByDate schedules={expandedData?.schedules ?? []} />
                            )}
                          </section>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** 日付別スケジュール表示コンポーネント */
function SchedulesByDate({ schedules }: { schedules: Schedule[] }) {
  const schedulesByDate = schedules.reduce<Record<string, Schedule[]>>((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date]!.push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(schedulesByDate).sort();

  return (
    <div className="space-y-4">
      {sortedDates.map(date => (
        <div key={date}>
          <p className="text-xs font-medium text-gray-500 mb-2">{date}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {schedulesByDate[date]!.map(schedule => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
