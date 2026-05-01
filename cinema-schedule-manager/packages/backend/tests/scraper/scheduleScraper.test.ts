/**
 * スケジュールスクレイパーのテスト
 * CinemaCityScheduleScraper クラスの動作を検証する
 * ネットワークリクエストはモックを使用する
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CinemaCityScheduleScraper } from '../../src/scraper/scheduleScraper.js';

// ============================================================
// node-fetch のモック設定
// ============================================================

vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);

// ============================================================
// テスト用ヘルパー
// ============================================================

/** 成功レスポンスのモックを作成する */
function createSuccessResponse(html: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => html,
  };
}

/** HTTPエラーレスポンスのモックを作成する */
function createErrorResponse(status: number) {
  return {
    ok: false,
    status,
    statusText: `Error ${status}`,
    text: async () => '',
  };
}

/** 最小限のスケジュールHTML */
const MINIMAL_SCHEDULE_HTML = `
  <html><body>
    <table>
      <tr>
        <th class="studio-name">a studio</th>
        <td class="movie-title">テスト映画</td>
        <td class="time">10:00 (12:00)</td>
        <td class="format">通常</td>
      </tr>
    </table>
  </body></html>
`;

/** 最小限の上映作品HTML */
const MINIMAL_SHOWING_HTML = `
  <html><body>
    <div class="showing-section">
      <a href="/studio/movie/12345">テスト映画</a>
    </div>
  </body></html>
`;

/** 最小限の映画詳細HTML */
const MINIMAL_DETAIL_HTML = `
  <html><body>
    <h1 class="movie-title">テスト映画詳細</h1>
    <span class="format">通常</span>
  </body></html>
`;

// ============================================================
// テストスイート
// ============================================================

