/**
 * APIクライアントモジュール
 * バックエンドAPIへのHTTPリクエストを管理する（要件9.1）
 */

import type { Schedule, Movie, ApiResponse, ErrorState } from '../types/index';

// ============================================================
// API ベースURL
// ============================================================

/** APIのベースURL（Viteのプロキシ設定により /api → localhost:3000/api に転送される） */
const API_BASE = '/api';

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * ネットワークエラー時の ErrorState を生成する（要件9.1）
 */
function networkError(message?: string): ErrorState {
  return {
    type: 'network',
    message: message ?? 'データの取得に失敗しました。しばらく後に再試行してください。',
    retryable: true,
  };
}

/**
 * サーバーエラー時の ErrorState を生成する
 */
function serverError(message?: string): ErrorState {
  return {
    type: 'server',
    message: message ?? 'サーバーエラーが発生しました。',
    retryable: true,
  };
}

/**
 * データなしエラー時の ErrorState を生成する
 */
function notFoundError(message?: string): ErrorState {
  return {
    type: 'not_found',
    message: message ?? 'データが見つかりませんでした。',
    retryable: false,
  };
}

/**
 * fetch を実行してレスポンスを処理する汎用関数
 * ネットワークエラー・HTTPエラーを ErrorState に変換する
 */
async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: ApiResponse<T> | null; error: ErrorState | null }> {
  try {
    const response = await fetch(url, options);

    if (response.status === 404) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      return { data: null, error: notFoundError(body.error) };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      return { data: null, error: serverError(body.error) };
    }

    const data = await response.json() as ApiResponse<T>;
    return { data, error: null };
  } catch {
    // ネットワークエラー（接続失敗・タイムアウトなど）
    return { data: null, error: networkError() };
  }
}

// ============================================================
// APIクライアント関数
// ============================================================

/**
 * 日付別スケジュールを取得する
 * @param date 上映日（YYYY-MM-DD形式）
 */
export async function fetchSchedules(
  date: string
): Promise<{ data: ApiResponse<Schedule[]> | null; error: ErrorState | null }> {
  return apiFetch<Schedule[]>(`${API_BASE}/schedules?date=${encodeURIComponent(date)}`);
}

/**
 * 作品一覧を取得する
 * @param params フィルターパラメータ
 */
export async function fetchMovies(params?: {
  status?: string;
  search?: string;
}): Promise<{ data: ApiResponse<Movie[]> | null; error: ErrorState | null }> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);

  const queryString = query.toString();
  const url = queryString ? `${API_BASE}/movies?${queryString}` : `${API_BASE}/movies`;

  return apiFetch<Movie[]>(url);
}

/**
 * 映画IDで作品詳細を取得する（要件5.1, 6.1）
 * @param movieId 映画ID
 */
export async function fetchMovieById(
  movieId: string
): Promise<{ data: ApiResponse<Movie> | null; error: ErrorState | null }> {
  return apiFetch<Movie>(`${API_BASE}/movies/${encodeURIComponent(movieId)}`);
}

/**
 * 作品別スケジュールを取得する
 * @param movieId 映画ID
 */
export async function fetchMovieSchedules(
  movieId: string
): Promise<{ data: ApiResponse<Schedule[]> | null; error: ErrorState | null }> {
  return apiFetch<Schedule[]>(`${API_BASE}/movies/${encodeURIComponent(movieId)}/schedules`);
}

/**
 * サーバーステータスを取得する
 */
export async function fetchStatus(): Promise<{
  data: { lastUpdatedAt: string | null; isScrapingInProgress: boolean; timestamp: string } | null;
  error: ErrorState | null;
}> {
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) {
      return { data: null, error: serverError() };
    }
    const data = await response.json() as { lastUpdatedAt: string | null; isScrapingInProgress: boolean; timestamp: string };
    return { data, error: null };
  } catch {
    return { data: null, error: networkError() };
  }
}

/**
 * サイトで利用可能な日付一覧を取得する
 */
export async function fetchAvailableDates(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/dates`);
    if (!response.ok) return [];
    const data = await response.json() as { dates: string[] };
    return data.dates ?? [];
  } catch {
    return [];
  }
}

/**
 * 手動更新をトリガーする
 * @param date 取得する日付（省略時は今日）
 */
export async function triggerRefresh(date?: string): Promise<{
  data: ApiResponse<{ message: string; updatedAt: string; actualDate?: string }> | null;
  error: ErrorState | null;
}> {
  const url = date ? `${API_BASE}/refresh?date=${encodeURIComponent(date)}` : `${API_BASE}/refresh`;
  return apiFetch<{ message: string; updatedAt: string; actualDate?: string }>(url, {
    method: 'POST',
  });
}
