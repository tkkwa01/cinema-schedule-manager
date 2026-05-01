/**
 * ウォッチリストユーティリティ関数
 * ローカルストレージを使用してウォッチリストを管理する（要件6.1〜6.4）
 */

import type { Schedule } from '../types/index';

// ============================================================
// 定数
// ============================================================

/** ローカルストレージのキー */
export const WATCHLIST_STORAGE_KEY = 'cinema-schedule-watchlist';

// ============================================================
// ローカルストレージ操作
// ============================================================

/**
 * ウォッチリストをローカルストレージから読み込む（要件6.1）
 * @returns 映画IDの配列
 */
export function getWatchlist(): string[] {
  try {
    const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * ウォッチリストをローカルストレージに保存する
 * @param watchlist 映画IDの配列
 */
function saveWatchlist(watchlist: string[]): void {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
}

/**
 * 映画をウォッチリストに追加する（要件6.1）
 * @param movieId 追加する映画のID
 */
export function addToWatchlist(movieId: string): void {
  const watchlist = getWatchlist();
  if (!watchlist.includes(movieId)) {
    watchlist.push(movieId);
    saveWatchlist(watchlist);
  }
}

/**
 * 映画をウォッチリストから削除する（要件6.3）
 * @param movieId 削除する映画のID
 */
export function removeFromWatchlist(movieId: string): void {
  const watchlist = getWatchlist();
  const updated = watchlist.filter(id => id !== movieId);
  saveWatchlist(updated);
}

/**
 * 映画がウォッチリストに登録されているか確認する
 * @param movieId 確認する映画のID
 * @returns 登録されている場合は true
 */
export function isInWatchlist(movieId: string): boolean {
  return getWatchlist().includes(movieId);
}

/**
 * ウォッチリストの件数を取得する（要件6.4）
 * @returns ウォッチリストに登録された映画の件数
 */
export function getWatchlistCount(): number {
  return getWatchlist().length;
}

// ============================================================
// フィルタリング
// ============================================================

/**
 * ウォッチリストに登録された映画のスケジュールのみを返す（要件6.2）
 * @param watchlist ウォッチリストの映画IDの配列
 * @param schedules スケジュールの配列
 * @returns ウォッチリストに含まれる映画のスケジュールのみを含む配列
 */
export function filterByWatchlist(watchlist: string[], schedules: Schedule[]): Schedule[] {
  if (watchlist.length === 0) return [];
  const watchlistSet = new Set(watchlist);
  return schedules.filter(schedule => watchlistSet.has(schedule.movieId));
}
