import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    /* React JSXトランスフォームを有効化 */
    react(),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      /* バックエンドAPIへのプロキシ設定 */
      /* 開発時: フロントエンド(5173) → バックエンド(3000) へリクエストを転送 */
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        /* 必要に応じてパスの書き換えを設定する */
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  build: {
    /* ビルド出力先 */
    outDir: 'dist',
    /* ソースマップを生成（デバッグ用） */
    sourcemap: true,
    /* チャンクサイズの警告しきい値（KB） */
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        /* ベンダーライブラリを別チャンクに分割（キャッシュ効率化） */
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
