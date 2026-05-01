/**
 * スケジュールスクレイパーモジュール
 * シネマシティ公式サイトから上映スケジュール・作品情報をスクレイピングする
 */

import fetch from 'node-fetch';
import { CinemaCityParser } from './parser.js';
import type {
  IScheduleScraper,
  ScrapeResult,
  RawScheduleData,
  RawShowingData,
  RawMovieDetail,
  ParsedShowing,
} from '../types/index.js';

// ============================================================
// スクレイピング対象URL
// ============================================================

const BASE_URL = 'https://res.cinemacity.co.jp/TicketReserver';
const SCHEDULE_URL = `${BASE_URL}/schedule`;
const SHOWING_URL = `${BASE_URL}/showing`;
const UPCOMING_URL = `${BASE_URL}/showing/new`;
const ENDING_SOON_URL = `${BASE_URL}/showing/end`;
const MOVIE_DETAIL_URL = `${BASE_URL}/studio/movie`;

// ============================================================
// ユーティリティ関数
// ============================================================

/**
 * 指定ミリ秒待機する
 * @param ms 待機時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// スクレイパークラス
// ============================================================

/**
 * シネマシティのスケジュールスクレイパー
 * IScheduleScraper インターフェースを実装する
 */
export class CinemaCityScheduleScraper implements IScheduleScraper {
  /** HTMLパーサーインスタンス */
  private readonly parser: CinemaCityParser;

  /** 最後にリクエストを送信した時刻（ミリ秒） */
  private lastRequestTime: number = 0;

  /** 連続失敗回数（3回以上でアラートログを記録する） */
  private consecutiveFailures: number = 0;

  /** リクエスト間隔の最小値（ミリ秒） */
  private readonly minRequestInterval: number;

  /**
   * コンストラクタ
   * @param minRequestInterval リクエスト間隔の最小値（ミリ秒）。デフォルト1000ms（要件1.7）
   */
  constructor(minRequestInterval: number = 1000) {
    this.parser = new CinemaCityParser();
    this.minRequestInterval = minRequestInterval;
  }

  // ============================================================
  // リクエスト間隔制御
  // ============================================================

