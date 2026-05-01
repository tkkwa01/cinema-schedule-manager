/**
 * フロントエンド共通型定義
 * バックエンドと共通の型およびフロントエンド固有の型をエクスポートする
 */

// ============================================================
// バックエンドと共通の基本型
// ============================================================

/** 上映ステータス: 上映中・上映予定・終了間近 */
export type ShowingStatus = 'showing' | 'upcoming' | 'ending_soon';

/** 劇場: シネマ・ワンまたはシネマ・ツー */
export type Theater = 'cinema-one' | 'cinema-two';

/** 上映フォーマット: 通常・極音・極爆またはその他の文字列 */
export type Format = '通常' | '極音' | '極爆' | string;

// ============================================================
// バックエンドと共通のエンティティ型
// ============================================================

/** 映画作品 */
export interface Movie {
  /** 公式サイトの映画ID */
  id: string;
  /** 映画タイトル */
  title: string;
  /** 上映ステータス */
  status: ShowingStatus;
  /** 日本語字幕フラグ */
  hasSubtitle: boolean;
  /** 上映フォーマット一覧 */
  formats: Format[];
  /** 映画詳細ページURL（任意） */
  detailUrl?: string;
  /** 作品紹介文（任意） */
  description?: string;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
}

/** 上映スケジュール */
export interface Schedule {
  /** スケジュールID（自動採番） */
  id: number;
  /** 映画ID */
  movieId: string;
  /** 映画タイトル（非正規化） */
  movieTitle: string;
  /** 上映日（YYYY-MM-DD形式） */
  date: string;
  /** 劇場 */
  theater: Theater;
  /** スタジオ名（例: a studio, b studio） */
  studio: string;
  /** 上映開始時刻（HH:MM形式） */
  startTime: string;
  /** 上映終了時刻（HH:MM形式） */
  endTime: string;
  /** 上映フォーマット */
  format: Format;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
}

// ============================================================
// フロントエンド固有の型
// ============================================================

/** アプリケーションのグローバル状態 */
export interface AppState {
  selectedDate: string;
  selectedTheater: Theater;
  watchlist: string[];
  lastUpdatedAt: string | null;
  isRefreshing: boolean;
  refreshTrigger: number;
  schedulesCache: Record<string, Schedule[]>;
  /** サイトで利用可能な日付一覧 */
  availableDates: string[];
  /** 非同期初期化が完了したかどうか */
  isInitialized: boolean;
}

/** エラー状態 */
export interface ErrorState {
  /** エラーの種類（エラーなしの場合はnull） */
  type: 'network' | 'server' | 'not_found' | null;
  /** エラーメッセージ（エラーなしの場合はnull） */
  message: string | null;
  /** 再試行可能かどうか */
  retryable: boolean;
}
