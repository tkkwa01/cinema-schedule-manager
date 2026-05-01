/**
 * APIサーバーモジュール
 * Express を使用して REST API エンドポイントを提供する
 */

import express from 'express';
import cors from 'cors';
import type { IDataStore, IScheduler, ApiResponse, ApiError } from '../types/index.js';
import { MemoryCache } from '../cache/memoryCache.js';
import type { CinemaCityScheduleScraper } from '../scraper/scheduleScraper.js';

// ============================================================
// Expressアプリケーションの作成
// ============================================================

/**
 * Express アプリケーションを作成して設定する
 */
export function createApp(
  dataStore: IDataStore,
  scheduler: IScheduler,
  cache: MemoryCache,
  scraper?: CinemaCityScheduleScraper
): express.Application {
  const app = express();

  // ============================================================
  // ミドルウェアの設定
  // ============================================================

  // CORS設定（フロントエンドからのアクセスを許可する）
  app.use(cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }));

  // JSONボディパーサー
  app.use(express.json());

  // ============================================================
  // ユーティリティ関数
  // ============================================================

  /**
   * 成功レスポンスを生成する
   */
  function successResponse<T>(data: T, cached: boolean = false): ApiResponse<T> {
    const lastScrapedAt = dataStore.getLastScrapedAt();
    return {
      data,
      lastUpdatedAt: lastScrapedAt ? lastScrapedAt.toISOString() : null,
      cached,
    };
  }

  /**
   * エラーレスポンスを生成する
   */
  function errorResponse(message: string, code: string): ApiError {
    return {
      error: message,
      code,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // APIエンドポイント
  // ============================================================

  /**
   * GET /api/schedules?date=YYYY-MM-DD
   * 日付別スケジュールを取得する（要件2.3, 2.4, 2.5）
   */
  app.get('/api/schedules', (req, res) => {
    const date = req.query['date'] as string | undefined;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json(errorResponse(
        '日付パラメータが不正です。YYYY-MM-DD形式で指定してください。',
        'INVALID_DATE'
      ));
      return;
    }

    const cacheKey = `schedules:${date}`;

    // スクレイピング中かどうかを確認する（要件2.4）
    const { data: cachedData, cached, scrapingInProgress } = cache.getWithScrapingFallback(cacheKey);

    if (cachedData !== undefined) {
      // キャッシュヒット（要件7.3）
      const statusCode = scrapingInProgress ? 202 : 200;
      res.status(statusCode).json(successResponse(cachedData, cached));
      return;
    }

    // キャッシュミス: データストアから取得する
    const schedules = dataStore.getSchedulesByDate(date);

    if (schedules.length === 0 && !scrapingInProgress) {
      res.status(404).json(errorResponse(
        'この日付のスケジュールデータが見つかりません。',
        'DATA_NOT_FOUND'
      ));
      return;
    }

    // キャッシュに保存する
    cache.set(cacheKey, schedules);

    const statusCode = scrapingInProgress ? 202 : 200;
    res.status(statusCode).json(successResponse(schedules, false));
  });

  /**
   * GET /api/movies?status=&search=
   * 作品一覧を取得する（要件2.3, 2.5）
   */
  app.get('/api/movies', (req, res) => {
    const status = req.query['status'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    const cacheKey = `movies:${status ?? ''}:${search ?? ''}`;
    const { data: cachedData, cached } = cache.getWithScrapingFallback(cacheKey);

    if (cachedData !== undefined) {
      res.status(200).json(successResponse(cachedData, cached));
      return;
    }

    const filter: { status?: 'showing' | 'upcoming' | 'ending_soon'; search?: string } = {};
    if (status === 'showing' || status === 'upcoming' || status === 'ending_soon') {
      filter.status = status;
    }
    if (search) {
      filter.search = search;
    }

    const movies = dataStore.getMovies(filter);
    cache.set(cacheKey, movies);

    res.status(200).json(successResponse(movies, false));
  });

  /**
   * GET /api/movies/:id
   * 映画詳細情報を取得する（要件5.1, 5.2, 5.3, 5.4）
   * NOTE: /api/movies/:id/schedules より前に定義する必要がある
   */
  app.get('/api/movies/:id', (req, res) => {
    const movieId = req.params['id'];
    if (!movieId) {
      res.status(400).json(errorResponse('映画IDが指定されていません。', 'INVALID_ID'));
      return;
    }

    const cacheKey = `movie-detail:${movieId}`;
    const { data: cachedData, cached } = cache.getWithScrapingFallback(cacheKey);
    if (cachedData !== undefined) {
      res.status(200).json(successResponse(cachedData, cached));
      return;
    }

    const movie = dataStore.getMovieById(movieId);
    if (!movie) {
      res.status(404).json(errorResponse('指定された映画が見つかりません。', 'MOVIE_NOT_FOUND'));
      return;
    }

    cache.set(cacheKey, movie);
    res.status(200).json(successResponse(movie, false));
  });

  /**
   * GET /api/movies/:id/schedules
   * 作品別スケジュールを取得する（要件2.3, 2.5）
   */
  app.get('/api/movies/:id/schedules', (req, res) => {
    const movieId = req.params['id'];

    if (!movieId) {
      res.status(400).json(errorResponse('映画IDが指定されていません。', 'INVALID_ID'));
      return;
    }

    const movie = dataStore.getMovieById(movieId);
    if (!movie) {
      res.status(404).json(errorResponse('指定された映画が見つかりません。', 'MOVIE_NOT_FOUND'));
      return;
    }

    const cacheKey = `movie-schedules:${movieId}`;
    const { data: cachedData, cached } = cache.getWithScrapingFallback(cacheKey);

    if (cachedData !== undefined) {
      res.status(200).json(successResponse(cachedData, cached));
      return;
    }

    const schedules = dataStore.getSchedulesByMovieId(movieId);

    cache.set(cacheKey, schedules);
    res.status(200).json(successResponse(schedules, false));
  });

  /**
   * GET /api/dates
   * サイトで利用可能な日付一覧を取得する
   */
  app.get('/api/dates', async (_req, res) => {
    const cacheKey = 'available-dates';
    const cached = cache.get<string[]>(cacheKey);
    if (cached) {
      res.status(200).json({ dates: cached });
      return;
    }
    if (scraper) {
      const dates = await scraper.scrapeAvailableDates();
      if (dates.length > 0) {
        cache.set(cacheKey, dates, 300); // 5分キャッシュ
        res.status(200).json({ dates });
        return;
      }
    }
    res.status(200).json({ dates: [] });
  });

  /**
   * GET /api/status
   * 最終更新日時・スクレイピング状態を取得する（要件2.5, 9.1）
   */  app.get('/api/status', (_req, res) => {
    const lastScrapedAt = dataStore.getLastScrapedAt();
    const isScrapingInProgress = cache.getScrapingInProgress();

    res.status(200).json({
      lastUpdatedAt: lastScrapedAt ? lastScrapedAt.toISOString() : null,
      isScrapingInProgress,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/refresh
   * 手動更新トリガー（要件2.3）
   * クエリパラメータ date=YYYY-MM-DD で特定日付のスクレイピングも可能
   */
  app.post('/api/refresh', async (req, res) => {
    if (cache.getScrapingInProgress()) {
      res.status(503).json(errorResponse(
        'スクレイピングが実行中です。しばらく後に再試行してください。',
        'SCRAPING_IN_PROGRESS'
      ));
      return;
    }

    // クエリパラメータで日付が指定された場合はその日付でスクレイピングする
    const targetDate = req.query['date'] as string | undefined;

    try {
      cache.setScrapingInProgress(true);
      const result = await scheduler.triggerManualUpdate(targetDate);
      cache.setScrapingInProgress(false);

      // スケジュールキャッシュをクリアして最新データを返す
      cache.flush();
      cache.setScrapingInProgress(false);

      if (result.success) {
        res.status(200).json(successResponse({
          message: 'データを更新しました。',
          updatedAt: result.updatedAt.toISOString(),
          actualDate: result.actualDate,
        }, false));
      } else {
        res.status(500).json(errorResponse(
          result.error ?? 'データの更新に失敗しました。',
          'UPDATE_FAILED'
        ));
      }
    } catch (error) {
      cache.setScrapingInProgress(false);
      const message = error instanceof Error ? error.message : '不明なエラーが発生しました。';
      res.status(500).json(errorResponse(message, 'INTERNAL_ERROR'));
    }
  });

  return app;
}
