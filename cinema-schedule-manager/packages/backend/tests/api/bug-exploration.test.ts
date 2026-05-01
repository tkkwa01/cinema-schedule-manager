/**
 * バグ条件探索テスト — バグ2: GET /api/movies/:id/schedules が今日以外のスケジュールを返さない
 *
 * **Validates: Requirements 1.3**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件（isBugCondition_2）:
 *   schedulesInDB.length > 0 AND schedulesToday.length < schedulesInDB.length
 *   — 今日以外のスケジュールが存在するのに返されない
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import { createApp } from '../../src/api/server.js';
import { MemoryCache } from '../../src/cache/memoryCache.js';
import type { IDataStore, IScheduler, Schedule, Movie } from '../../src/types/index.js';

// ============================================================
// モックの作成
// ============================================================

function createMockDataStore(): IDataStore {
  return {
    saveSchedules: vi.fn(),
    getSchedulesByDate: vi.fn().mockReturnValue([]),
    getSchedulesByMovieId: vi.fn().mockReturnValue([]),
    saveMovies: vi.fn(),
    getMovies: vi.fn().mockReturnValue([]),
    getMovieById: vi.fn().mockReturnValue(null),
    getLastScrapedAt: vi.fn().mockReturnValue(null),
    saveLastScrapedAt: vi.fn(),
    deleteOldSchedules: vi.fn().mockReturnValue(0),
  };
}

function createMockScheduler(): IScheduler {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    triggerManualUpdate: vi.fn().mockResolvedValue({
      success: true,
      updatedAt: new Date('2024-01-15T10:00:00Z'),
    }),
    getLastUpdateTime: vi.fn().mockReturnValue(null),
  };
}

const testMovie: Movie = {
  id: 'movie-abc',
  title: 'テスト映画ABC',
  status: 'showing',
  hasSubtitle: false,
  formats: ['通常'],
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

/** 今日以外の日付（明日）のスケジュールを生成する */
function createFutureSchedule(date: string, id: number): Schedule {
  return {
    id,
    movieId: 'movie-abc',
    movieTitle: 'テスト映画ABC',
    date,
    theater: 'cinema-one',
    studio: 'a studio',
    startTime: '10:00',
    endTime: '12:00',
    format: '通常',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };
}

/** 今日の日付を YYYY-MM-DD 形式で取得する */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0] as string;
}

/** 指定日数後の日付を YYYY-MM-DD 形式で取得する */
function getFutureDateString(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0] as string;
}

// ============================================================
// バグ2探索テスト
// ============================================================

