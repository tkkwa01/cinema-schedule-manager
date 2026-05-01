/**
 * cronスケジューラーのテスト
 * CronScheduler クラスの動作を検証する
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CronScheduler } from '../../src/scheduler/cronScheduler.js';
import type { IScheduleScraper, IDataStore, ScrapeResult, RawScheduleData, RawShowingData, RawMovieDetail } from '../../src/types/index.js';

// ============================================================
// モックの作成
// ============================================================

/** スクレイパーのモック */
function createMockScraper(): IScheduleScraper {
  return {
    scrapeSchedule: vi.fn().mockResolvedValue({
      success: true,
      data: {
        date: '2024-01-15',
        theater: '',
        entries: [],
      } as RawScheduleData,
      scrapedAt: new Date(),
    } as ScrapeResult<RawScheduleData>),
    scrapeShowing: vi.fn().mockResolvedValue({
      success: true,
      data: {
        showing: [],
        upcoming: [],
        endingSoon: [],
        withSubtitle: [],
      } as RawShowingData,
      scrapedAt: new Date(),
    } as ScrapeResult<RawShowingData>),
    scrapeMovieDetail: vi.fn().mockResolvedValue({
      success: false,
      data: null,
      scrapedAt: new Date(),
    } as ScrapeResult<RawMovieDetail>),
  };
}

/** データストアのモック */
function createMockDataStore(): IDataStore {
  return {
    saveSchedules: vi.fn(),
    getSchedulesByDate: vi.fn().mockReturnValue([]),
    saveMovies: vi.fn(),
    getMovies: vi.fn().mockReturnValue([]),
    getMovieById: vi.fn().mockReturnValue(null),
    getLastScrapedAt: vi.fn().mockReturnValue(null),
    saveLastScrapedAt: vi.fn(),
    deleteOldSchedules: vi.fn().mockReturnValue(0),
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('CronScheduler', () => {
  let scheduler: CronScheduler;
  let mockScraper: IScheduleScraper;
  let mockDataStore: IDataStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockScraper = createMockScraper();
    mockDataStore = createMockDataStore();
    // テスト用に短い間隔（1分）を設定する
    scheduler = new CronScheduler(mockScraper, mockDataStore, 1);
  });

  afterEach(() => {
    scheduler.stop();
    vi.restoreAllMocks();
  });

  // ============================================================
  // 基本動作のテスト
  // ============================================================

  describe('基本動作', () => {
    it('初期状態では lastUpdateTime が null である', () => {
      expect(scheduler.getLastUpdateTime()).toBeNull();
    });

    it('初期状態では isUpdating が false である', () => {
      expect(scheduler.getIsUpdating()).toBe(false);
    });

    it('start() でスケジューラーを起動できる', () => {
      expect(() => scheduler.start()).not.toThrow();
    });

    it('stop() でスケジューラーを停止できる', () => {
      scheduler.start();
      expect(() => scheduler.stop()).not.toThrow();
    });

    it('start() を2回呼び出してもエラーが発生しない', () => {
      scheduler.start();
      expect(() => scheduler.start()).not.toThrow();
    });

    it('stop() を2回呼び出してもエラーが発生しない', () => {
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  // ============================================================
  // 手動更新のテスト（要件2.3）
  // ============================================================

  describe('triggerManualUpdate（要件2.3）', () => {
    it('手動更新が成功する', async () => {
      const result = await scheduler.triggerManualUpdate();

      expect(result.success).toBe(true);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('手動更新後に lastUpdateTime が更新される（要件2.2）', async () => {
      expect(scheduler.getLastUpdateTime()).toBeNull();

      await scheduler.triggerManualUpdate();

      expect(scheduler.getLastUpdateTime()).toBeInstanceOf(Date);
    });

    it('手動更新後に saveLastScrapedAt が呼ばれる（要件2.2）', async () => {
      await scheduler.triggerManualUpdate();

      expect(mockDataStore.saveLastScrapedAt).toHaveBeenCalledOnce();
    });

    it('スクレイパーが失敗した場合は success: false を返す', async () => {
      vi.mocked(mockScraper.scrapeSchedule).mockResolvedValueOnce({
        success: false,
        data: null,
        error: 'スクレイピングエラー',
        scrapedAt: new Date(),
      });

      const result = await scheduler.triggerManualUpdate();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('更新中に再度 triggerManualUpdate を呼ぶと失敗する', async () => {
      // 最初の更新を遅延させる
      vi.mocked(mockScraper.scrapeSchedule).mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { date: '2024-01-15', theater: '', entries: [] },
          scrapedAt: new Date(),
        }), 100))
      );

      // 並行して2回実行する
      const [result1, result2] = await Promise.all([
        scheduler.triggerManualUpdate(),
        scheduler.triggerManualUpdate(),
      ]);

      // どちらか一方が失敗する（同時実行防止）
      const hasFailure = !result1.success || !result2.success;
      expect(hasFailure).toBe(true);
    });
  });

  // ============================================================
  // データ保存のテスト（要件2.2）
  // ============================================================

  describe('データ保存（要件2.2）', () => {
    it('スクレイピング成功時に saveSchedules が呼ばれる', async () => {
      await scheduler.triggerManualUpdate();

      expect(mockDataStore.saveSchedules).toHaveBeenCalled();
    });

    it('上映作品データがある場合は saveMovies が呼ばれる', async () => {
      vi.mocked(mockScraper.scrapeShowing).mockResolvedValueOnce({
        success: true,
        data: {
          showing: [{ id: '1', title: '映画A', formats: ['通常'] }],
          upcoming: [],
          endingSoon: [],
          withSubtitle: [],
        },
        scrapedAt: new Date(),
      });

      await scheduler.triggerManualUpdate();

      expect(mockDataStore.saveMovies).toHaveBeenCalled();
    });
  });
});
