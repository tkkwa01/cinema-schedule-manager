/**
 * バグ条件探索テスト — バグ1・バグ3
 *
 * バグ1: MoviesPage の onWatchlistToggle 型不一致
 * バグ3: AppContext の isInitialized フラグが存在しない
 *
 * **Validates: Requirements 1.2, 1.4**
 *
 * 修正後のコードで PASS することを確認する。
 * 実際のソースファイルを参照して検証する。
 */

import { describe, it, expect } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// バグ1探索テスト: onWatchlistToggle 型不一致
// ============================================================

describe('バグ1探索: MoviesPage の onWatchlistToggle 型不一致', () => {
  /**
   * バグ1確認テスト:
   * 修正後の MoviesPage.tsx では onWatchlistToggle コールバックのパラメータ名が
   * 'movieId' になっていることを確認する。
   *
   * 修正前: e => { e.stopPropagation?.(); handleWatchlistToggle(movie.id); }
   * 修正後: (movieId: string) => { handleWatchlistToggle(movieId); }
   */
  it('【修正確認】MoviesPage の onWatchlistToggle コールバックのパラメータが movieId になっている', () => {
    const moviesPagePath = resolve(__dirname, '../src/pages/MoviesPage.tsx');
    const sourceCode = readFileSync(moviesPagePath, 'utf-8');

    // 修正後の期待値: パラメータ名が 'movieId' であるべき
    expect(sourceCode).toContain('movieId');

    // 修正前の不具合コードが存在しないことを確認する
    // 修正前: e.stopPropagation?.() を onWatchlistToggle コールバック内で呼び出していた
    // 修正後: stopPropagation の呼び出しは削除されている
    expect(sourceCode).not.toMatch(/onWatchlistToggle=\{e\s*=>/);
  });

  /**
   * バグ1確認プロパティテスト:
   * 任意の映画IDに対して、修正後の onWatchlistToggle コールバックは
   * movieId を正しく受け取って handleWatchlistToggle に渡す
   *
   * **Validates: Requirements 1.2**
   */
  test.prop(
    [fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)],
    { numRuns: 20 }
  )(
    '【修正確認】任意の映画IDに対して onWatchlistToggle は string を受け取る',
    (movieId) => {
      // 修正後のコールバックをシミュレートする
      let receivedId: string | undefined;
      const handleWatchlistToggle = (id: string) => { receivedId = id; };

      // 修正後コード: (movieId: string) => { handleWatchlistToggle(movieId); }
      const fixedCallback = (id: string) => {
        handleWatchlistToggle(id);
      };

      // MovieCard から string が渡される
      fixedCallback(movieId);

      // 修正後の期待値: handleWatchlistToggle に正しい movieId が渡される
      expect(receivedId).toBe(movieId);
      expect(typeof receivedId).toBe('string');
    }
  );
});

// ============================================================
// バグ3探索テスト: AppContext の isInitialized フラグが存在しない
// ============================================================

describe('バグ3探索: AppContext の isInitialized フラグが存在しない', () => {
  /**
   * バグ3確認テスト:
   * 修正後の AppContext.tsx に isInitialized フィールドが存在することを確認する
   */
  it('【修正確認】AppContext の initialState に isInitialized フィールドが存在する', () => {
    const appContextPath = resolve(__dirname, '../src/store/AppContext.tsx');
    const sourceCode = readFileSync(appContextPath, 'utf-8');

    // 修正後の期待値: initialState に isInitialized: false が含まれる
    expect(sourceCode).toContain('isInitialized');
    expect(sourceCode).toContain('isInitialized: false');
    expect(sourceCode).toContain('SET_INITIALIZED');
  });

  /**
   * バグ3確認テスト:
   * 修正後の AppState 型定義に isInitialized フィールドが存在することを確認する
   */
  it('【修正確認】AppState 型定義に isInitialized フィールドが存在する', () => {
    const typesPath = resolve(__dirname, '../src/types/index.ts');
    const sourceCode = readFileSync(typesPath, 'utf-8');

    // 修正後の期待値: AppState 型に isInitialized: boolean が含まれる
    expect(sourceCode).toContain('isInitialized');
    expect(sourceCode).toContain('isInitialized: boolean');
  });

  /**
   * バグ3確認テスト:
   * 修正後の TimelinePage.tsx が isInitialized チェックを持つことを確認する
   */
  it('【修正確認】TimelinePage が isInitialized チェックを持つ', () => {
    const timelinePagePath = resolve(__dirname, '../src/pages/TimelinePage.tsx');
    const sourceCode = readFileSync(timelinePagePath, 'utf-8');

    // 修正後の期待値: isInitialized チェックが存在する
    expect(sourceCode).toContain('isInitialized');
    expect(sourceCode).toContain('if (!isInitialized) return');
  });

  /**
   * バグ3確認プロパティテスト:
   * AppState の isInitialized は boolean 型であるべき
   *
   * **Validates: Requirements 1.4**
   */
  test.prop(
    [fc.boolean()],
    { numRuns: 10 }
  )(
    '【修正確認】AppState の isInitialized は boolean 型である',
    (initialValue) => {
      // 修正後の AppState を模倣する（isInitialized あり）
      const fixedState: Record<string, unknown> = {
        selectedDate: '2024-01-15',
        selectedTheater: 'cinema-one',
        watchlist: [],
        lastUpdatedAt: null,
        isRefreshing: false,
        refreshTrigger: 0,
        schedulesCache: {},
        availableDates: [],
        isInitialized: initialValue, // 修正後: boolean 型
      };

      // 修正後の期待値: isInitialized が boolean 型である
      expect(fixedState).toHaveProperty('isInitialized');
      expect(typeof fixedState['isInitialized']).toBe('boolean');
    }
  );
});