describe('バグ2探索: GET /api/movies/:id/schedules が今日以外のスケジュールを返さない', () => {
  let mockDataStore: IDataStore;
  let mockScheduler: IScheduler;
  let cache: MemoryCache;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataStore = createMockDataStore();
    mockScheduler = createMockScheduler();
    cache = new MemoryCache(30);
    app = createApp(mockDataStore, mockScheduler, cache);
  });

  /**
   * バグ2探索テスト（ユニットテスト）:
   * 明日のスケジュールのみDBに存在する場合、エンドポイントは空配列を返す（バグ）
   *
   * 修正前コード: getSchedulesByDate(today).filter(s => s.movieId === movieId)
   * → 今日のスケジュールのみ取得するため、明日のスケジュールは返らない
   *
   * 期待される反例: 明日のスケジュールが存在するのに空配列が返る
   */
  it('【バグ確認】明日のスケジュールのみDBに存在する場合、エンドポイントは空配列を返す（修正前は失敗する）', async () => {
    // 準備: 映画は存在するが、スケジュールは明日のみ
    vi.mocked(mockDataStore.getMovieById).mockReturnValue(testMovie);

    const tomorrow = getFutureDateString(1);
    const tomorrowSchedule = createFutureSchedule(tomorrow, 1);

    // 修正後コード: getSchedulesByMovieId(movieId) は全日付のスケジュールを返す
    vi.mocked(mockDataStore.getSchedulesByMovieId).mockReturnValue([tomorrowSchedule]);

    const res = await request(app).get('/api/movies/movie-abc/schedules');

    // バグ修正後の期待値: 明日のスケジュールが返るべき（schedules.length > 0）
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe(tomorrow);
  });

  /**
   * バグ2探索テスト（ユニットテスト）:
   * 今日・明日・明後日のスケジュールがDBに存在する場合、エンドポイントは全件返すべき
   *
   * 修正前コード: 今日のスケジュールのみ返す（1件）
   * 期待される動作: 全日付のスケジュールを返す（3件）
   */
  it('【バグ確認】複数日付のスケジュールが存在する場合、全件返すべき（修正前は失敗する）', async () => {
    vi.mocked(mockDataStore.getMovieById).mockReturnValue(testMovie);

    const today = getTodayString();
    const tomorrow = getFutureDateString(1);
    const dayAfterTomorrow = getFutureDateString(2);

    const todaySchedule = createFutureSchedule(today, 1);
    const tomorrowSchedule = createFutureSchedule(tomorrow, 2);
    const dayAfterSchedule = createFutureSchedule(dayAfterTomorrow, 3);

    // 修正後コード: getSchedulesByMovieId(movieId) は全日付のスケジュールを返す
    vi.mocked(mockDataStore.getSchedulesByMovieId).mockReturnValue([
      todaySchedule,
      tomorrowSchedule,
      dayAfterSchedule,
    ]);

    const res = await request(app).get('/api/movies/movie-abc/schedules');

    // バグ修正後の期待値: 3件すべて返るべき
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  /**
   * バグ2探索プロパティテスト:
   * 任意の映画IDに対して、今日以外の日付のスケジュールが存在する場合、
   * エンドポイントはそれらを含む全スケジュールを返すべき
   *
   * **Validates: Requirements 1.3**
   *
   * isBugCondition_2: schedulesInDB.length > 0 AND schedulesToday.length < schedulesInDB.length
   */
  test.prop(
    [
      // 今日以外の日付（1〜30日後）
      fc.integer({ min: 1, max: 30 }).map(daysAhead => getFutureDateString(daysAhead)),
    ],
    { numRuns: 10 }
  )(
    '【バグ確認】今日以外の日付のスケジュールが存在する場合、エンドポイントはそれを返すべき（修正前は失敗する）',
    async (futureDate) => {
      vi.clearAllMocks();
      const freshCache = new MemoryCache(30);
      const freshDataStore = createMockDataStore();
      const freshApp = createApp(freshDataStore, mockScheduler, freshCache);

      vi.mocked(freshDataStore.getMovieById).mockReturnValue(testMovie);

      const futureSchedule = createFutureSchedule(futureDate, 99);

      // 修正後コード: getSchedulesByMovieId(movieId) は全日付のスケジュールを返す
      vi.mocked(freshDataStore.getSchedulesByMovieId).mockReturnValue([futureSchedule]);

      const res = await request(freshApp).get('/api/movies/movie-abc/schedules');

      // バグ修正後の期待値: 未来のスケジュールが返るべき
      expect(res.body.data.length).toBeGreaterThan(0);
    }
  );
});

// ============================================================
// バグ修正2: バグ1探索テスト — cronScheduler の actualDate 日付固定バグ
// ============================================================

/**
 * バグ1探索テスト — cronScheduler.ts の runUpdate() が actualDate として
 * リクエスト日付以外を使用することを確認する
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件（isBugCondition_DateFixed）:
 *   parsedDate ≠ null AND parsedDate ≠ requestedDate
 *   — scrapeSchedule() が返す date がリクエスト日付と異なる場合
 */

import { CronScheduler } from '../../src/scheduler/cronScheduler.js';
import type { IScheduleScraper, RawScheduleData, RawShowingData, ScrapeResult } from '../../src/types/index.js';

/** テスト用スクレイパーモックを作成する */
function createMockScraper(
  scheduleDate: string,
  showingData?: Partial<RawShowingData>
): IScheduleScraper {
  const defaultShowing: RawShowingData = {
    showing: [],
    upcoming: [],
    endingSoon: [],
    withSubtitle: [],
    ...showingData,
  };

  return {
    scrapeSchedule: vi.fn().mockResolvedValue({
      success: true,
      data: {
        date: scheduleDate,
        theater: 'cinema-one',
        entries: [],
      } as RawScheduleData,
      scrapedAt: new Date(),
    } as ScrapeResult<RawScheduleData>),
    scrapeShowing: vi.fn().mockResolvedValue({
      success: true,
      data: defaultShowing,
      scrapedAt: new Date(),
    } as ScrapeResult<RawShowingData>),
    scrapeMovieDetail: vi.fn().mockResolvedValue({
      success: false,
      data: null,
      scrapedAt: new Date(),
    }),
  };
}