  /**
   * リクエスト間隔を制御する
   * 前回のリクエストから minRequestInterval ミリ秒未満の場合は待機する（要件1.7）
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (this.lastRequestTime > 0 && elapsed < this.minRequestInterval) {
      await sleep(this.minRequestInterval - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  // ============================================================
  // エラーハンドリング
  // ============================================================

  /**
   * スクレイピング失敗時の処理
   * 連続失敗回数をカウントし、3回以上でアラートレベルのログを記録する（要件9.2）
   * @param error エラーオブジェクトまたはメッセージ
   */
  private handleFailure(error: unknown): void {
    this.consecutiveFailures++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[CinemaCityScheduleScraper] スクレイピングに失敗しました: ${errorMessage}`);

    if (this.consecutiveFailures >= 3) {
      // 連続3回以上失敗した場合はアラートレベルのログを記録する（要件9.2）
      console.error(
        `[ALERT][CinemaCityScheduleScraper] スクレイピングが連続${this.consecutiveFailures}回失敗しました。管理者の確認が必要です。`
      );
    }
  }

  /**
   * スクレイピング成功時の処理
   * 連続失敗回数をリセットする
   */
  private handleSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /**
   * HTTPレスポンスのステータスコードを検証する
   * 4xx/5xx の場合はエラーをスローする（要件1.5）
   * @param response fetchのレスポンスオブジェクト
   */
  private validateResponse(response: { ok: boolean; status: number; statusText: string }): void {
    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status} ${response.statusText}`);
    }
  }

  // ============================================================
  // スクレイピングメソッド
  // ============================================================

  /**
   * 利用可能な日付一覧をスクレイピングする
   * カレンダーのリンクから日付を抽出する
   */
  async scrapeAvailableDates(): Promise<string[]> {
    try {
      await this.throttle();
      const response = await fetch(SCHEDULE_URL);
      if (!response.ok) return [];
      const html = await response.text();
      return this.parser.parseAvailableDates(html);
    } catch {
      return [];
    }
  }

  /**
   * 指定日付の上映スケジュールをスクレイピングする（要件1.1）
   * @param date 上映日（YYYY-MM-DD形式）
   * @returns スクレイピング結果
   */
  async scrapeSchedule(date: string): Promise<ScrapeResult<RawScheduleData>> {
    const scrapedAt = new Date();

    try {
      // リクエスト間隔を制御する（要件1.7）
      await this.throttle();

      const url = `${SCHEDULE_URL}/${date.replace(/-/g, '')}`;
      console.log(`[CinemaCityScheduleScraper] スケジュールページを取得します: ${url}`);

      const response = await fetch(url);
      this.validateResponse(response);

      const html = await response.text();
      const parsedSchedules = this.parser.parseSchedulePage(html);

      // HTMLから実際の日付を取得する（サイトが別の日付にリダイレクトする場合に対応）
      const actualDate = this.parser.parseScheduleDate(html) ?? date;

      const data: RawScheduleData = {
        date: actualDate,
        theater: '',
        entries: parsedSchedules.map(s => ({
          movieTitle: s.movieTitle,
          studio: s.studio,
          timeSlot: `${s.startTime} (${s.endTime})`,
          format: s.format,
          theater: s.theater ?? 'cinema-one',
          startTime: s.startTime,
          endTime: s.endTime,
          movieId: s.movieId,
        })),
      };

      this.handleSuccess();
      return { success: true, data, scrapedAt };
    } catch (error) {
      // HTTPエラー時はエラーをログに記録し、既存データを保持する（要件1.5）
      this.handleFailure(error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        scrapedAt,
      };
    }
  }

  /**
   * 上映中・上映予定・終了間近作品一覧をスクレイピングする（要件1.2）
   * 上映中: /showing、上映予定: /showing/new、終了間近: /showing/end の3URLから取得する
   * @returns スクレイピング結果
   */
  async scrapeShowing(): Promise<ScrapeResult<RawShowingData>> {
    const scrapedAt = new Date();

    try {
      // 上映中ページを取得する（要件1.7: リクエスト間隔を制御する）
      await this.throttle();
      console.log(`[CinemaCityScheduleScraper] 上映中ページを取得します: ${SHOWING_URL}`);
      const showingResponse = await fetch(SHOWING_URL);
      this.validateResponse(showingResponse);
      const showingHtml = await showingResponse.text();
      const showingParsed = this.parser.parseShowingPage(showingHtml);

      // 上映予定ページを取得する
      await this.throttle();
      console.log(`[CinemaCityScheduleScraper] 上映予定ページを取得します: ${UPCOMING_URL}`);
      const upcomingResponse = await fetch(UPCOMING_URL);
      this.validateResponse(upcomingResponse);
      const upcomingHtml = await upcomingResponse.text();
      const upcomingParsed = this.parser.parseShowingPage(upcomingHtml);

      // 終了間近ページを取得する
      await this.throttle();
      console.log(`[CinemaCityScheduleScraper] 終了間近ページを取得します: ${ENDING_SOON_URL}`);
      const endingResponse = await fetch(ENDING_SOON_URL);
      this.validateResponse(endingResponse);
      const endingHtml = await endingResponse.text();
      const endingParsed = this.parser.parseShowingPage(endingHtml);

      // パース結果を RawShowingData 形式に変換する
      // 各ページの全映画を対応するステータスで登録する
      const data: RawShowingData = {
        showing: showingParsed
          .map((s: ParsedShowing) => ({ id: s.id, title: s.title, formats: s.formats })),
        upcoming: upcomingParsed
          .map((s: ParsedShowing) => ({ id: s.id, title: s.title, formats: s.formats })),
        endingSoon: endingParsed
          .map((s: ParsedShowing) => ({ id: s.id, title: s.title, formats: s.formats })),
        withSubtitle: [],
      };

      console.log(`[CinemaCityScheduleScraper] 上映中: ${data.showing.length}件, 上映予定: ${data.upcoming.length}件, 終了間近: ${data.endingSoon.length}件`);

      this.handleSuccess();
      return { success: true, data, scrapedAt };
    } catch (error) {
      // HTTPエラー時はエラーをログに記録し、既存データを保持する（要件1.5）
      this.handleFailure(error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        scrapedAt,
      };
    }
  }

  /**
   * 指定IDの映画詳細情報をスクレイピングする（要件1.3）
   * @param movieId 映画ID
   * @returns スクレイピング結果
   */
  async scrapeMovieDetail(movieId: string): Promise<ScrapeResult<RawMovieDetail>> {
    const scrapedAt = new Date();

    try {
      // リクエスト間隔を制御する（要件1.7）
      await this.throttle();

      const url = `${MOVIE_DETAIL_URL}/${movieId}`;
      console.log(`[CinemaCityScheduleScraper] 映画詳細ページを取得します: ${url}`);

      const response = await fetch(url);
      this.validateResponse(response);

      const html = await response.text();
      const parsedDetail = this.parser.parseMovieDetailPage(html);

      const data: RawMovieDetail = {
        id: movieId,
        title: parsedDetail.title,
        formats: parsedDetail.formats,
        status: parsedDetail.status,
        detailUrl: url,
        // 作品紹介文を設定する（要件3.1, 3.2）
        description: parsedDetail.description,
      };

      this.handleSuccess();
      return { success: true, data, scrapedAt };
    } catch (error) {
      // HTTPエラー時はエラーをログに記録し、既存データを保持する（要件1.5）
      this.handleFailure(error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        scrapedAt,
      };
    }
  }

  // ============================================================
  // 状態取得メソッド
  // ============================================================

  /**
   * 連続失敗回数を取得する（テスト用）
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * 最後にリクエストを送信した時刻を取得する（テスト用）
   */
  getLastRequestTime(): number {
    return this.lastRequestTime;
  }
}
