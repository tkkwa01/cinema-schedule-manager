/**
 * 作品ユーティリティ関数のテスト
 * プロパティベーステストとユニットテストを含む
 */

import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { filterByStatus, sortByStatus, searchMovies } from '../../src/utils/movieUtils';
import type { Movie, ShowingStatus } from '../../src/types/index';

// ============================================================
// テスト用ヘルパー
// ============================================================

function createMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'movie-001',
    title: 'テスト映画',
    status: 'showing',
    hasSubtitle: false,
    formats: ['通常'],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

/** Movie 型のジェネレーター */
const movieArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  status: fc.constantFrom('showing' as const, 'upcoming' as const, 'ending_soon' as const),
  hasSubtitle: fc.boolean(),
  formats: fc.array(fc.constantFrom('通常', '極音', '極爆'), { minLength: 1 }),
  createdAt: fc.constant('2024-01-15T00:00:00Z'),
  updatedAt: fc.constant('2024-01-15T00:00:00Z'),
});

// ============================================================
// filterByStatus のテスト
// ============================================================

describe('filterByStatus', () => {
  describe('ユニットテスト', () => {
    it('showing のみを返す', () => {
      const movies = [
        createMovie({ id: '1', status: 'showing' }),
        createMovie({ id: '2', status: 'upcoming' }),
        createMovie({ id: '3', status: 'ending_soon' }),
      ];
      const result = filterByStatus(movies, 'showing');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('1');
    });

    it('空配列を渡すと空配列を返す', () => {
      expect(filterByStatus([], 'showing')).toEqual([]);
    });

    it('一致するステータスがない場合は空配列を返す', () => {
      const movies = [createMovie({ status: 'showing' })];
      expect(filterByStatus(movies, 'upcoming')).toHaveLength(0);
    });
  });

  /**
   * プロパティ9: ステータスフィルターの正確性（要件4.2）
   * フィルター結果は指定ステータスの映画のみを含む
   */
  test.prop(
    [fc.array(movieArb), fc.constantFrom('showing' as const, 'upcoming' as const, 'ending_soon' as const)],
    { numRuns: 100 }
  )(
    // Feature: cinema-schedule-manager, Property 9: ステータスフィルターの正確性
    'filterByStatus の結果は指定ステータスの映画のみを含む',
    (movies, status) => {
      const result = filterByStatus(movies, status);
      for (const movie of result) {
        expect(movie.status).toBe(status);
      }
    }
  );
});

// ============================================================
// sortByStatus のテスト
// ============================================================

describe('sortByStatus', () => {
  describe('ユニットテスト', () => {
    it('showing > ending_soon > upcoming の順にソートされる', () => {
      const movies = [
        createMovie({ id: '1', status: 'upcoming' }),
        createMovie({ id: '2', status: 'ending_soon' }),
        createMovie({ id: '3', status: 'showing' }),
      ];
      const result = sortByStatus(movies);
      expect(result[0]?.status).toBe('showing');
      expect(result[1]?.status).toBe('ending_soon');
      expect(result[2]?.status).toBe('upcoming');
    });

    it('元の配列を変更しない（イミュータブル）', () => {
      const movies = [
        createMovie({ id: '1', status: 'upcoming' }),
        createMovie({ id: '2', status: 'showing' }),
      ];
      const original = [...movies];
      sortByStatus(movies);
      expect(movies[0]?.id).toBe(original[0]?.id);
    });

    it('空配列を渡すと空配列を返す', () => {
      expect(sortByStatus([])).toEqual([]);
    });
  });

  /**
   * プロパティ10: 作品一覧のステータス順ソート（要件4.3）
   * showing > ending_soon > upcoming の優先順位に従って並んでいる
   */
  const statusPriority: Record<ShowingStatus, number> = {
    showing: 0,
    ending_soon: 1,
    upcoming: 2,
  };

  test.prop([fc.array(movieArb)], { numRuns: 100 })(
    // Feature: cinema-schedule-manager, Property 10: 作品一覧のステータス順ソート
    'sortByStatus の結果はステータス優先順位に従って並んでいる',
    (movies) => {
      const result = sortByStatus(movies);
      for (let i = 0; i < result.length - 1; i++) {
        const priorityA = statusPriority[(result[i] as Movie).status] ?? 999;
        const priorityB = statusPriority[(result[i + 1] as Movie).status] ?? 999;
        expect(priorityA <= priorityB).toBe(true);
      }
    }
  );
});

// ============================================================
// searchMovies のテスト
// ============================================================

describe('searchMovies', () => {
  describe('ユニットテスト', () => {
    it('タイトルに部分一致する映画を返す', () => {
      const movies = [
        createMovie({ id: '1', title: 'アクション映画' }),
        createMovie({ id: '2', title: 'ドラマ映画' }),
        createMovie({ id: '3', title: 'アクションドラマ' }),
      ];
      const result = searchMovies(movies, 'アクション');
      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toContain('1');
      expect(result.map(m => m.id)).toContain('3');
    });

    it('空クエリの場合は全件返す', () => {
      const movies = [createMovie({ id: '1' }), createMovie({ id: '2' })];
      expect(searchMovies(movies, '')).toHaveLength(2);
    });

    it('一致しない場合は空配列を返す', () => {
      const movies = [createMovie({ title: 'テスト映画' })];
      expect(searchMovies(movies, '存在しない')).toHaveLength(0);
    });

    it('大文字小文字を区別しない', () => {
      const movies = [createMovie({ title: 'Test Movie' })];
      expect(searchMovies(movies, 'test')).toHaveLength(1);
      expect(searchMovies(movies, 'TEST')).toHaveLength(1);
    });
  });

  /**
   * プロパティ11: テキスト検索の部分一致（要件4.5）
   * 検索結果はクエリ文字列をタイトルに部分一致で含む映画のみを返す
   * ASCII英数字のみを使用してUnicode正規化の問題を回避する
   */
  test.prop(
    [
      fc.array(movieArb),
      // ASCII英数字のみのクエリを使用する（Unicode正規化の問題を回避）
      fc.stringMatching(/^[a-zA-Z0-9ぁ-ん一-龯]{1,10}$/),
    ],
    { numRuns: 100 }
  )(
    // Feature: cinema-schedule-manager, Property 11: テキスト検索の部分一致
    'searchMovies の結果はクエリをタイトルに含む映画のみを返す',
    (movies, query) => {
      const result = searchMovies(movies, query);
      for (const movie of result) {
        expect(movie.title.toLowerCase()).toContain(query.toLowerCase());
      }
    }
  );
});
