/**
 * 作品ユーティリティ関数
 * 映画作品データのフィルタリング・ソート・検索を行う
 */

import type { Movie, ShowingStatus } from '../types/index';

// ============================================================
// ステータス優先順位
// ============================================================

/** 上映ステータスの優先順位（小さいほど優先度が高い） */
const STATUS_PRIORITY: Record<ShowingStatus, number> = {
  showing: 0,
  ending_soon: 1,
  upcoming: 2,
};

// ============================================================
// フィルタリング
// ============================================================

/**
 * 指定したステータスで映画をフィルタリングする（要件4.2）
 * @param movies 映画の配列
 * @param status フィルタリングするステータス
 * @returns 指定ステータスの映画のみを含む配列
 */
export function filterByStatus(movies: Movie[], status: ShowingStatus): Movie[] {
  return movies.filter(movie => movie.status === status);
}

// ============================================================
// ソート
// ============================================================

/**
 * 映画をステータスの優先順位でソートする（要件4.3）
 * 優先順位: showing > ending_soon > upcoming
 * 元の配列を変更せず、新しい配列を返す
 * @param movies 映画の配列
 * @returns ステータス優先順位でソートされた映画の配列
 */
export function sortByStatus(movies: Movie[]): Movie[] {
  return [...movies].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.status] ?? 999;
    const priorityB = STATUS_PRIORITY[b.status] ?? 999;
    return priorityA - priorityB;
  });
}

// ============================================================
// 検索
// ============================================================

/**
 * タイトルの部分一致で映画を検索する（要件4.5）
 * 大文字小文字を区別しない
 * @param movies 映画の配列
 * @param query 検索クエリ文字列
 * @returns クエリに部分一致する映画のみを含む配列
 */
export function searchMovies(movies: Movie[], query: string): Movie[] {
  if (!query || query.trim() === '') {
    return movies;
  }

  const normalizedQuery = query.toLowerCase();
  return movies.filter(movie =>
    movie.title.toLowerCase().includes(normalizedQuery)
  );
}
