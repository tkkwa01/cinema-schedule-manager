/**
 * ウォッチリストユーティリティ関数のテスト
 * プロパティベーステストとユニットテストを含む
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  getWatchlistCount,
  filterByWatchlist,
  WATCHLIST_STORAGE_KEY,
} from '../../src/utils/watchlistUtils';
import type { Schedule } from '../../src/types/index';

// ============================================================
// テスト用ヘルパー
// ============================================================

function createSchedule(movieId: string): Schedule {
  return {
    id: 1,
    movieId,
    movieTitle: `映画 ${movieId}`,
    date: '2024-01-15',
    theater: 'cinema-one',
    studio: 'a studio',
    startTime: '10:00',
    endTime: '12:00',
    format: '通常',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('watchlistUtils', () => {
  // 各テスト前にローカルストレージをクリアする
  beforeEach(() => {
    localStorage.clear();
  });

  // ============================================================
  // getWatchlist のテスト
  // ============================================================

  describe('getWatchlist', () => {
    it('初期状態では空配列を返す', () => {
      expect(getWatchlist()).toEqual([]);
    });

    it('ローカルストレージが壊れている場合は空配列を返す', () => {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, 'invalid json');
      expect(getWatchlist()).toEqual([]);
    });

    it('配列でないデータが保存されている場合は空配列を返す', () => {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ id: '1' }));
      expect(getWatchlist()).toEqual([]);
    });
  });

  // ============================================================
  // addToWatchlist のテスト
  // ============================================================

  describe('addToWatchlist', () => {
    it('映画をウォッチリストに追加できる（要件6.1）', () => {
      addToWatchlist('movie-001');
      expect(getWatchlist()).toContain('movie-001');
    });

    it('同じ映画を2回追加しても重複しない', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-001');
      expect(getWatchlist().filter(id => id === 'movie-001')).toHaveLength(1);
    });

    it('複数の映画を追加できる', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-002');
      addToWatchlist('movie-003');
      expect(getWatchlist()).toHaveLength(3);
    });
  });

  // ============================================================
  // removeFromWatchlist のテスト
  // ============================================================

  describe('removeFromWatchlist', () => {
    it('映画をウォッチリストから削除できる（要件6.3）', () => {
      addToWatchlist('movie-001');
      removeFromWatchlist('movie-001');
      expect(getWatchlist()).not.toContain('movie-001');
    });

    it('存在しない映画を削除してもエラーが発生しない', () => {
      expect(() => removeFromWatchlist('non-existent')).not.toThrow();
    });

    it('削除後に他の映画は残る', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-002');
      removeFromWatchlist('movie-001');
      expect(getWatchlist()).toContain('movie-002');
      expect(getWatchlist()).not.toContain('movie-001');
    });
  });

  // ============================================================
  // isInWatchlist のテスト
  // ============================================================

  describe('isInWatchlist', () => {
    it('登録済み映画は true を返す', () => {
      addToWatchlist('movie-001');
      expect(isInWatchlist('movie-001')).toBe(true);
    });

    it('未登録映画は false を返す', () => {
      expect(isInWatchlist('movie-001')).toBe(false);
    });
  });

  // ============================================================
  // getWatchlistCount のテスト（要件6.4）
  // ============================================================

  describe('getWatchlistCount', () => {
    it('初期状態では 0 を返す', () => {
      expect(getWatchlistCount()).toBe(0);
    });

    it('追加した件数を返す', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-002');
      expect(getWatchlistCount()).toBe(2);
    });

    it('削除後に件数が減る', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-002');
      removeFromWatchlist('movie-001');
      expect(getWatchlistCount()).toBe(1);
    });
  });

  // ============================================================
  // filterByWatchlist のテスト（要件6.2）
  // ============================================================

  describe('filterByWatchlist', () => {
    it('ウォッチリストに含まれる映画のスケジュールのみを返す', () => {
      const schedules = [
        createSchedule('movie-001'),
        createSchedule('movie-002'),
        createSchedule('movie-003'),
      ];
      const result = filterByWatchlist(['movie-001', 'movie-003'], schedules);
      expect(result).toHaveLength(2);
      expect(result.map(s => s.movieId)).toContain('movie-001');
      expect(result.map(s => s.movieId)).toContain('movie-003');
      expect(result.map(s => s.movieId)).not.toContain('movie-002');
    });

    it('空のウォッチリストでは空配列を返す', () => {
      const schedules = [createSchedule('movie-001')];
      expect(filterByWatchlist([], schedules)).toEqual([]);
    });

    it('空のスケジュールでは空配列を返す', () => {
      expect(filterByWatchlist(['movie-001'], [])).toEqual([]);
    });
  });

  // ============================================================
  // プロパティベーステスト
  // ============================================================

  /**
   * プロパティ13: ウォッチリスト操作のラウンドトリップ（要件6.1, 6.3）
   * 追加後にローカルストレージを読み込むと同じIDが含まれ、削除後は除外される
   */
  test.prop([fc.string({ minLength: 1, maxLength: 50 })], { numRuns: 100 })(
    // Feature: cinema-schedule-manager, Property 13: ウォッチリスト操作のラウンドトリップ
    'addToWatchlist → getWatchlist → removeFromWatchlist のラウンドトリップ',
    (movieId) => {
      localStorage.clear();
      addToWatchlist(movieId);
      expect(getWatchlist()).toContain(movieId);
      removeFromWatchlist(movieId);
      expect(getWatchlist()).not.toContain(movieId);
    }
  );

  /**
   * プロパティ14: ウォッチリストフィルタリングの正確性（要件6.2）
   * フィルター結果はウォッチリストに含まれる映画IDのスケジュールのみを返す
   */
  test.prop(
    [
      fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
      fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
    ],
    { numRuns: 100 }
  )(
    // Feature: cinema-schedule-manager, Property 14: ウォッチリストフィルタリングの正確性
    'filterByWatchlist の結果はウォッチリストに含まれる映画IDのスケジュールのみを含む',
    (watchlist, movieIds) => {
      const schedules = movieIds.map(id => createSchedule(id));
      const result = filterByWatchlist(watchlist, schedules);
      const watchlistSet = new Set(watchlist);
      for (const schedule of result) {
        expect(watchlistSet.has(schedule.movieId)).toBe(true);
      }
    }
  );

  /**
   * プロパティ15: ウォッチリストバッジ件数の一致（要件6.4）
   * バッジに表示される件数はウォッチリストの要素数と一致する
   */
  test.prop(
    [fc.array(fc.uuid(), { minLength: 0, maxLength: 20 })],
    { numRuns: 100 }
  )(
    // Feature: cinema-schedule-manager, Property 15: ウォッチリストバッジ件数の一致
    'getWatchlistCount はウォッチリストの要素数と一致する',
    (movieIds) => {
      localStorage.clear();
      // 重複を除いた映画IDを追加する
      const uniqueIds = [...new Set(movieIds)];
      for (const id of uniqueIds) {
        addToWatchlist(id);
      }
      expect(getWatchlistCount()).toBe(uniqueIds.length);
    }
  );
});
