import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    /* React JSXトランスフォームを有効化 */
    react(),
  ],
  test: {
    /* テスト環境設定（DOMシミュレーション） */
    environment: 'jsdom',

    /* テストファイルのパターン */
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],

    /* グローバル設定（describe/it/expect をインポートなしで使用可能） */
    globals: true,

    /* セットアップファイル（@testing-library/jest-dom の拡張マッチャーを読み込む） */
    setupFiles: ['./tests/setup.ts'],

    /* カバレッジ設定 */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/vite-env.d.ts'],
      /* フロントエンドユーティリティ関数のカバレッジ目標: 80%以上 */
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
