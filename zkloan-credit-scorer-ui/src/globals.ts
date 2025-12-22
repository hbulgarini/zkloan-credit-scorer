import { Buffer } from 'buffer';

// Map Vite's MODE to process.env.NODE_ENV for third-party libraries
// @ts-expect-error - support third-party libraries that require NODE_ENV
globalThis.process = {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};

// Polyfill Buffer for browser usage
globalThis.Buffer = Buffer;
