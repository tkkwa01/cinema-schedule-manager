/**
 * 保全プロパティテスト — Property 4: GET /api/schedules?date=YYYY-MM-DD の動作不変
 *
 * **Validates: Requirements 3.1, 3.2**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * バグ条件が成立しない入力（isBugCondition が false の入力）に対して、
 * 既存の動作が正しいことを確認する。
 *
 * 保全対象:
 *   - GET /api/schedules?date=YYYY-MM-DD エンドポイントはバグの影響を受けない
 *   - 任意の有効な日付文字列に対して、getSchedulesByDate の結果と一致する
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

/** テスト用スケジュールを生成するヘルパー */
function createTestSchedule(date: string, id: number): Schedule {
  return {
    id,
    movieId: `movie-${id}`,
    movieTitle: `テスト映画${id}`,
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

/** テスト用映画を生成するヘルパー */
function createTestMovie(id: string): Movie {
  return {
    id,
    title: `テスト映画 ${id}`,
    status: 'showing',
    hasSubtitle: false,
    formats: ['通常'],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };
}

// ============================================================
// 有効な日付文字列を生成するアービトラリ
// ============================================================

/**
 * YYYY-MM-DD 形式の有効な日付文字列を生成する
 * 2020-01-01 〜 2030-12-31 の範囲
 */
const validDateArbitrary = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map(d => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

// ============================================================
// 保全テスト1: GET /api/schedules?date=YYYY-MM-DD の動作不変
// ============================================================

describe('保全テスト1: GET /api/schedules?date=YYYY-MM-DD エンドポイントの動作不変', () => {
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

  // ============================================================
  // ユニットテスト: 具体的なケースの検証
  // ============================================================

  it('有効な日付でスケジュールを取得できる（保全確認）', async () => {
    const date = '2024-06-15';
    const schedule = createTestSchedule(date, 1);
    vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([schedule]);

    const res = await request(app).get(`/api/schedules?date=${date}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe(date);
    expect(res.body).toHaveProperty('lastUpdatedAt');
    expect(res.body).toHaveProperty('cached');
  });

  it('複数スケジュールが存在する日付で全件取得できる（保全確認）', async () => {
    const date = '2024-07-20';
    const schedules = [
      createTestSchedule(date, 1),
      createTestSchedule(date, 2),
      createTestSchedule(date, 3),
    ];
    vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue(schedules);

    const res = await request(app).get(`/api/schedules?date=${date}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('スケジュールが存在しない日付で404を返す（保全確認）', async () => {
    vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([]);

    const res = await request(app).get('/api/schedules?date=2099-12-31');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DATA_NOT_FOUND');
  });

  it('日付パラメータなしで400を返す（保全確認）', async () => {
    const res = await request(app).get('/api/schedules');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_DATE');
  });

  it('不正な日付形式で400を返す（保全確認）', async () => {
    const res = await request(app).get('/api/schedules?date=invalid-date');

    expect(res.status).toBe(400);
  });

  it('キャッシュヒット時は cached: true を返す（保全確認）', async () => {
    const date = '2024-08-10';
    const schedule = createTestSchedule(date, 1);
    vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([schedule]);

    // 1回目（キャッシュミス）
    await request(app).get(`/api/schedules?date=${date}`);
    // 2回目（キャッシュヒット）
    const res = await request(app).get(`/api/schedules?date=${date}`);

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(true);
  });

  it('lastUpdatedAt フィールドが含まれる（保全確認）', async () => {
    const date = '2024-09-01';
    const lastScrapedAt = new Date('2024-09-01T10:00:00Z');
    vi.mocked(mockDataStore.getLastScrapedAt).mockReturnValue(lastScrapedAt);
    vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([createTestSchedule(date, 1)]);

    const res = await request(app).get(`/api/schedules?date=${date}`);

    expect(res.body.lastUpdatedAt).toBe('2024-09-01T10:00:00.000Z');
  });

  // ============================================================
  // プロパティベーステスト: 任意の有効な日付に対する動作不変
  // ============================================================

  /**
   * 保全プロパティテスト:
   * 任意の有効な日付文字列に対して、エンドポイントは getSchedulesByDate の結果と一致する
   *
   * **Validates: Requirements 3.1, 3.2**
   *
   * isBugCondition が false の入力（スケジュールタブの日付取得）に対して、
   * 修正前のコードで正しく動作することを確認する。
   */
  test.prop(
    [
      validDateArbitrary,
      // スケジュール件数（0〜5件）
      fc.integer({ min: 1, max: 5 }),
    ],
    { numRuns: 50 }
  )(
    '任意の有効な日付に対して、エンドポイントは getSchedulesByDate の結果を返す（保全）',
    async (date, scheduleCount) => {
      // 各テストケースで新しいアプリインスタンスを作成する
      vi.clearAllMocks();
      const freshDataStore = createMockDataStore();
      const freshCache = new MemoryCache(30);
      const freshApp = createApp(freshDataStore, mockScheduler, freshCache);

      // 指定件数のスケジュールを生成する
      const schedules = Array.from({ length: scheduleCount }, (_, i) =>
        createTestSchedule(date, i + 1)
      );
      vi.mocked(freshDataStore.getSchedulesByDate).mockReturnValue(schedules);

      const res = await request(freshApp).get(`/api/schedules?date=${date}`);

      // 保全確認: エンドポイントは getSchedulesByDate の結果と一致する
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(scheduleCount);
      // 各スケジュールの日付が一致することを確認する
      for (const item of res.body.data as Schedule[]) {
        expect(item.date).toBe(date);
      }
    }
  );

  /**
   * 保全プロパティテスト:
   * 任意の有効な日付文字列に対して、レスポンスは必ず data・lastUpdatedAt・cached フィールドを持つ
   *
   * **Validates: Requirements 3.1**
   */
  test.prop(
    [validDateArbitrary],
    { numRuns: 30 }
  )(
    '任意の有効な日付に対して、レスポンスは必須フィールドを持つ（保全）',
    async (date) => {
      vi.clearAllMocks();
      const freshDataStore = createMockDataStore();
      const freshCache = new MemoryCache(30);
      const freshApp = createApp(freshDataStore, mockScheduler, freshCache);

      // スケジュールが存在する場合のみ200を返す
      const schedule = createTestSchedule(date, 1);
      vi.mocked(freshDataStore.getSchedulesByDate).mockReturnValue([schedule]);

      const res = await request(freshApp).get(`/api/schedules?date=${date}`);

      // 保全確認: レスポンスは必須フィールドを持つ
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('lastUpdatedAt');
      expect(res.body).toHaveProperty('cached');
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  );

  /**
   * 保全プロパティテスト:
   * GET /api/schedules は GET /api/movies/:id/schedules とは独立して動作する
   * （バグ2の修正が GET /api/schedules に影響しないことを確認する）
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  test.prop(
    [
      validDateArbitrary,
      // 映画ID
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
    ],
    { numRuns: 30 }
  )(
    'GET /api/schedules は映画別スケジュール取得とは独立して動作する（保全）',
    async (date, movieId) => {
      vi.clearAllMocks();
      const freshDataStore = createMockDataStore();
      const freshCache = new MemoryCache(30);
      const freshApp = createApp(freshDataStore, mockScheduler, freshCache);

      const movie = createTestMovie(movieId);
      const schedule = { ...createTestSchedule(date, 1), movieId };

      vi.mocked(freshDataStore.getMovieById).mockReturnValue(movie);
      vi.mocked(freshDataStore.getSchedulesByDate).mockReturnValue([schedule]);

      // GET /api/schedules?date=YYYY-MM-DD を呼び出す
      const res = await request(freshApp).get(`/api/schedules?date=${date}`);

      // 保全確認: getSchedulesByDate が呼ばれ、正しい結果が返る
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(vi.mocked(freshDataStore.getSchedulesByDate)).toHaveBeenCalledWith(date);
    }
  );
});

// ============================================================
// バグ修正2: 保全テスト1 — cronScheduler.ts の日付保存（バグ条件が成立しない入力）
// ============================================================

/**
 * 保全テスト1: cronScheduler.ts の日付保存
 *
 * **Validates: Requirements 3.1**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * バグ条件が成立しない入力（scrapeSchedule() が返す date とリクエスト日付が一致する場合）に対して、
 * 既存の動作が正しいことを確認する。
 *
 * 保全対象:
 *   - scrapeSchedule() が返す date がリクエスト日付と一致する場合、
 *     修正前後で saveSchedules の呼び出しが同じになる
 */

import { CronScheduler } from '../../src/scheduler/cronScheduler.js';
import type { IScheduleScraper, RawScheduleData, RawShowingData, ScrapeResult } from '../../src/types/index.js';

/** テスト用スクレイパーモックを作成する（保全テスト用） */
function createMockScraperForPreservation(
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

describe('保全テスト1: cronScheduler.ts の日付保存（バグ条件が成立しない入力）', () => {
  let mockDataStore: ReturnType<typeof createMockDataStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataStore = createMockDataStore();
  });

  /**
   * 保全テスト1（ユニットテスト）:
   * scrapeSchedule() が '2025-07-05' を返し、runUpdate('2025-07-05') を呼び出すとき、
   * dataStore.saveSchedules が '2025-07-05' で呼ばれる（バグ条件が成立しない）
   *
   * 修正前コード: const actualDate = scheduleResult.data.date;
   * → scheduleResult.data.date がリクエスト日付と一致する場合、正しく動作する
   *
   * 期待される動作: saveSchedules が '2025-07-05' で呼ばれる（修正前後で同じ）
   */
  it('scrapeSchedule が 2025-07-05 を返すとき、saveSchedules は 2025-07-05 で呼ばれる（保全確認）', async () => {
    // 準備: scrapeSchedule() が '2025-07-05' を返すモック（リクエスト日付と一致）
    const mockScraper = createMockScraperForPreservation('2025-07-05');
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行: リクエスト日付 '2025-07-05' で runUpdate を呼び出す
    await scheduler.triggerManualUpdate('2025-07-05');

    // 検証: saveSchedules がリクエスト日付 '2025-07-05' で呼ばれる
    // 修正前後で同じ動作（バグ条件が成立しない入力）
    expect(vi.mocked(mockDataStore.saveSchedules)).toHaveBeenCalledWith(
      '2025-07-05',
      expect.any(Array)
    );
  });

  /**
   * 保全テスト1（ユニットテスト）:
   * scrapeSchedule() が返す date とリクエスト日付が一致する場合、
   * 修正前後で saveSchedules の呼び出しが同じになる
   */
  it('scrapeSchedule が返す date とリクエスト日付が一致する場合、saveSchedules は正しく呼ばれる（保全確認）', async () => {
    // 準備: scrapeSchedule() が '2025-08-01' を返すモック（リクエスト日付と一致）
    const mockScraper = createMockScraperForPreservation('2025-08-01');
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行: リクエスト日付 '2025-08-01' で runUpdate を呼び出す
    await scheduler.triggerManualUpdate('2025-08-01');

    // 検証: saveSchedules がリクエスト日付 '2025-08-01' で呼ばれる
    const saveSchedulesCall = vi.mocked(mockDataStore.saveSchedules).mock.calls[0];
    expect(saveSchedulesCall).toBeDefined();
    expect(saveSchedulesCall![0]).toBe('2025-08-01');
  });
});

// ============================================================
// バグ修正2: 保全テスト2 — cronScheduler.ts のステータス保存（バグ条件が成立しない入力）
// ============================================================

/**
 * 保全テスト2: cronScheduler.ts のステータス保存
 *
 * **Validates: Requirements 3.2, 3.3**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * バグ条件が成立しない入力（showing ステータスの映画）に対して、
 * 既存の動作が正しいことを確認する。
 *
 * 保全対象:
 *   - showing ステータスの映画は修正前後で同じステータスで保存される
 */

describe('保全テスト2: cronScheduler.ts のステータス保存（バグ条件が成立しない入力）', () => {
  let mockDataStore: ReturnType<typeof createMockDataStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDataStore = createMockDataStore();
  });

  /**
   * 保全テスト2（ユニットテスト）:
   * scrapeShowing() が showing: [{ id: 'movie-1', title: '上映中映画' }] のみを返すとき、
   * dataStore.saveMovies に渡される映画データの status が 'showing' になる（バグ条件が成立しない）
   *
   * 修正前コード: status: 'showing' as const
   * → showing ステータスの映画は正しく動作する
   *
   * 期待される動作: showing の映画が status: 'showing' で保存される（修正前後で同じ）
   */
  it('showing の映画が status: showing で保存される（保全確認）', async () => {
    // 準備: scrapeShowing() が showing 映画のみを返すモック
    const mockScraper = createMockScraperForPreservation('2025-07-05', {
      showing: [{ id: 'movie-1', title: '上映中映画', formats: ['通常'] }],
      upcoming: [],
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
    const showingMovie = savedMovies.find(m => m.id === 'movie-1');
    expect(showingMovie).toBeDefined();

    // 保全確認: showing の映画は status: 'showing' で保存される（修正前後で同じ）
    expect(showingMovie!.status).toBe('showing');
  });

  /**
   * 保全テスト2（ユニットテスト）:
   * showing ステータスの映画が複数存在する場合、
   * すべて status: 'showing' で保存される
   */
  it('showing ステータスの映画が複数存在する場合、すべて status: showing で保存される（保全確認）', async () => {
    // 準備: scrapeShowing() が showing 映画を複数返すモック
    const mockScraper = createMockScraperForPreservation('2025-07-05', {
      showing: [
        { id: 'movie-a', title: '映画A', formats: ['通常'] },
        { id: 'movie-b', title: '映画B', formats: ['極音'] },
        { id: 'movie-c', title: '映画C', formats: ['極爆'] },
      ],
      upcoming: [],
      endingSoon: [],
      withSubtitle: [],
    });
    const scheduler = new CronScheduler(mockScraper, mockDataStore);

    // 実行
    await scheduler.triggerManualUpdate('2025-07-05');

    // 検証
    expect(vi.mocked(mockDataStore.saveMovies)).toHaveBeenCalled();
    const savedMovies = vi.mocked(mockDataStore.saveMovies).mock.calls[0]![0];

    // すべての映画が status: 'showing' で保存されることを確認する
    const movieA = savedMovies.find(m => m.id === 'movie-a');
    const movieB = savedMovies.find(m => m.id === 'movie-b');
    const movieC = savedMovies.find(m => m.id === 'movie-c');

    expect(movieA?.status).toBe('showing');
    expect(movieB?.status).toBe('showing');
    expect(movieC?.status).toBe('showing');
  });
});
