import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs';
import inject from '@rollup/plugin-inject';
import stdLibBrowser from 'node-stdlib-browser';
import path from 'path';
import fs from 'fs';

// Path to the contract's compiled keys and zkir
const contractDistPath = path.resolve(__dirname, '../contract/dist/managed/zkloan-credit-scorer');

export default defineConfig({
  // Serve contract keys and zkir files
  server: {
    fs: {
      allow: ['..'],
    },
    // Proxy to avoid CORS issues with indexer in development
    proxy: {
      '/proxy-indexer': {
        target: 'https://indexer.preview.midnight.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-indexer/, ''),
        secure: true,
        headers: {
          'Origin': 'https://indexer.preview.midnight.network',
        },
      },
      '/proxy-indexer-ws': {
        target: 'wss://indexer.preview.midnight.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-indexer-ws/, ''),
        secure: true,
        ws: true,
        headers: {
          'Origin': 'https://indexer.preview.midnight.network',
        },
      },
    },
  },
  cacheDir: './.vite',
  build: {
    target: 'esnext',
    minify: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      plugins: [
        inject({
          util: ['util', '*'],
          Buffer: ['buffer', 'Buffer'],
          process: ['process/browser', 'default'],
        }),
      ],
    },
  },
  plugins: [
    react(),
    viteCommonjs(),
    wasm(),
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    }),
    // Serve contract keys and zkir files
    {
      name: 'serve-contract-keys',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/keys/') || req.url?.startsWith('/zkir/')) {
            const filePath = path.join(contractDistPath, req.url);
            if (fs.existsSync(filePath)) {
              const content = fs.readFileSync(filePath);
              res.setHeader('Content-Type', 'application/octet-stream');
              res.end(content);
              return;
            }
          }
          next();
        });
      },
    },
    {
      name: 'wasm-module-resolver',
      resolveId(source, importer) {
        if (
          source === '@midnight-ntwrk/onchain-runtime' &&
          importer &&
          importer.includes('@midnight-ntwrk/compact-runtime')
        ) {
          return {
            id: source,
            external: false,
            moduleSideEffects: true,
          };
        }
        return null;
      },
    },
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis',
      },
    },
    include: [
      '@midnight-ntwrk/compact-runtime',
      '@midnight-ntwrk/midnight-js-contracts',
      '@midnight-ntwrk/midnight-js-level-private-state-provider',
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
      '@midnight-ntwrk/midnight-js-fetch-zk-config-provider',
    ],
    exclude: [
      '@midnight-ntwrk/onchain-runtime',
      '@midnight-ntwrk/onchain-runtime/midnight_onchain_runtime_wasm_bg.wasm',
      '@midnight-ntwrk/onchain-runtime/midnight_onchain_runtime_wasm.js',
    ],
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.wasm'],
    mainFields: ['browser', 'module', 'main'],
    alias: {
      ...stdLibBrowser,
      // Additional specific aliases
      'node:util': stdLibBrowser.util,
      'node:buffer': stdLibBrowser.buffer,
      'node:fs': stdLibBrowser.fs,
      'node:crypto': stdLibBrowser.crypto,
      'node:path': stdLibBrowser.path,
      process: stdLibBrowser.process,
      'process/browser': stdLibBrowser.process,
      'process/browser/browser': stdLibBrowser.process,
    },
  },
  define: {
    'process.env': {},
    global: 'window',
  },
});
