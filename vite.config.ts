import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  server: {
    allowedHosts: ['.monkeycode-ai.online'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  // 预览服务器同样需要跨域隔离头
  preview: {
    allowedHosts: ['.monkeycode-ai.online'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