describe('バグ1探索: cronScheduler.ts の runUpdate() が actualDate としてリクエスト日付以外を使用する', () => {
  let mockDataStore: ReturnType<typeof createMockDataStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataStore = createMockDataStore();
  });

  /**
   * バグ1探索テスト（ユニットテスト）:
   * scrapeSchedule() が '2025-07-04' を返すとき、runUpdate('2025-07-05') を呼び出すと
   * dataStore.saveSchedules が '2025-07-04'（リクエスト日付ではない）で呼ばれる
   *
   * 修正前コード: const actualDate = scheduleResult.data.date;
   * → scheduleResult.data.date がそのまま使われるため '2025-07-04' になる
   *
   * 期待される反例: saveSchedules が '2025-07-05' ではなく '2025-07-04' で呼ばれる
   */
  it('【バグ確認】scrapeSchedule が 2025-07-04 を返すとき、saveSchedules は 2025-07-05 で呼ばれるべき（修正前は失敗する）', async () => {
    // 準備: scrapeSchedule() が '2025-07-04' を返すモック（リクエスト日付 '2025-07-05' と異なる）
    const mockScraper = createMockScraper('2025-07-04');
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行: リクエスト日付 '2025-07-05' で runUpdate を呼び出す
    await scheduler.triggerManualUpdate('2025-07-05');

    // 検証: saveSchedules がリクエスト日付 '2025-07-05' で呼ばれるべき
    // 修正前コード（const actualDate = scheduleResult.data.date）では '2025-07-04' で呼ばれる
    expect(vi.mocked(mockDataStore.saveSchedules)).toHaveBeenCalledWith(
      '2025-07-05', // リクエスト日付で保存されるべき
      expect.any(Array)
    );
  });

  /**
   * バグ1探索テスト（ユニットテスト）:
   * scrapeSchedule() が異なる日付を返す場合、saveSchedules は常にリクエスト日付で呼ばれるべき
   *
   * 修正前コード: const actualDate = scheduleResult.data.date;
   * → スクレイパーが返した日付がそのまま使われる
   */
  it('【バグ確認】scrapeSchedule が異なる日付を返す場合、saveSchedules はリクエスト日付で呼ばれるべき（修正前は失敗する）', async () => {
    // 準備: scrapeSchedule() が '2025-07-01' を返すモック（リクエスト日付 '2025-07-10' と異なる）
    const mockScraper = createMockScraper('2025-07-01');
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行: リクエスト日付 '2025-07-10' で runUpdate を呼び出す
    await scheduler.triggerManualUpdate('2025-07-10');

    // 検証: saveSchedules がリクエスト日付 '2025-07-10' で呼ばれるべき
    const saveSchedulesCall = vi.mocked(mockDataStore.saveSchedules).mock.calls[0];
    expect(saveSchedulesCall).toBeDefined();
    // 修正前: saveSchedules('2025-07-01', ...) が呼ばれる（バグ）
    // 修正後: saveSchedules('2025-07-10', ...) が呼ばれるべき
    expect(saveSchedulesCall![0]).toBe('2025-07-10');
  });
});

// ============================================================
// バグ修正2: バグ2探索テスト — cronScheduler の movieMap ステータス欠落バグ
// ============================================================

/**
 * バグ2探索テスト — cronScheduler.ts の runUpdate() が upcoming・ending_soon の
 * 映画を showing として保存することを確認する
 *
 * **Validates: Requirements 1.4, 1.5**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件（isBugCondition_StatusLost）:
 *   movie.status = 'upcoming' OR movie.status = 'ending_soon'
 *   — showing 以外のステータスを持つ映画がバグ条件に該当する
 */

