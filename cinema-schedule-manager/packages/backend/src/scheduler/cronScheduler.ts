/**
 * cronスケジューラーモジュール
 * node-cron を使用して定期的にスクレイパーを実行し、データを最新状態に保つ（要件2.1）
 */

import cron from 'node-cron';
import type { IScheduler, UpdateResult, IDataStore, IScheduleScraper, ShowingStatus } from '../types/index.js';

// ============================================================
// スケジューラークラス
// ============================================================

/**
 * cronスケジューラーの実装クラス
 * IScheduler インターフェースを実装する
 */
export class CronScheduler implements IScheduler {
  /** node-cron のタスクインスタンス */
  private task: cron.ScheduledTask | null = null;

  /** スクレイパーインスタンス */
  private readonly scraper: IScheduleScraper;

  /** データストアインスタンス */
  private readonly dataStore: IDataStore;

  /** 最後に更新が実行された日時 */
  private lastUpdateTime: Date | null = null;

  /** 更新間隔（分）。デフォルト60分（要件2.1） */
  private readonly intervalMinutes: number;

  /** 手動更新が実行中かどうか */
  private isUpdating: boolean = false;

  /**
   * コンストラクタ
   * @param scraper スクレイパーインスタンス
   * @param dataStore データストアインスタンス
   * @param intervalMinutes 更新間隔（分）。デフォルト60分
   */
  constructor(
    scraper: IScheduleScraper,
    dataStore: IDataStore,
    intervalMinutes: number = 60
  ) {
    this.scraper = scraper;
    this.dataStore = dataStore;
    this.intervalMinutes = intervalMinutes;
  }

  // ============================================================
  // スケジューラー制御
  // ============================================================

  /**
   * スケジューラーを開始する（要件2.1）
   * 設定された間隔でスクレイパーを定期実行する
   */
  start(): void {
    if (this.task) {
      console.log('[CronScheduler] スケジューラーはすでに起動しています');
      return;
    }

    // 分単位の間隔を cron 式に変換する
    // 例: 60分 → "0 * * * *"（毎時0分）、30分 → "*/30 * * * *"
    const cronExpression = this.buildCronExpression(this.intervalMinutes);
    console.log(`[CronScheduler] スケジューラーを開始します（間隔: ${this.intervalMinutes}分, cron: ${cronExpression}）`);

    this.task = cron.schedule(cronExpression, async () => {
      console.log('[CronScheduler] 定期スクレイピングを開始します');
      await this.runUpdate();
    });
  }

  /**
   * スケジューラーを停止する
   */
  stop(): void {
    if (!this.task) {
      console.log('[CronScheduler] スケジューラーは起動していません');
      return;
    }

    this.task.stop();
    this.task = null;
    console.log('[CronScheduler] スケジューラーを停止しました');
  }

  /**
   * 手動更新を即時実行し、完了後に結果を返す（要件2.3）
   * @param date 取得する日付（省略時は今日）
   * @returns 更新結果
   */
  async triggerManualUpdate(date?: string): Promise<UpdateResult> {
    console.log('[CronScheduler] 手動更新を開始します');
    return await this.runUpdate(date);
  }

  /**
   * 最後に更新が実行された日時を取得する
   * @returns 最終更新日時（未実行の場合は null）
   */
  getLastUpdateTime(): Date | null {
    return this.lastUpdateTime;
  }

  /**
   * 更新が実行中かどうかを取得する
   * @returns 更新実行中の場合は true
   */
  getIsUpdating(): boolean {
    return this.isUpdating;
  }

  // ============================================================
  // 内部メソッド
  // ============================================================

