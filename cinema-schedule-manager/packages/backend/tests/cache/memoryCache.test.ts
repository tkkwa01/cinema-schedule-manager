/**
 * メモリキャッシュモジュールのテスト
 * MemoryCache クラスの動作を検証する
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryCache } from '../../src/cache/memoryCache.js';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    // テストごとに短いTTL（1秒）のキャッシュを作成する
    cache = new MemoryCache(1);
  });

  afterEach(() => {
    cache.flush();
    vi.useRealTimers();
  });

  // ============================================================
  // 基本操作のテスト
  // ============================================================

  describe('基本操作', () => {
    it('データを保存して取得できる', () => {
      cache.set('key1', { value: 'test' });
      const result = cache.get<{ value: string }>('key1');
      expect(result).toEqual({ value: 'test' });
    });

    it('存在しないキーで undefined を返す', () => {
      const result = cache.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('データを削除できる', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('すべてのキャッシュをクリアできる', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.flush();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('has() でキャッシュの存在を確認できる', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('文字列・数値・オブジェクト・配列を保存できる', () => {
      cache.set('str', 'hello');
      cache.set('num', 42);
      cache.set('obj', { a: 1, b: 2 });
      cache.set('arr', [1, 2, 3]);

      expect(cache.get('str')).toBe('hello');
      expect(cache.get('num')).toBe(42);
      expect(cache.get('obj')).toEqual({ a: 1, b: 2 });
      expect(cache.get('arr')).toEqual([1, 2, 3]);
    });
  });

  // ============================================================
  // TTL のテスト（要件7.3）
  // ============================================================

  describe('TTL動作（要件7.3）', () => {
    it('TTL経過後にキャッシュが無効になる', async () => {
      // TTL=100msのキャッシュを作成する
      const shortCache = new MemoryCache(0.1); // 0.1秒 = 100ms
      shortCache.set('key1', 'value1');

      expect(shortCache.get('key1')).toBe('value1');

      // TTL経過を待つ
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(shortCache.get('key1')).toBeUndefined();
    });

    it('TTL内はキャッシュが有効である', async () => {
      const longCache = new MemoryCache(10); // 10秒
      longCache.set('key1', 'value1');

      // 少し待ってもキャッシュが有効であることを確認する
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(longCache.get('key1')).toBe('value1');
    });

    it('カスタムTTLを指定してデータを保存できる', async () => {
      // デフォルトTTL=10秒のキャッシュに、TTL=0.1秒でデータを保存する
      const cache2 = new MemoryCache(10);
      cache2.set('short-key', 'short-value', 0.1);
      cache2.set('long-key', 'long-value');

      await new Promise(resolve => setTimeout(resolve, 200));

      // 短いTTLのデータは期限切れ
      expect(cache2.get('short-key')).toBeUndefined();
      // 長いTTLのデータは有効
      expect(cache2.get('long-key')).toBe('long-value');
    });
  });

  // ============================================================
  // スクレイピング状態管理のテスト（要件2.4）
  // ============================================================

  describe('スクレイピング状態管理（要件2.4）', () => {
    it('スクレイピング実行中フラグを設定・取得できる', () => {
      expect(cache.getScrapingInProgress()).toBe(false);

      cache.setScrapingInProgress(true);
      expect(cache.getScrapingInProgress()).toBe(true);

      cache.setScrapingInProgress(false);
      expect(cache.getScrapingInProgress()).toBe(false);
    });

    it('getWithScrapingFallback でキャッシュデータとスクレイピング状態を同時に取得できる', () => {
      cache.set('schedules-2024-01-15', [{ id: 1 }]);
      cache.setScrapingInProgress(true);

      const result = cache.getWithScrapingFallback('schedules-2024-01-15');

      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.cached).toBe(true);
      expect(result.scrapingInProgress).toBe(true);
    });

    it('スクレイピング中でもキャッシュデータを返す（要件2.4）', () => {
      cache.set('key1', 'cached-value');
      cache.setScrapingInProgress(true);

      // スクレイピング中でもキャッシュからデータを取得できる
      const result = cache.getWithScrapingFallback<string>('key1');
      expect(result.data).toBe('cached-value');
      expect(result.scrapingInProgress).toBe(true);
    });

    it('キャッシュミス時は data が undefined になる', () => {
      const result = cache.getWithScrapingFallback('non-existent');
      expect(result.data).toBeUndefined();
      expect(result.cached).toBe(false);
    });
  });

  // ============================================================
  // 統計情報のテスト
  // ============================================================

  describe('統計情報', () => {
    it('getStats() で統計情報を取得できる', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // ヒット
      cache.get('non-existent'); // ミス

      const stats = cache.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });
  });
});