describe('バグ2探索: cronScheduler.ts の runUpdate() が upcoming・ending_soon の映画を showing として保存する', () => {
  let mockDataStore: ReturnType<typeof createMockDataStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataStore = createMockDataStore();
  });

  /**
   * バグ2探索テスト（ユニットテスト）:
   * scrapeShowing() が upcoming: [{ id: 'movie-1', title: '上映予定映画' }] を返すとき、
   * dataStore.saveMovies に渡される映画データの status が 'showing' になる（バグ）
   *
   * 修正前コード: status: 'showing' as const
   * → すべての映画が 'showing' になる
   *
   * 期待される反例: upcoming の映画が status: 'showing' で保存される
   */
  it('【バグ確認】upcoming の映画が status: upcoming で保存されるべき（修正前は失敗する）', async () => {
    // 準備: scrapeShowing() が upcoming 映画を返すモック
    const mockScraper = createMockScraper('2025-07-05', {
      showing: [],
      upcoming: [{ id: 'movie-1', title: '上映予定映画', formats: ['通常'] }],
      endingSoon: [],
      withSubtitle: [],
    });
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行
    await scheduler.triggerManualUpdate('2025-07-05');

    // 検証: saveMovies が呼ばれたことを確認する
    expect(vi.mocked(mockDataStore.saveMovies)).toHaveBeenCalled();

    // saveMovies に渡された映画データを取得する
    const saveMoviesCall = vi.mocked(mockDataStore.saveMovies).mock.calls[0];
    expect(saveMoviesCall).toBeDefined();
    const savedMovies = saveMoviesCall![0];

    // 'movie-1' の映画を探す
    const upcomingMovie = savedMovies.find(m => m.id === 'movie-1');
    expect(upcomingMovie).toBeDefined();

    // 修正後の期待値: upcoming の映画は status: 'upcoming' で保存されるべき
    // 修正前コード（status: 'showing' as const）では status: 'showing' になる
    expect(upcomingMovie!.status).toBe('upcoming');
  });

  /**
   * バグ2探索テスト（ユニットテスト）:
   * scrapeShowing() が ending_soon 映画を返すとき、
   * dataStore.saveMovies に渡される映画データの status が 'ending_soon' になるべき
   *
   * 修正前コード: status: 'showing' as const
   * → ending_soon の映画も 'showing' になる
   */
  it('【バグ確認】ending_soon の映画が status: ending_soon で保存されるべき（修正前は失敗する）', async () => {
    // 準備: scrapeShowing() が ending_soon 映画を返すモック
    const mockScraper = createMockScraper('2025-07-05', {
      showing: [],
      upcoming: [],
      endingSoon: [{ id: 'movie-2', title: '終了間近映画', formats: ['通常'] }],
      withSubtitle: [],
    });
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行
    await scheduler.triggerManualUpdate('2025-07-05');

    // 検証: saveMovies が呼ばれたことを確認する
    expect(vi.mocked(mockDataStore.saveMovies)).toHaveBeenCalled();

    const saveMoviesCall = vi.mocked(mockDataStore.saveMovies).mock.calls[0];
    expect(saveMoviesCall).toBeDefined();
    const savedMovies = saveMoviesCall![0];

    // 'movie-2' の映画を探す
    const endingSoonMovie = savedMovies.find(m => m.id === 'movie-2');
    expect(endingSoonMovie).toBeDefined();

    // 修正後の期待値: ending_soon の映画は status: 'ending_soon' で保存されるべき
    // 修正前コード（status: 'showing' as const）では status: 'showing' になる
    expect(endingSoonMovie!.status).toBe('ending_soon');
  });

  /**
   * バグ2探索テスト（ユニットテスト）:
   * showing・upcoming・ending_soon が混在する場合、それぞれ正しいステータスで保存されるべき
   */
  it('【バグ確認】showing・upcoming・ending_soon が混在する場合、それぞれ正しいステータスで保存されるべき（修正前は失敗する）', async () => {
    // 準備: 3種類のステータスが混在するモック
    const mockScraper = createMockScraper('2025-07-05', {
      showing: [{ id: 'movie-showing', title: '上映中映画', formats: ['通常'] }],
      upcoming: [{ id: 'movie-upcoming', title: '上映予定映画', formats: ['通常'] }],
      endingSoon: [{ id: 'movie-ending', title: '終了間近映画', formats: ['通常'] }],
      withSubtitle: [],
    });
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行
    await scheduler.triggerManualUpdate('2025-07-05');

    // 検証
    expect(vi.mocked(mockDataStore.saveMovies)).toHaveBeenCalled();
    const savedMovies = vi.mocked(mockDataStore.saveMovies).mock.calls[0]![0];

    const showingMovie = savedMovies.find(m => m.id === 'movie-showing');
    const upcomingMovie = savedMovies.find(m => m.id === 'movie-upcoming');
    const endingSoonMovie = savedMovies.find(m => m.id === 'movie-ending');

    // showing は 'showing' のまま（保全）
    expect(showingMovie?.status).toBe('showing');
    // 修正後の期待値: upcoming は 'upcoming'、ending_soon は 'ending_soon' で保存されるべき
    expect(upcomingMovie?.status).toBe('upcoming');
    expect(endingSoonMovie?.status).toBe('ending_soon');
  });
});