  /**
   * スクレイピングを実行してデータを更新する
   * @param targetDate 取得する日付（省略時は今日）
   * @returns 更新結果
   */
  private async runUpdate(targetDate?: string): Promise<UpdateResult> {
    if (this.isUpdating) {
      console.log('[CronScheduler] 更新がすでに実行中です。スキップします');
      return {
        success: false,
        updatedAt: new Date(),
        error: '更新がすでに実行中です',
      };
    }

    this.isUpdating = true;
    const updatedAt = new Date();

    try {
      // 今日の日付でスケジュールをスクレイピングする（ローカル時刻基準）
      const now = new Date();
      const today = targetDate ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const scheduleResult = await this.scraper.scrapeSchedule(today);

      if (!scheduleResult.success || !scheduleResult.data) {
        throw new Error(scheduleResult.error ?? 'スケジュールのスクレイピングに失敗しました');
      }

      // 上映作品情報をスクレイピングする
      const showingResult = await this.scraper.scrapeShowing();

      // スケジュールデータをデータストアに保存する
      // まず映画データを movies テーブルに保存してから schedules を保存する（外部キー制約）
      const scheduleEntries = scheduleResult.data.entries;
      // サイトが返す日付ではなくリクエストした日付を使用する
      // （parseScheduleDate がページ内の別の日付にマッチする問題を回避）
      const actualDate = today;

      // スケジュールから映画IDとタイトルを抽出して movies テーブルに先に保存する
      // movieId -> { title, status, description } のマップ（ステータスと紹介文を正しく保持するため）
      const movieMap = new Map<string, { title: string; status: ShowingStatus; description?: string }>();
      scheduleEntries.forEach(entry => {
        const movieId = (entry.movieId ??
          entry.movieTitle.replace(/[\s　]+/g, '-').replace(/[^\w\-ぁ-んァ-ン一-龯]/g, '').toLowerCase()) || 'unknown';
        movieMap.set(movieId, { title: entry.movieTitle, status: 'showing' });
      });

      // showing ページから取得した映画IDを正しいステータスで追加する（要件2.4, 2.5）
      // タイトルはスケジュールページから取得した値を優先する（showing ページの alt は "no image" になる場合がある）
      if (showingResult.success && showingResult.data) {
        // 上映中の映画を 'showing' ステータスで追加する
        showingResult.data.showing.forEach(m => {
          const existing = movieMap.get(m.id);
          movieMap.set(m.id, { title: existing?.title ?? m.title, status: 'showing' });
        });
        // 上映予定の映画を 'upcoming' ステータスで追加する
        showingResult.data.upcoming.forEach(m => {
          const existing = movieMap.get(m.id);
          movieMap.set(m.id, { title: existing?.title ?? m.title, status: 'upcoming' });
        });
        // 終了間近の映画を 'ending_soon' ステータスで追加する
        showingResult.data.endingSoon.forEach(m => {
          const existing = movieMap.get(m.id);
          movieMap.set(m.id, { title: existing?.title ?? m.title, status: 'ending_soon' });
        });
      }

      // タイトルが "no image" または空の映画、あるいは description が未取得の映画は詳細ページから情報を取得する
      // ただし、DBに既にタイトルと description が保存されている映画は詳細取得をスキップする（パフォーマンス最適化）
      const moviesNeedingDetail = Array.from(movieMap.entries()).filter(
        ([, { title }]) => !title || title === 'no image'
      );
      
      // DBから既存の映画データを取得する
      const existingMovies = this.dataStore.getMovies();
      const existingMovieMap = new Map(existingMovies.map(m => [m.id, m]));

      // description が空の映画も詳細取得対象に追加する（タイトルがある映画も含む）
      const allMovieIds = Array.from(movieMap.keys());
      const moviesNeedingDescription = allMovieIds.filter(movieId => {
        const existing = existingMovieMap.get(movieId);
        // DBに description が保存されていない（空文字列または undefined）場合は取得する
        return !existing?.description;
      });

      // 詳細取得が必要な映画IDをまとめる（重複除去）
      const noTitleMovieIds = new Set(moviesNeedingDetail.map(([id]) => id));
      const needsDescriptionIds = new Set(moviesNeedingDescription);
      const allNeedDetailIds = new Set([...noTitleMovieIds, ...needsDescriptionIds]);

      if (allNeedDetailIds.size > 0) {
        // 既存タイトルを使用する（タイトルが "no image" または空の映画のうち、DBにタイトルがあるもの）
        for (const [movieId, entry] of moviesNeedingDetail) {
          const existingMovie = existingMovieMap.get(movieId);
          if (existingMovie?.title && existingMovie.title !== 'no image') {
            movieMap.set(movieId, {
              title: existingMovie.title,
              status: entry.status,
              description: existingMovie.description ?? undefined,
            });
            // タイトルが補完できた場合は description 取得のみ必要かチェック
            if (existingMovie.description) {
              allNeedDetailIds.delete(movieId);
            }
          }
        }

        // 詳細取得が必要な映画のみリクエストを送る（タイトル補完 + description取得）
        const moviesToFetch = Array.from(allNeedDetailIds);
        console.log(`[CronScheduler] 詳細取得: ${moviesToFetch.length}件の映画詳細を取得します`);
        for (const movieId of moviesToFetch) {
          const entry = movieMap.get(movieId);
          if (!entry) continue;
          const detailResult = await this.scraper.scrapeMovieDetail(movieId);
          if (detailResult.success && detailResult.data) {
            movieMap.set(movieId, {
              title: detailResult.data.title || entry.title,
              status: entry.status,
              description: detailResult.data.description ?? '',
            });
          } else {
            // 失敗時は description を空文字列として継続（他の映画の処理を止めない）
            movieMap.set(movieId, { ...entry, description: entry.description ?? '' });
          }
        }
      }

      // movies テーブルに映画データを正しいステータスで保存する（スケジュールの外部キー制約を満たすため）
      const scheduleMovies = Array.from(movieMap.entries()).map(([id, { title, status, description }]) => ({
        id,
        title,
        status,
        hasSubtitle: false,
        formats: [],
        description: description ?? '',
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      }));
      if (scheduleMovies.length > 0) {
        this.dataStore.saveMovies(scheduleMovies);
      }

      const schedules = scheduleEntries.map((entry, index) => {
        const timeMatch = entry.timeSlot.match(/^(\d{2}:\d{2})\s+\((\d{2}:\d{2})\)$/);
        const theater = (entry.theater === 'cinema-two' ? 'cinema-two' : 'cinema-one') as 'cinema-one' | 'cinema-two';
        // パーサーが取得した映画IDを優先し、なければタイトルからIDを生成する
        const movieId = (entry.movieId ??
          entry.movieTitle.replace(/[\s　]+/g, '-').replace(/[^\w\-ぁ-んァ-ン一-龯]/g, '').toLowerCase()) || 'unknown';
        return {
          id: index,
          movieId,
          movieTitle: entry.movieTitle,
          date: actualDate,
          theater,
          studio: entry.studio,
          startTime: entry.startTime ?? timeMatch?.[1] ?? '',
          endTime: entry.endTime ?? timeMatch?.[2] ?? '',
          format: entry.format,
          createdAt: updatedAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        };
      });

      this.dataStore.saveSchedules(actualDate, schedules);

      // スクレイピング完了日時をデータストアに記録する（要件2.2）
      this.dataStore.saveLastScrapedAt(updatedAt);
      this.lastUpdateTime = updatedAt;

      console.log(`[CronScheduler] 更新が完了しました: ${updatedAt.toISOString()}`);
      return { success: true, updatedAt, actualDate };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CronScheduler] 更新に失敗しました: ${errorMessage}`);
      return { success: false, updatedAt, error: errorMessage };
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 更新間隔（分）から cron 式を生成する
   * @param intervalMinutes 更新間隔（分）
   * @returns cron 式
   */
  private buildCronExpression(intervalMinutes: number): string {
    if (intervalMinutes >= 60 && intervalMinutes % 60 === 0) {
      // 1時間以上の場合は時間単位の cron 式を使用する
      const hours = intervalMinutes / 60;
      return `0 */${hours} * * *`;
    } else {
      // 分単位の cron 式を使用する
      return `*/${intervalMinutes} * * * *`;
    }
  }
}
