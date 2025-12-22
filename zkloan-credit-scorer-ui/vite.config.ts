import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
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
  },
  cacheDir: './.vite',
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: {
          wasm: ['@midnight-ntwrk/onchain-runtime'],
        },
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
      extensions: ['.js', '.cjs'],
      ignoreDynamicRequires: true,
    },
  },
  plugins: [
    react(),
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
      supported: { 'top-level-await': true },
      platform: 'browser',
      format: 'esm',
      loader: {
        '.wasm': 'binary',
      },
    },
    include: ['@midnight-ntwrk/compact-runtime'],
    exclude: [
      '@midnight-ntwrk/onchain-runtime',
      '@midnight-ntwrk/onchain-runtime/midnight_onchain_runtime_wasm_bg.wasm',
      '@midnight-ntwrk/onchain-runtime/midnight_onchain_runtime_wasm.js',
    ],
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.wasm'],
    mainFields: ['browser', 'module', 'main'],
  },
});
