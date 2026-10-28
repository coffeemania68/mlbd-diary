import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// 바탕색은 src/styles/base.css의 --color-bg와 같은 값으로 맞춘다.
const APP_BG = '#f7f4ef';

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    VitePWA({
      registerType: 'prompt', // 새 버전은 다음 실행에 적용
      injectRegister: 'script', // 등록 코드 자동 삽입. 갱신 안내 UI 없음
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'My Last Best Diary',
        short_name: 'MLBD',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: APP_BG,
        theme_color: APP_BG,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    passWithNoTests: true,
  },
});