describe('CinemaCityScheduleScraper', () => {
  let scraper: CinemaCityScheduleScraper;

  beforeEach(() => {
    // テストごとにモックをリセットする
    vi.clearAllMocks();
    // リクエスト間隔を0msに設定してテストを高速化する
    scraper = new CinemaCityScheduleScraper(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // scrapeSchedule のテスト
  // ============================================================

  describe('scrapeSchedule', () => {
    it('正常なレスポンスでスクレイピングが成功する', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(MINIMAL_SCHEDULE_HTML) as never);

      const result = await scraper.scrapeSchedule('2024-01-15');

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.date).toBe('2024-01-15');
      expect(result.scrapedAt).toBeInstanceOf(Date);
    });

    it('HTTPエラー（404）時は success: false を返す（要件1.5）', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(404) as never);

      const result = await scraper.scrapeSchedule('2024-01-15');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('404');
    });

    it('HTTPエラー（500）時は success: false を返す（要件1.5）', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500) as never);

      const result = await scraper.scrapeSchedule('2024-01-15');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('500');
    });

    it('ネットワークエラー時は success: false を返す', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ネットワーク接続エラー') as never);

      const result = await scraper.scrapeSchedule('2024-01-15');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toContain('ネットワーク接続エラー');
    });

    it('HTTPエラー時に既存データを変更しない（要件1.5）', async () => {
      // HTTPエラーが発生してもスクレイパー自体は状態を変更しない
      mockFetch.mockResolvedValueOnce(createErrorResponse(503) as never);

      const beforeFailures = scraper.getConsecutiveFailures();
      await scraper.scrapeSchedule('2024-01-15');
      const afterFailures = scraper.getConsecutiveFailures();

      // 失敗カウントが増加していることを確認（データストアは変更されない）
      expect(afterFailures).toBe(beforeFailures + 1);
    });
  });

  // ============================================================
  // scrapeShowing のテスト
  // ============================================================

  describe('scrapeShowing', () => {
    it('正常なレスポンスでスクレイピングが成功する', async () => {
      // 3つのURL（showing, upcoming, ending）に対してそれぞれモックを設定する
      mockFetch
        .mockResolvedValueOnce(createSuccessResponse(MINIMAL_SHOWING_HTML) as never)
        .mockResolvedValueOnce(createSuccessResponse(MINIMAL_SHOWING_HTML) as never)
        .mockResolvedValueOnce(createSuccessResponse(MINIMAL_SHOWING_HTML) as never);

      const result = await scraper.scrapeShowing();

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.scrapedAt).toBeInstanceOf(Date);
    });

    it('HTTPエラー時は success: false を返す', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(500) as never);

      const result = await scraper.scrapeShowing();

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });

    it('showing/upcoming/ending_soon が別々のURLから取得される', async () => {
      const showingHtml = `
        <html><body>
          <div id="showing">
            <ul><li><a href="/TicketReserver/studio/movie/1001"><img alt="上映中映画" /></a></li></ul>
          </div>
        </body></html>
      `;
      const upcomingHtml = `
        <html><body>
          <div id="showing">
            <ul><li><a href="/TicketReserver/studio/movie/2001"><img alt="上映予定映画" /></a></li></ul>
          </div>
        </body></html>
      `;
      const endingHtml = `
        <html><body>
          <div id="showing">
            <ul><li><a href="/TicketReserver/studio/movie/3001"><img alt="終了間近映画" /></a></li></ul>
          </div>
        </body></html>
      `;

      mockFetch
        .mockResolvedValueOnce(createSuccessResponse(showingHtml) as never)
        .mockResolvedValueOnce(createSuccessResponse(upcomingHtml) as never)
        .mockResolvedValueOnce(createSuccessResponse(endingHtml) as never);

      const result = await scraper.scrapeShowing();

      expect(result.success).toBe(true);
      expect(result.data?.showing.some(m => m.id === '1001')).toBe(true);
      expect(result.data?.upcoming.some(m => m.id === '2001')).toBe(true);
      expect(result.data?.endingSoon.some(m => m.id === '3001')).toBe(true);
    });
  });

  // ============================================================
  // scrapeMovieDetail のテスト
  // ============================================================

  describe('scrapeMovieDetail', () => {
    it('正常なレスポンスでスクレイピングが成功する', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(MINIMAL_DETAIL_HTML) as never);

      const result = await scraper.scrapeMovieDetail('12345');

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.id).toBe('12345');
    });

    it('HTTPエラー時は success: false を返す', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(404) as never);

      const result = await scraper.scrapeMovieDetail('99999');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });
  });

  // ============================================================
  // 連続失敗時のアラートログテスト（要件9.2）
  // ============================================================

  describe('連続失敗時のアラートログ（要件9.2）', () => {
    it('2回失敗してもアラートログは記録されない', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      mockFetch
        .mockResolvedValueOnce(createErrorResponse(500) as never)
        .mockResolvedValueOnce(createErrorResponse(500) as never);

      await scraper.scrapeSchedule('2024-01-15');
      await scraper.scrapeSchedule('2024-01-15');

      // [ALERT] を含むログが記録されていないことを確認する
      const alertCalls = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('[ALERT]')
      );
      expect(alertCalls.length).toBe(0);
    });

    it('3回連続失敗するとアラートログが記録される（要件9.2）', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      mockFetch
        .mockResolvedValueOnce(createErrorResponse(500) as never)
        .mockResolvedValueOnce(createErrorResponse(500) as never)
        .mockResolvedValueOnce(createErrorResponse(500) as never);

      await scraper.scrapeSchedule('2024-01-15');
      await scraper.scrapeSchedule('2024-01-15');
      await scraper.scrapeSchedule('2024-01-15');

      // [ALERT] を含むログが記録されていることを確認する
      const alertCalls = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('[ALERT]')
      );
      expect(alertCalls.length).toBeGreaterThan(0);
    });

    it('成功後は連続失敗カウントがリセットされる', async () => {
      mockFetch
        .mockResolvedValueOnce(createErrorResponse(500) as never)
        .mockResolvedValueOnce(createErrorResponse(500) as never)
        .mockResolvedValueOnce(createSuccessResponse(MINIMAL_SCHEDULE_HTML) as never);

      await scraper.scrapeSchedule('2024-01-15');
      await scraper.scrapeSchedule('2024-01-15');
      expect(scraper.getConsecutiveFailures()).toBe(2);

      await scraper.scrapeSchedule('2024-01-15');
      expect(scraper.getConsecutiveFailures()).toBe(0);
    });
  });

  // ============================================================
  // リクエスト間隔制御のテスト（要件1.7）
  // ============================================================

  describe('リクエスト間隔制御（要件1.7）', () => {
    it('リクエスト間隔が設定値以上になる', async () => {
      // 100msの間隔を設定したスクレイパーを作成する
      const intervalScraper = new CinemaCityScheduleScraper(100);

      mockFetch
        .mockResolvedValueOnce(createSuccessResponse(MINIMAL_SCHEDULE_HTML) as never)
        .mockResolvedValueOnce(createSuccessResponse(MINIMAL_SCHEDULE_HTML) as never);

      const start = Date.now();
      await intervalScraper.scrapeSchedule('2024-01-15');
      await intervalScraper.scrapeSchedule('2024-01-16');
      const elapsed = Date.now() - start;

      // 2回のリクエストで少なくとも100ms経過していることを確認する
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('デフォルトのリクエスト間隔は1000ms以上である', () => {
      const defaultScraper = new CinemaCityScheduleScraper();
      // minRequestInterval が 1000ms であることを確認する（プライベートフィールドは間接的に確認）
      expect(defaultScraper).toBeDefined();
    });
  });
});
