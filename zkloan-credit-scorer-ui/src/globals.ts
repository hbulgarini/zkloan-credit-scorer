import { Buffer } from 'buffer';

// Polyfill Buffer for browser usage - MUST be first
// Also set on window for compatibility with some libraries
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
(window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;

// Ensure Buffer.prototype methods are available
// Some bundled modules check for these before Buffer is fully initialized
if (typeof Buffer.prototype.slice !== 'function') {
  Buffer.prototype.slice = function(start?: number, end?: number) {
    return Buffer.from(Uint8Array.prototype.slice.call(this, start, end));
  };
}

// Map Vite's MODE to process.env.NODE_ENV for third-party libraries
const processPolyfill = {
  env: {
    NODE_ENV: import.meta.env.MODE,
  },
};
(globalThis as unknown as { process: typeof processPolyfill }).process = processPolyfill;
(window as unknown as { process: typeof processPolyfill }).process = processPolyfill;
