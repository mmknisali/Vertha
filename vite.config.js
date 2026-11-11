import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';

  return {
    base: './',
    plugins: [
      react(),
      ...(isElectron ? [
        electron([
          {
            entry: 'electron/main.js',
            onstart(args) {
              args.startup();
            },
          },
          {
            entry: 'electron/preload.js',
            onstart(args) {
              args.reload();
            },
          },
        ]),
        renderer(),
      ] : []),
    ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Set VERTHA_DEV_HOST=0.0.0.0 to open the dev page from another machine.
    host: process.env.VERTHA_DEV_HOST || 'localhost',
    port: 5173,
    proxy: {
      '/api/zen': {
        target: 'https://opencode.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zen/, '/zen'),
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  };
});