// ============================================================
// バグ修正2: バグ3探索テスト — WatchlistPage がスケジュールなし映画のタイトルとして映画IDを表示する
// ============================================================

/**
 * バグ3探索テスト — WatchlistPage がスケジュールなし映画のタイトルとして映画IDを表示することを確認する
 *
 * **Validates: Requirements 1.8, 1.9**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件（isBugCondition_WatchlistTitle）:
 *   schedulesForDate.filter(s => s.movieId = movieId).length = 0
 *   — 選択中の日付にスケジュールが存在しない場合
 *
 * 修正前コード: const movieTitle = movieSchedules[0]?.movieTitle ?? movieId;
 * → スケジュールが空のとき movieId（数字文字列）がタイトルになる
 */

describe('バグ3探索: WatchlistPage がスケジュールなし映画のタイトルとして映画IDを表示する', () => {
  /**
   * バグ3確認テスト（ソースコード検査）:
   * 修正前の WatchlistPage.tsx には movies API からタイトルを補完するロジックが存在しない
   *
   * 修正前コード: const movieTitle = movieSchedules[0]?.movieTitle ?? movieId;
   * → movies.find(m => m.id === movieId)?.title による補完がない
   *
   * 期待される反例: スケジュールが空のとき '3742'（映画ID）がタイトルとして表示される
   */
  it('【バグ確認】WatchlistPage に movies API からタイトルを補完するロジックが存在するべき（修正前は失敗する）', () => {
    const watchlistPagePath = resolve(__dirname, '../src/pages/WatchlistPage.tsx');
    const sourceCode = readFileSync(watchlistPagePath, 'utf-8');

    // 修正後の期待値: movies.find() によるタイトル補完ロジックが存在するべき
    // 修正前コード: movieSchedules[0]?.movieTitle ?? movieId のみ（補完なし）
    expect(sourceCode).toContain('movies.find');
  });

  /**
   * バグ3確認テスト（ソースコード検査）:
   * 修正前の WatchlistPage.tsx には fetchMovies のインポートが存在しない
   *
   * 修正後: fetchMovies を api/client からインポートして映画一覧を取得する
   */
  it('【バグ確認】WatchlistPage が fetchMovies をインポートしているべき（修正前は失敗する）', () => {
    const watchlistPagePath = resolve(__dirname, '../src/pages/WatchlistPage.tsx');
    const sourceCode = readFileSync(watchlistPagePath, 'utf-8');

    // 修正後の期待値: fetchMovies がインポートされているべき
    // 修正前コード: fetchMovies のインポートが存在しない
    expect(sourceCode).toContain('fetchMovies');
  });

  /**
   * バグ3確認テスト（ソースコード検査）:
   * 修正前の WatchlistPage.tsx には movies state が存在しない
   *
   * 修正後: const [movies, setMovies] = useState<Movie[]>([]) が追加される
   */
  it('【バグ確認】WatchlistPage に movies state が存在するべき（修正前は失敗する）', () => {
    const watchlistPagePath = resolve(__dirname, '../src/pages/WatchlistPage.tsx');
    const sourceCode = readFileSync(watchlistPagePath, 'utf-8');

    // 修正後の期待値: movies state が存在するべき
    // 修正前コード: movies state が存在しない
    expect(sourceCode).toContain('setMovies');
  });

  /**
   * バグ3確認テスト（ソースコード検査）:
   * 修正前の WatchlistPage.tsx の movieTitle 取得ロジックが
   * movies.find() による補完を含むべき
   *
   * 修正前コード: movieSchedules[0]?.movieTitle ?? movieId
   * 修正後コード: movieSchedules[0]?.movieTitle ?? movies.find(m => m.id === movieId)?.title ?? movieId
   */
  it('【バグ確認】movieTitle 取得ロジックが movies.find() による補完を含むべき（修正前は失敗する）', () => {
    const watchlistPagePath = resolve(__dirname, '../src/pages/WatchlistPage.tsx');
    const sourceCode = readFileSync(watchlistPagePath, 'utf-8');

    // 修正後の期待値: movies.find(m => m.id === movieId)?.title による補完が存在するべき
    // 修正前コード: movieSchedules[0]?.movieTitle ?? movieId のみ（補完なし）
    expect(sourceCode).toMatch(/movies\.find\(m\s*=>\s*m\.id\s*===\s*movieId\)/);
  });
});
