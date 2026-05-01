/**
 * アプリケーションルーティング
 * React Router を使用してページ遷移を管理する（要件6.4, 9.3）
 */

import { useState, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { LastUpdatedDisplay } from './components/common/LastUpdatedDisplay';
import { ToastNotification } from './components/common/ToastNotification';
import { DateNavigator } from './components/schedule/DateNavigator';
import { SchedulePage } from './pages/SchedulePage';
import { MoviesPage } from './pages/MoviesPage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { TimelinePage } from './pages/TimelinePage';
import { WatchlistPage } from './pages/WatchlistPage';
import { triggerRefresh } from './api/client';
import { generateDateRangeFromToday } from './utils/scheduleUtils';

// ============================================================
// ナビゲーションバー
// ============================================================

interface Toast {
  type: 'success' | 'error';
  message: string;
}

/**
 * ナビゲーションバーコンポーネント
 * ウォッチリスト件数バッジと最終更新日時を表示する（要件6.4, 9.3）
 */
function NavBar() {
  const { state, setIsRefreshing, setLastUpdatedAt, triggerRefreshPages, setDate } = useAppContext();
  const { watchlist, lastUpdatedAt, isRefreshing } = state;

  // availableDates が空の場合は今日から14日間をフォールバックとして使用する（要件8.3, 8.4）
  const navDates = state.availableDates.length > 0
    ? state.availableDates
    : generateDateRangeFromToday();
  const [toast, setToast] = useState<Toast | null>(null);
  const location = useLocation();

  // 二重送信を確実に防ぐためのフラグ（Reactの状態とは別に管理）
  const isRefreshingRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      // 日付を指定せず今日のデータを更新する（選択中の日付に関わらず常に今日を更新）
      const { data, error } = await triggerRefresh();

      if (error) {
        setToast({ type: 'error', message: 'データの更新に失敗しました。' });
      } else if (data) {
        setLastUpdatedAt(data.data.updatedAt);
        triggerRefreshPages();
        setToast({ type: 'success', message: 'データを更新しました。' });
      }
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navItems = [
    { to: '/', label: 'スケジュール', icon: '📅' },
    { to: '/movies', label: '作品', icon: '🎬' },
    { to: '/timeline', label: 'タイムライン', icon: '⏱' },
    { to: '/watchlist', label: 'ウォッチリスト', icon: '⭐', badge: watchlist.length },
  ];

  return (
    <>
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* アプリ名 */}
          <h1 className="text-base font-bold text-gray-900 flex-shrink-0">
            🎥 シネマシティ
          </h1>

          {/* 最終更新日時（要件9.3） */}
          <div className="hidden sm:block flex-1">
            <LastUpdatedDisplay lastUpdatedAt={lastUpdatedAt} />
          </div>

          {/* 手動更新ボタン（要件9.4） */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
            aria-label={isRefreshing ? 'データ更新中...' : 'データを更新する'}
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">{isRefreshing ? '更新中...' : '更新'}</span>
          </button>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav
        className="bg-white border-b border-gray-200"
        aria-label="メインナビゲーション"
      >
        <div className="max-w-5xl mx-auto px-4">
          <ul className="flex" role="list">
            {navItems.map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`
                  }
                  aria-current={location.pathname === item.to ? 'page' : undefined}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  {/* ウォッチリスト件数バッジ（要件6.4） */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="ml-0.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full"
                      aria-label={`${item.badge}件`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* 日付ナビゲーター（全タブ共通・要件8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7） */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto py-2">
          <DateNavigator
            selectedDate={state.selectedDate}
            onDateChange={setDate}
            availableDates={navDates}
          />
        </div>
      </div>

      {/* トースト通知（要件9.4） */}
      {toast && (
        <ToastNotification
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

// ============================================================
// アプリケーションルート
// ============================================================

/**
 * ルーティング設定
 * `/`, `/movies`, `/movies/:id`, `/timeline`, `/watchlist` のルートを設定する
 */
function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <Routes>
        <Route path="/" element={<SchedulePage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/movies/:id" element={<MovieDetailPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
      </Routes>
    </div>
  );
}

/**
 * アプリケーションルートコンポーネント
 * AppProvider と BrowserRouter でアプリ全体をラップする
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
