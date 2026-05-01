import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    /* テスト環境設定 */
    environment: 'node',

    /* テストファイルのパターン */
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],

    /* グローバル設定（describe/it/expect をインポートなしで使用可能） */
    globals: true,

    /* カバレッジ設定 */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
      /* バックエンドビジネスロジックのカバレッジ目標: 80%以上 */
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },

    /* タイムアウト設定（プロパティベーステストは時間がかかる場合がある） */
    testTimeout: 30000,

    /* fast-checkのプロパティテスト設定 */
    /* 各プロパティテストは最低100回のイテレーションを実行する */
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
