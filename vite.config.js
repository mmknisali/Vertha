import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

// The Zen key for AI answers is read on the server from ZEN_API_KEY (in .env.local at
// the project root, or in the shell). It is attached to the proxied request here and
// never shipped in the page bundle. Without it the page shows a clear error instead.
const ZEN_MISSING =
  'The AI answers need the Zen key. Set ZEN_API_KEY in .env.local at the project root ' +
  '(or in the shell) and restart the dev server.';

function zenKeyGuard(zenKey) {
  return {
    name: 'vertha-zen-key-guard',
    configureServer(server) {
      // Lets the page ask whether the server holds a key, without ever receiving it.
      server.middlewares.use('/api/vertha/zen-status', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ configured: Boolean(zenKey) }));
      });
      // No key on the server and none sent by the page: answer with the clear error.
      server.middlewares.use('/api/zen', (req, res, next) => {
        if (!zenKey && !req.headers.authorization) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: ZEN_MISSING }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';
  const env = loadEnv(mode, process.cwd(), '');
  const zenKey = (env.ZEN_API_KEY || process.env.ZEN_API_KEY || '').trim();

  return {
    base: './',
    plugins: [
      react(),
      zenKeyGuard(zenKey),
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
          rewrite: (p) => p.replace(/^\/api\/zen/, '/zen'),
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (zenKey) proxyReq.setHeader('Authorization', `Bearer ${zenKey}`);
            });
          },
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
