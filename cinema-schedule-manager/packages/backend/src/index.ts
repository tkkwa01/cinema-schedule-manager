/**
 * バックエンドサーバーのエントリーポイント
 * サーバー起動・スケジューラー起動・データベース初期化を結合する（要件2.1）
 */

import { createApp } from './api/server.js';
import { SqliteDataStore } from './datastore/database.js';
import { CinemaCityScheduleScraper } from './scraper/scheduleScraper.js';
import { CronScheduler } from './scheduler/cronScheduler.js';
import { MemoryCache } from './cache/memoryCache.js';
// ============================================================
// 設定値
// ============================================================

/** サーバーのポート番号 */
const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

/** スケジューラーの更新間隔（分）。デフォルト60分（要件2.1） */
const SCHEDULER_INTERVAL_MINUTES = parseInt(
  process.env['SCHEDULER_INTERVAL_MINUTES'] ?? '60',
  10
);

// ============================================================
// 依存関係の初期化
// ============================================================

console.log('[Server] シネマスケジュールマネージャー バックエンドサーバーを起動します...');

// データストアの初期化（SQLiteデータベース接続・マイグレーション実行）
const dataStore = new SqliteDataStore();
console.log('[Server] データストアを初期化しました');

// スクレイパーの初期化
const scraper = new CinemaCityScheduleScraper();
console.log('[Server] スクレイパーを初期化しました');

// メモリキャッシュの初期化（TTL=30秒）
const cache = new MemoryCache(30);
console.log('[Server] メモリキャッシュを初期化しました');

// スケジューラーの初期化
const scheduler = new CronScheduler(scraper, dataStore, SCHEDULER_INTERVAL_MINUTES);
console.log(`[Server] スケジューラーを初期化しました（更新間隔: ${SCHEDULER_INTERVAL_MINUTES}分）`);

// ============================================================
// Expressアプリケーションの作成
// ============================================================

const app = createApp(dataStore, scheduler, cache, scraper);

// ============================================================
// サーバーの起動
// ============================================================

const server = app.listen(PORT, () => {
  console.log(`[Server] サーバーが起動しました: http://localhost:${PORT}`);
  console.log('[Server] 利用可能なエンドポイント:');
  console.log(`  GET  http://localhost:${PORT}/api/schedules?date=YYYY-MM-DD`);
  console.log(`  GET  http://localhost:${PORT}/api/movies`);
  console.log(`  GET  http://localhost:${PORT}/api/movies/:id/schedules`);
  console.log(`  GET  http://localhost:${PORT}/api/status`);
  console.log(`  POST http://localhost:${PORT}/api/refresh`);

  // スケジューラーを開始する（要件2.1）
  scheduler.start();
  console.log('[Server] スケジューラーを開始しました');

  // 起動時に即座にスクレイピングを実行する
  console.log('[Server] 起動時スクレイピングを開始します...');
  scheduler.triggerManualUpdate().then(result => {
    if (result.success) {
      console.log(`[Server] 起動時スクレイピング完了: ${result.actualDate ?? '不明'}`);
    } else {
      console.error(`[Server] 起動時スクレイピング失敗: ${result.error}`);
    }
  }).catch(err => {
    console.error('[Server] 起動時スクレイピングエラー:', err);
  });
});

// ============================================================
// グレースフルシャットダウン
// ============================================================

/**
 * プロセス終了時にリソースを解放する
 */
function gracefulShutdown(signal: string): void {
  console.log(`\n[Server] ${signal} を受信しました。シャットダウンを開始します...`);

  // スケジューラーを停止する
  scheduler.stop();
  console.log('[Server] スケジューラーを停止しました');

  // HTTPサーバーを停止する
  server.close(() => {
    console.log('[Server] HTTPサーバーを停止しました');

    // データベース接続を閉じる
    if ('close' in dataStore && typeof (dataStore as { close: () => void }).close === 'function') {
      (dataStore as { close: () => void }).close();
      console.log('[Server] データベース接続を閉じました');
    }

    console.log('[Server] シャットダウンが完了しました');
    process.exit(0);
  });

  // 10秒以内にシャットダウンが完了しない場合は強制終了する
  setTimeout(() => {
    console.error('[Server] シャットダウンがタイムアウトしました。強制終了します');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
