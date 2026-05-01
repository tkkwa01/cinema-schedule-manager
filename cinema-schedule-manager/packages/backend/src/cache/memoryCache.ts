/**
 * メモリキャッシュモジュール
 * node-cache を使用して TTL=30秒 のインメモリキャッシュを提供する（要件7.3）
 * スクレイピング実行中も既存キャッシュを提供し続ける（要件2.4）
 */

import NodeCache from 'node-cache';

// ============================================================
// キャッシュ設定
// ============================================================

/** デフォルトのキャッシュTTL（秒）。30秒以内の同一リクエストはキャッシュから返す（要件7.3） */
const DEFAULT_TTL_SECONDS = 30;

// ============================================================
// メモリキャッシュクラス
// ============================================================

/**
 * メモリキャッシュの実装クラス
 * node-cache を使用してTTLベースのキャッシュを提供する
 */
export class MemoryCache {
  /** node-cache インスタンス */
  private readonly cache: NodeCache;

  /** スクレイピング実行中フラグ */
  private isScrapingInProgress: boolean = false;

  /**
   * コンストラクタ
   * @param ttlSeconds キャッシュのTTL（秒）。デフォルト30秒
   */
  constructor(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      // TTL経過後に自動削除する
      deleteOnExpire: true,
      // キャッシュヒット時にTTLをリセットしない
      useClones: false,
    });
  }

  // ============================================================
  // キャッシュ操作メソッド
  // ============================================================

  /**
   * キャッシュからデータを取得する
   * @param key キャッシュキー
   * @returns キャッシュされたデータ（存在しない場合は undefined）
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      console.log(`[MemoryCache] キャッシュヒット: ${key}`);
    } else {
      console.log(`[MemoryCache] キャッシュミス: ${key}`);
    }
    return value;
  }

  /**
   * データをキャッシュに保存する
   * @param key キャッシュキー
   * @param value 保存するデータ
   * @param ttl TTL（秒）。省略時はデフォルトTTLを使用
   */
  set<T>(key: string, value: T, ttl?: number): void {
    if (ttl !== undefined) {
      this.cache.set(key, value, ttl);
    } else {
      this.cache.set(key, value);
    }
    console.log(`[MemoryCache] キャッシュ保存: ${key}`);
  }

  /**
   * キャッシュからデータを削除する
   * @param key キャッシュキー
   */
  delete(key: string): void {
    this.cache.del(key);
    console.log(`[MemoryCache] キャッシュ削除: ${key}`);
  }

  /**
   * すべてのキャッシュをクリアする
   */
  flush(): void {
    this.cache.flushAll();
    console.log('[MemoryCache] キャッシュをすべてクリアしました');
  }

  /**
   * キャッシュにデータが存在するか確認する
   * @param key キャッシュキー
   * @returns データが存在する場合は true
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // ============================================================
  // スクレイピング状態管理
  // ============================================================

  /**
   * スクレイピング実行中フラグを設定する
   * スクレイピング中は既存キャッシュを提供し続ける（要件2.4）
   * @param inProgress スクレイピング実行中の場合は true
   */
  setScrapingInProgress(inProgress: boolean): void {
    this.isScrapingInProgress = inProgress;
    console.log(`[MemoryCache] スクレイピング状態: ${inProgress ? '実行中' : '完了'}`);
  }

  /**
   * スクレイピング実行中かどうかを取得する
   * @returns スクレイピング実行中の場合は true
   */
  getScrapingInProgress(): boolean {
    return this.isScrapingInProgress;
  }

  /**
   * キャッシュからデータを取得する（スクレイピング中も既存データを返す）
   * スクレイピング実行中の場合でも、既存のキャッシュデータを返す（要件2.4）
   * @param key キャッシュキー
   * @returns キャッシュされたデータ（存在しない場合は undefined）
   */
  getWithScrapingFallback<T>(key: string): { data: T | undefined; cached: boolean; scrapingInProgress: boolean } {
    const data = this.get<T>(key);
    return {
      data,
      cached: data !== undefined,
      scrapingInProgress: this.isScrapingInProgress,
    };
  }

  // ============================================================
  // キャッシュ統計
  // ============================================================

  /**
   * キャッシュの統計情報を取得する（デバッグ用）
   */
  getStats(): NodeCache.Stats {
    return this.cache.getStats();
  }
}

// ============================================================
// シングルトンインスタンスのエクスポート
// ============================================================

/**
 * デフォルトのメモリキャッシュインスタンス（TTL=30秒）
 * アプリケーション全体で共有するシングルトンインスタンス
 */
export const memoryCache = new MemoryCache(DEFAULT_TTL_SECONDS);
