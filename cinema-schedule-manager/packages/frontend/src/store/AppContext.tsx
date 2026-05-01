/**
 * グローバル状態管理モジュール
 * React Context + useReducer を使用してアプリケーション全体の状態を管理する
 */

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, Theater, Schedule } from '../types/index';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../utils/watchlistUtils';

// ============================================================
// アクション型定義
// ============================================================

type AppAction =
  | { type: 'SET_DATE'; payload: string }
  | { type: 'SET_THEATER'; payload: Theater }
  | { type: 'ADD_TO_WATCHLIST'; payload: string }
  | { type: 'REMOVE_FROM_WATCHLIST'; payload: string }
  | { type: 'SET_WATCHLIST'; payload: string[] }
  | { type: 'SET_LAST_UPDATED_AT'; payload: string | null }
  | { type: 'SET_IS_REFRESHING'; payload: boolean }
  | { type: 'INCREMENT_REFRESH_TRIGGER' }
  | { type: 'SET_SCHEDULES'; payload: { date: string; schedules: Schedule[] } }
  | { type: 'SET_AVAILABLE_DATES'; payload: string[] }
  | { type: 'SET_INITIALIZED'; payload: boolean };

// ============================================================
// 初期状態
// ============================================================

/** 今日の日付を YYYY-MM-DD 形式で取得する（ローカル時刻基準） */
function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** アプリケーションの初期状態 */
const initialState: AppState = {
  selectedDate: getTodayString(),
  selectedTheater: 'cinema-one',
  watchlist: [],
  lastUpdatedAt: null,
  isRefreshing: false,
  refreshTrigger: 0,
  schedulesCache: {},
  availableDates: [],
  isInitialized: false,
};

// ============================================================
// リデューサー
// ============================================================

/**
 * アプリケーション状態のリデューサー
 * @param state 現在の状態
 * @param action ディスパッチされたアクション
 * @returns 新しい状態
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, selectedDate: action.payload };

    case 'SET_THEATER':
      return { ...state, selectedTheater: action.payload };

    case 'ADD_TO_WATCHLIST': {
      // 重複を防ぐ
      if (state.watchlist.includes(action.payload)) return state;
      return { ...state, watchlist: [...state.watchlist, action.payload] };
    }

    case 'REMOVE_FROM_WATCHLIST':
      return {
        ...state,
        watchlist: state.watchlist.filter(id => id !== action.payload),
      };

    case 'SET_WATCHLIST':
      return { ...state, watchlist: action.payload };

    case 'SET_LAST_UPDATED_AT':
      return { ...state, lastUpdatedAt: action.payload };

    case 'SET_IS_REFRESHING':
      return { ...state, isRefreshing: action.payload };

    case 'INCREMENT_REFRESH_TRIGGER':
      return { ...state, refreshTrigger: state.refreshTrigger + 1 };

    case 'SET_SCHEDULES':
      return {
        ...state,
        schedulesCache: {
          ...state.schedulesCache,
          [action.payload.date]: action.payload.schedules,
        },
      };

    case 'SET_AVAILABLE_DATES':
      return { ...state, availableDates: action.payload };

    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };

    default:
      return state;
  }
}

// ============================================================
// コンテキスト
// ============================================================

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  setDate: (date: string) => void;
  setTheater: (theater: Theater) => void;
  addToWatchlist: (movieId: string) => void;
  removeFromWatchlist: (movieId: string) => void;
  setLastUpdatedAt: (date: string | null) => void;
  setIsRefreshing: (isRefreshing: boolean) => void;
  triggerRefreshPages: () => void;
  setSchedules: (date: string, schedules: Schedule[]) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ============================================================
// プロバイダー
// ============================================================

interface AppProviderProps {
  children: ReactNode;
}

/**
 * アプリケーション状態プロバイダー
 * ウォッチリストのローカルストレージ同期を行う
 */
export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // ============================================================
  // ローカルストレージとの同期
  // ============================================================

  // 初期化時にローカルストレージからウォッチリストを読み込む（要件6.1, 6.3）
  useEffect(() => {
    const savedWatchlist = getWatchlist();
    dispatch({ type: 'SET_WATCHLIST', payload: savedWatchlist });
  }, []);

  // 起動時に利用可能な日付一覧を取得してスケジュールを自動取得する
  useEffect(() => {
    async function initialLoad() {
      try {
        const { fetchAvailableDates } = await import('../api/client');
        const dates = await fetchAvailableDates();
        if (dates.length > 0) {
          dispatch({ type: 'SET_AVAILABLE_DATES', payload: dates });
          // 最初の日付を選択する
          dispatch({ type: 'SET_DATE', payload: dates[0]! });
          dispatch({ type: 'INCREMENT_REFRESH_TRIGGER' });
        }
      } catch {
        // 失敗は無視する
      } finally {
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      }
    }
    initialLoad();
  }, []);

  // 起動時に自動でスクレイピングを実行して実際の日付に移動する
  useEffect(() => {
    async function initialFetch() {
      try {
        const { triggerRefresh } = await import('../api/client');
        const { data } = await triggerRefresh();
        if (data?.data.actualDate) {
          dispatch({ type: 'SET_DATE', payload: data.data.actualDate });
          dispatch({ type: 'INCREMENT_REFRESH_TRIGGER' });
          if (data.data.updatedAt) {
            dispatch({ type: 'SET_LAST_UPDATED_AT', payload: data.data.updatedAt });
          }
        }
      } catch {
        // 起動時スクレイピング失敗は無視する
      }
    }
    initialFetch();
  }, []); // 初回のみ実行
  // ============================================================
  // アクションヘルパー
  // ============================================================

  const contextValue: AppContextValue = {
    state,
    dispatch,

    setDate: (date: string) => {
      dispatch({ type: 'SET_DATE', payload: date });
    },

    setTheater: (theater: Theater) => {
      dispatch({ type: 'SET_THEATER', payload: theater });
    },

    addToWatchlist: (movieId: string) => {
      // ローカルストレージに保存する（要件6.1）
      addToWatchlist(movieId);
      dispatch({ type: 'ADD_TO_WATCHLIST', payload: movieId });
    },

    removeFromWatchlist: (movieId: string) => {
      // ローカルストレージから削除する（要件6.3）
      removeFromWatchlist(movieId);
      dispatch({ type: 'REMOVE_FROM_WATCHLIST', payload: movieId });
    },

    setLastUpdatedAt: (date: string | null) => {
      dispatch({ type: 'SET_LAST_UPDATED_AT', payload: date });
    },

    setIsRefreshing: (isRefreshing: boolean) => {
      dispatch({ type: 'SET_IS_REFRESHING', payload: isRefreshing });
    },

    triggerRefreshPages: () => {
      dispatch({ type: 'INCREMENT_REFRESH_TRIGGER' });
    },

    setSchedules: (date: string, schedules: Schedule[]) => {
      dispatch({ type: 'SET_SCHEDULES', payload: { date, schedules } });
    },
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// ============================================================
// カスタムフック
// ============================================================

/**
 * アプリケーション状態コンテキストを使用するカスタムフック
 * AppProvider の外で使用するとエラーをスローする
 */
export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext は AppProvider の内部で使用してください');
  }
  return context;
}
