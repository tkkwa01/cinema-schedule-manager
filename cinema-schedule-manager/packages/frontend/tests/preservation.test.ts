/**
 * 保全プロパティテスト — Property 5: 作品一覧フィルタリング・ウォッチリスト操作の動作不変
 *
 * **Validates: Requirements 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * バグ条件が成立しない入力（isBugCondition が false の入力）に対して、
 * 既存の動作が正しいことを確認する。
 *
 * 保全対象:
 *   - filterByStatus・searchMovies・sortByStatus はバグの影響を受けない
 *   - addToWatchlist・removeFromWatchlist はバグの影響を受けない
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import {
  filterByStatus,
  searchMovies,
  sortByStatus,
} from '../src/utils/movieUtils';
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  WATCHLIST_STORAGE_KEY,
} from '../src/utils/watchlistUtils';
import type { Movie, ShowingStatus } from '../src/types/index';

// ============================================================
// テスト用アービトラリ（ジェネレーター）
// ============================================================

/** 有効な ShowingStatus を生成する */
const showingStatusArbitrary = fc.constantFrom<ShowingStatus>(
  'showing',
  'upcoming',
  'ending_soon'
);

/** テスト用映画データを生成する */
const movieArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  status: showingStatusArbitrary,
  hasSubtitle: fc.boolean(),
  formats: fc.array(fc.constantFrom('通常', '極音', '極爆'), { minLength: 1, maxLength: 3 }),
  createdAt: fc.constant('2024-01-15T00:00:00Z'),
  updatedAt: fc.constant('2024-01-15T00:00:00Z'),
}) satisfies fc.Arbitrary<Movie>;

/** 映画リストを生成する（0〜10件） */
const movieListArbitrary = fc.array(movieArbitrary, { minLength: 0, maxLength: 10 });

/** 映画IDを生成する（英数字とハイフンのみ） */
const movieIdArbitrary = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-zA-Z0-9-_]+$/.test(s) && s.trim().length > 0);

// ============================================================
// 保全テスト2: filterByStatus・searchMovies・sortByStatus の動作不変
// ============================================================

