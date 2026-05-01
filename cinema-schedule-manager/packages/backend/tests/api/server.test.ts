/**
 * APIサーバーのテスト
 * createApp で生成した Express アプリケーションの各エンドポイントを検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const testSchedule: Schedule = {
  id: 1,
  movieId: 'movie-001',
  movieTitle: 'テスト映画',
  date: '2024-01-15',
  theater: 'cinema-one',
  studio: 'a studio',
  startTime: '10:00',
  endTime: '12:00',
  format: '通常',
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

const testMovie: Movie = {
  id: 'movie-001',
  title: 'テスト映画',
  status: 'showing',
  hasSubtitle: false,
  formats: ['通常'],
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
};

// ============================================================
// テストスイート
// ============================================================

describe('APIサーバー', () => {
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
  // GET /api/schedules のテスト
  // ============================================================

  describe('GET /api/schedules', () => {
    it('有効な日付でスケジュールを取得できる', async () => {
      vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([testSchedule]);

      const res = await request(app).get('/api/schedules?date=2024-01-15');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].movieTitle).toBe('テスト映画');
      expect(res.body).toHaveProperty('lastUpdatedAt');
      expect(res.body).toHaveProperty('cached');
    });

    it('日付パラメータなしで400を返す', async () => {
      const res = await request(app).get('/api/schedules');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE');
    });

    it('不正な日付形式で400を返す', async () => {
      const res = await request(app).get('/api/schedules?date=invalid');
      expect(res.status).toBe(400);
    });

    it('データが存在しない場合は404を返す', async () => {
      vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([]);

      const res = await request(app).get('/api/schedules?date=2099-12-31');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DATA_NOT_FOUND');
    });

    it('キャッシュヒット時は cached: true を返す', async () => {
      vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([testSchedule]);

      // 1回目のリクエスト（キャッシュミス）
      await request(app).get('/api/schedules?date=2024-01-15');
      // 2回目のリクエスト（キャッシュヒット）
      const res = await request(app).get('/api/schedules?date=2024-01-15');

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
    });

    it('lastUpdatedAt フィールドが含まれる（要件2.5）', async () => {
      const lastScrapedAt = new Date('2024-01-15T10:00:00Z');
      vi.mocked(mockDataStore.getLastScrapedAt).mockReturnValue(lastScrapedAt);
      vi.mocked(mockDataStore.getSchedulesByDate).mockReturnValue([testSchedule]);

      const res = await request(app).get('/api/schedules?date=2024-01-15');

      expect(res.body.lastUpdatedAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });

  // ============================================================
  // GET /api/movies のテスト
  // ============================================================

  describe('GET /api/movies', () => {
    it('全作品一覧を取得できる', async () => {
      vi.mocked(mockDataStore.getMovies).mockReturnValue([testMovie]);

      const res = await request(app).get('/api/movies');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('status フィルターが適用される', async () => {
      vi.mocked(mockDataStore.getMovies).mockReturnValue([testMovie]);

      const res = await request(app).get('/api/movies?status=showing');

      expect(res.status).toBe(200);
      expect(mockDataStore.getMovies).toHaveBeenCalledWith({ status: 'showing' });
    });

    it('search フィルターが適用される', async () => {
      vi.mocked(mockDataStore.getMovies).mockReturnValue([testMovie]);

      const res = await request(app).get('/api/movies?search=テスト');

      expect(res.status).toBe(200);
      expect(mockDataStore.getMovies).toHaveBeenCalledWith({ search: 'テスト' });
    });
  });

  // ============================================================
  // GET /api/movies/:id/schedules のテスト
  // ============================================================

  describe('GET /api/movies/:id/schedules', () => {
    it('存在する映画のスケジュールを取得できる', async () => {
      vi.mocked(mockDataStore.getMovieById).mockReturnValue(testMovie);
      vi.mocked(mockDataStore.getSchedulesByMovieId).mockReturnValue([testSchedule]);

      const res = await request(app).get('/api/movies/movie-001/schedules');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(mockDataStore.getSchedulesByMovieId).toHaveBeenCalledWith('movie-001');
    });

    it('存在しない映画IDで404を返す', async () => {
      vi.mocked(mockDataStore.getMovieById).mockReturnValue(null);

      const res = await request(app).get('/api/movies/non-existent/schedules');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('MOVIE_NOT_FOUND');
    });
  });

  // ============================================================
  // GET /api/status のテスト
  // ============================================================

  describe('GET /api/status', () => {
    it('ステータス情報を取得できる', async () => {
      const res = await request(app).get('/api/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lastUpdatedAt');
      expect(res.body).toHaveProperty('isScrapingInProgress');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('最終更新日時が含まれる（要件2.5）', async () => {
      const lastScrapedAt = new Date('2024-01-15T10:00:00Z');
      vi.mocked(mockDataStore.getLastScrapedAt).mockReturnValue(lastScrapedAt);

      const res = await request(app).get('/api/status');

      expect(res.body.lastUpdatedAt).toBe('2024-01-15T10:00:00.000Z');
    });
  });

  // ============================================================
  // POST /api/refresh のテスト
  // ============================================================

  describe('POST /api/refresh', () => {
    it('手動更新が成功する（要件2.3）', async () => {
      const res = await request(app).post('/api/refresh');

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('更新しました');
      expect(mockScheduler.triggerManualUpdate).toHaveBeenCalledOnce();
    });

    it('スクレイピング中は503を返す', async () => {
      cache.setScrapingInProgress(true);

      const res = await request(app).post('/api/refresh');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SCRAPING_IN_PROGRESS');
    });

    it('更新失敗時は500を返す', async () => {
      vi.mocked(mockScheduler.triggerManualUpdate).mockResolvedValueOnce({
        success: false,
        updatedAt: new Date(),
        error: '更新エラー',
      });

      const res = await request(app).post('/api/refresh');

      expect(res.status).toBe(500);
    });
  });
});
