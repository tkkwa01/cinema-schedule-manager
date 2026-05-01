/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // レスポンシブブレークポイント（要件8.1）
    screens: {
      // スマートフォン: 375px以上
      'sm': '375px',
      // タブレット: 768px以上
      'md': '768px',
      // デスクトップ: 1024px以上
      'lg': '1024px',
      'xl': '1280px',
    },
    extend: {},
  },
  plugins: [],
};