describe('保全テスト2: filterByStatus・searchMovies・sortByStatus の動作不変', () => {
  // ============================================================
  // filterByStatus のユニットテスト
  // ============================================================

  describe('filterByStatus', () => {
    it('showing ステータスの映画のみを返す（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: '映画A', status: 'showing', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '2', title: '映画B', status: 'upcoming', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '3', title: '映画C', status: 'ending_soon', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];

      const result = filterByStatus(movies, 'showing');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('1');
    });

    it('空のリストに対して空配列を返す（保全確認）', () => {
      const result = filterByStatus([], 'showing');
      expect(result).toHaveLength(0);
    });

    it('一致するステータスがない場合は空配列を返す（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: '映画A', status: 'upcoming', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];

      const result = filterByStatus(movies, 'showing');
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================
  // filterByStatus のプロパティベーステスト
  // ============================================================

  /**
   * 保全プロパティテスト:
   * filterByStatus の結果はすべて指定ステータスを持つ
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  test.prop(
    [movieListArbitrary, showingStatusArbitrary],
    { numRuns: 100 }
  )(
    '任意の映画リストとステータスに対して、filterByStatus の結果はすべて指定ステータスを持つ（保全）',
    (movies, status) => {
      const result = filterByStatus(movies, status);

      // 保全確認: 結果はすべて指定ステータスを持つ
      for (const movie of result) {
        expect(movie.status).toBe(status);
      }
    }
  );

  /**
   * 保全プロパティテスト:
   * filterByStatus の結果件数は元のリストの件数以下
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  test.prop(
    [movieListArbitrary, showingStatusArbitrary],
    { numRuns: 100 }
  )(
    '任意の映画リストに対して、filterByStatus の結果件数は元のリスト以下（保全）',
    (movies, status) => {
      const result = filterByStatus(movies, status);

      // 保全確認: フィルタリングで件数が増えることはない
      expect(result.length).toBeLessThanOrEqual(movies.length);
    }
  );

  /**
   * 保全プロパティテスト:
   * filterByStatus は元の配列を変更しない（純粋関数）
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieListArbitrary, showingStatusArbitrary],
    { numRuns: 50 }
  )(
    '任意の映画リストに対して、filterByStatus は元の配列を変更しない（保全）',
    (movies, status) => {
      const originalLength = movies.length;
      const originalIds = movies.map(m => m.id);

      filterByStatus(movies, status);

      // 保全確認: 元の配列が変更されていない
      expect(movies.length).toBe(originalLength);
      expect(movies.map(m => m.id)).toEqual(originalIds);
    }
  );

  // ============================================================
  // searchMovies のユニットテスト
  // ============================================================

  describe('searchMovies', () => {
    it('タイトルに部分一致する映画を返す（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: 'アクション映画', status: 'showing', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '2', title: 'ラブストーリー', status: 'upcoming', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '3', title: 'アニメ映画', status: 'ending_soon', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];

      const result = searchMovies(movies, '映画');

      expect(result).toHaveLength(2);
      expect(result.map(m => m.id)).toContain('1');
      expect(result.map(m => m.id)).toContain('3');
    });

    it('空のクエリに対して全件返す（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: '映画A', status: 'showing', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '2', title: '映画B', status: 'upcoming', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];

      const result = searchMovies(movies, '');
      expect(result).toHaveLength(2);
    });

    it('大文字小文字を区別しない（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: 'Action Movie', status: 'showing', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];

      const result = searchMovies(movies, 'action');
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // searchMovies のプロパティベーステスト
  // ============================================================

  /**
   * 保全プロパティテスト:
   * searchMovies の結果はすべてクエリを含むタイトルを持つ
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  test.prop(
    [
      movieListArbitrary,
      fc.string({ minLength: 1, maxLength: 10 }),
    ],
    { numRuns: 100 }
  )(
    '任意の映画リストとクエリに対して、searchMovies の結果はすべてクエリを含む（保全）',
    (movies, query) => {
      const result = searchMovies(movies, query);

      // 保全確認: 結果はすべてクエリを含むタイトルを持つ
      const normalizedQuery = query.toLowerCase();
      for (const movie of result) {
        expect(movie.title.toLowerCase()).toContain(normalizedQuery);
      }
    }
  );

  /**
   * 保全プロパティテスト:
   * 空のクエリに対して searchMovies は全件返す
   *
   * **Validates: Requirements 3.4**
   */
  test.prop(
    [movieListArbitrary],
    { numRuns: 50 }
  )(
    '空のクエリに対して searchMovies は全件返す（保全）',
    (movies) => {
      const result = searchMovies(movies, '');

      // 保全確認: 空クエリは全件返す
      expect(result.length).toBe(movies.length);
    }
  );

  /**
   * 保全プロパティテスト:
   * searchMovies は元の配列を変更しない（純粋関数）
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieListArbitrary, fc.string({ minLength: 0, maxLength: 10 })],
    { numRuns: 50 }
  )(
    '任意の映画リストに対して、searchMovies は元の配列を変更しない（保全）',
    (movies, query) => {
      const originalLength = movies.length;
      const originalIds = movies.map(m => m.id);

      searchMovies(movies, query);

      // 保全確認: 元の配列が変更されていない
      expect(movies.length).toBe(originalLength);
      expect(movies.map(m => m.id)).toEqual(originalIds);
    }
  );

  // ============================================================
  // sortByStatus のユニットテスト
  // ============================================================

  describe('sortByStatus', () => {
    it('showing > ending_soon > upcoming の順にソートする（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: '映画A', status: 'upcoming', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '2', title: '映画B', status: 'ending_soon', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '3', title: '映画C', status: 'showing', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];

      const result = sortByStatus(movies);

      expect(result[0]!.status).toBe('showing');
      expect(result[1]!.status).toBe('ending_soon');
      expect(result[2]!.status).toBe('upcoming');
    });

    it('空のリストに対して空配列を返す（保全確認）', () => {
      const result = sortByStatus([]);
      expect(result).toHaveLength(0);
    });

    it('元の配列を変更しない（保全確認）', () => {
      const movies: Movie[] = [
        { id: '1', title: '映画A', status: 'upcoming', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
        { id: '2', title: '映画B', status: 'showing', hasSubtitle: false, formats: ['通常'], createdAt: '', updatedAt: '' },
      ];
      const originalFirst = movies[0]!.id;

      sortByStatus(movies);

      // 元の配列の順序が変わっていないことを確認する
      expect(movies[0]!.id).toBe(originalFirst);
    });
  });

  // ============================================================
  // sortByStatus のプロパティベーステスト
  // ============================================================

  /**
   * 保全プロパティテスト:
   * sortByStatus の結果は showing が ending_soon より前に来る
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  test.prop(
    [movieListArbitrary],
    { numRuns: 100 }
  )(
    '任意の映画リストに対して、sortByStatus は showing を ending_soon より前に配置する（保全）',
    (movies) => {
      const result = sortByStatus(movies);

      // 保全確認: showing は ending_soon より前に来る
      const showingIndices = result
        .map((m, i) => ({ status: m.status, index: i }))
        .filter(x => x.status === 'showing')
        .map(x => x.index);

      const endingSoonIndices = result
        .map((m, i) => ({ status: m.status, index: i }))
        .filter(x => x.status === 'ending_soon')
        .map(x => x.index);

      for (const si of showingIndices) {
        for (const ei of endingSoonIndices) {
          expect(si).toBeLessThan(ei);
        }
      }
    }
  );

  /**
   * 保全プロパティテスト:
   * sortByStatus の結果は ending_soon が upcoming より前に来る
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  test.prop(
    [movieListArbitrary],
    { numRuns: 100 }
  )(
    '任意の映画リストに対して、sortByStatus は ending_soon を upcoming より前に配置する（保全）',
    (movies) => {
      const result = sortByStatus(movies);

      // 保全確認: ending_soon は upcoming より前に来る
      const endingSoonIndices = result
        .map((m, i) => ({ status: m.status, index: i }))
        .filter(x => x.status === 'ending_soon')
        .map(x => x.index);

      const upcomingIndices = result
        .map((m, i) => ({ status: m.status, index: i }))
        .filter(x => x.status === 'upcoming')
        .map(x => x.index);

      for (const ei of endingSoonIndices) {
        for (const ui of upcomingIndices) {
          expect(ei).toBeLessThan(ui);
        }
      }
    }
  );

  /**
   * 保全プロパティテスト:
   * sortByStatus の結果は元のリストと同じ件数を持つ（要素の消失なし）
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieListArbitrary],
    { numRuns: 100 }
  )(
    '任意の映画リストに対して、sortByStatus は件数を変えない（保全）',
    (movies) => {
      const result = sortByStatus(movies);

      // 保全確認: ソートで件数が変わらない
      expect(result.length).toBe(movies.length);
    }
  );

  /**
   * 保全プロパティテスト:
   * sortByStatus は元の配列を変更しない（純粋関数）
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieListArbitrary],
    { numRuns: 50 }
  )(
    '任意の映画リストに対して、sortByStatus は元の配列を変更しない（保全）',
    (movies) => {
      const originalIds = movies.map(m => m.id);

      sortByStatus(movies);

      // 保全確認: 元の配列の順序が変わっていない
      expect(movies.map(m => m.id)).toEqual(originalIds);
    }
  );
});

// ============================================================
// 保全テスト3: addToWatchlist・removeFromWatchlist の動作不変
// ============================================================

describe('保全テスト3: addToWatchlist・removeFromWatchlist の動作不変', () => {
  // 各テスト前後でローカルストレージをクリアする
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============================================================
  // addToWatchlist のユニットテスト
  // ============================================================

  describe('addToWatchlist', () => {
    it('映画IDをウォッチリストに追加できる（保全確認）', () => {
      addToWatchlist('movie-001');

      const watchlist = getWatchlist();
      expect(watchlist).toContain('movie-001');
    });

    it('同じ映画IDを重複して追加しない（保全確認）', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-001');

      const watchlist = getWatchlist();
      expect(watchlist.filter(id => id === 'movie-001')).toHaveLength(1);
    });

    it('複数の映画IDを追加できる（保全確認）', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-002');
      addToWatchlist('movie-003');

      const watchlist = getWatchlist();
      expect(watchlist).toHaveLength(3);
      expect(watchlist).toContain('movie-001');
      expect(watchlist).toContain('movie-002');
      expect(watchlist).toContain('movie-003');
    });

    it('ローカルストレージに保存される（保全確認）', () => {
      addToWatchlist('movie-001');

      const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as string[];
      expect(parsed).toContain('movie-001');
    });
  });

  // ============================================================
  // removeFromWatchlist のユニットテスト
  // ============================================================

  describe('removeFromWatchlist', () => {
    it('映画IDをウォッチリストから削除できる（保全確認）', () => {
      addToWatchlist('movie-001');
      addToWatchlist('movie-002');

      removeFromWatchlist('movie-001');

      const watchlist = getWatchlist();
      expect(watchlist).not.toContain('movie-001');
      expect(watchlist).toContain('movie-002');
    });

    it('存在しない映画IDを削除してもエラーにならない（保全確認）', () => {
      expect(() => removeFromWatchlist('non-existent')).not.toThrow();
    });

    it('削除後にローカルストレージが更新される（保全確認）', () => {
      addToWatchlist('movie-001');
      removeFromWatchlist('movie-001');

      const watchlist = getWatchlist();
      expect(watchlist).not.toContain('movie-001');
    });
  });

  // ============================================================
  // addToWatchlist のプロパティベーステスト
  // ============================================================

  /**
   * 保全プロパティテスト:
   * 任意の映画IDに対して、addToWatchlist 後にウォッチリストにその映画IDが含まれる
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieIdArbitrary],
    { numRuns: 50 }
  )(
    '任意の映画IDに対して、addToWatchlist 後にウォッチリストに含まれる（保全）',
    (movieId) => {
      localStorage.clear();

      addToWatchlist(movieId);

      const watchlist = getWatchlist();
      // 保全確認: 追加した映画IDがウォッチリストに含まれる
      expect(watchlist).toContain(movieId);
    }
  );

  /**
   * 保全プロパティテスト:
   * 任意の映画IDに対して、addToWatchlist は重複を追加しない
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieIdArbitrary, fc.integer({ min: 2, max: 5 })],
    { numRuns: 50 }
  )(
    '任意の映画IDを複数回追加しても重複しない（保全）',
    (movieId, times) => {
      localStorage.clear();

      // 同じ映画IDを複数回追加する
      for (let i = 0; i < times; i++) {
        addToWatchlist(movieId);
      }

      const watchlist = getWatchlist();
      // 保全確認: 重複なし（1件のみ）
      expect(watchlist.filter(id => id === movieId)).toHaveLength(1);
    }
  );

  // ============================================================
  // removeFromWatchlist のプロパティベーステスト
  // ============================================================

  /**
   * 保全プロパティテスト:
   * 任意の映画IDに対して、addToWatchlist → removeFromWatchlist 後にウォッチリストに含まれない
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [movieIdArbitrary],
    { numRuns: 50 }
  )(
    '任意の映画IDに対して、追加後に削除するとウォッチリストに含まれない（保全）',
    (movieId) => {
      localStorage.clear();

      addToWatchlist(movieId);
      removeFromWatchlist(movieId);

      const watchlist = getWatchlist();
      // 保全確認: 削除後はウォッチリストに含まれない
      expect(watchlist).not.toContain(movieId);
    }
  );

  /**
   * 保全プロパティテスト:
   * 任意の映画IDリストに対して、特定の映画IDを削除しても他の映画IDは残る
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [
      // 削除対象の映画ID
      movieIdArbitrary,
      // 残すべき映画IDのリスト（削除対象と異なるID）
      fc.array(movieIdArbitrary, { minLength: 1, maxLength: 5 }),
    ],
    { numRuns: 50 }
  )(
    '特定の映画IDを削除しても他の映画IDは残る（保全）',
    (targetId, otherIds) => {
      localStorage.clear();

      // 削除対象と他の映画IDをすべて追加する
      addToWatchlist(targetId);
      // 削除対象と異なるIDのみ追加する
      const uniqueOtherIds = [...new Set(otherIds.filter(id => id !== targetId))];
      for (const id of uniqueOtherIds) {
        addToWatchlist(id);
      }

      // 削除対象を削除する
      removeFromWatchlist(targetId);

      const watchlist = getWatchlist();
      // 保全確認: 削除対象は含まれない
      expect(watchlist).not.toContain(targetId);
      // 保全確認: 他の映画IDは残っている
      for (const id of uniqueOtherIds) {
        expect(watchlist).toContain(id);
      }
    }
  );

  /**
   * 保全プロパティテスト:
   * addToWatchlist と removeFromWatchlist はローカルストレージを正しく更新する
   *
   * **Validates: Requirements 3.3**
   */
  test.prop(
    [fc.array(movieIdArbitrary, { minLength: 1, maxLength: 5 })],
    { numRuns: 30 }
  )(
    '任意の映画IDリストに対して、ウォッチリスト操作はローカルストレージと同期する（保全）',
    (movieIds) => {
      localStorage.clear();

      // 重複を除いた映画IDリスト
      const uniqueIds = [...new Set(movieIds)];

      // すべての映画IDを追加する
      for (const id of uniqueIds) {
        addToWatchlist(id);
      }

      // ローカルストレージの内容を確認する
      const watchlistAfterAdd = getWatchlist();
      expect(watchlistAfterAdd.length).toBe(uniqueIds.length);

      // すべての映画IDを削除する
      for (const id of uniqueIds) {
        removeFromWatchlist(id);
      }

      // ローカルストレージが空になっていることを確認する
      const watchlistAfterRemove = getWatchlist();
      expect(watchlistAfterRemove.length).toBe(0);
    }
  );
});
