# UI Polyfills & Browser Compatibility Report

This document explains why the ZKLoan Credit Scorer UI requires polyfills and special Vite configuration to run Midnight SDK packages in the browser.

---

## Executive Summary

The Midnight SDK packages are designed primarily for **Node.js environments**. To run them in the browser, we must:

1. **Polyfill Node.js APIs** (`Buffer`, `process`) that don't exist in browsers
2. **Handle WebAssembly modules** that contain core cryptographic primitives
3. **Transform CommonJS modules** to work with Vite's ESM-native bundler
4. **Support top-level await** for async WASM initialization

**Key Finding:** WASM is not optional—it is the **only viable method** to run Midnight's cryptographic stack in browsers. The alternatives (pure JavaScript, WebCrypto API, native extensions) are either too slow, incompatible, or not cross-platform.

---

## Table of Contents

1. [Vite Configuration Overview](#1-vite-configuration-overview)
2. [Buffer Polyfill](#2-buffer-polyfill)
3. [Process Polyfill](#3-process-polyfill)
4. [WebAssembly (WASM) Modules](#4-webassembly-wasm-modules)
5. [CommonJS Compatibility](#5-commonjs-compatibility)
6. [Additional Configuration](#6-additional-configuration)
7. [Package Dependencies Summary](#7-package-dependencies-summary)
8. [Performance Considerations](#8-performance-considerations)
9. [Troubleshooting Common Issues](#9-troubleshooting-common-issues)
10. [Deep Dive: Why WASM is Required](#10-deep-dive-why-wasm-is-required)
11. [Midnight Ledger: Rust Implementation Analysis](#11-midnight-ledger-rust-implementation-analysis)
12. [Cryptographic Primitives](#12-cryptographic-primitives)
13. [Alternatives to WASM: Analysis](#13-alternatives-to-wasm-analysis)
14. [Future Considerations](#14-future-considerations)

---

## 1. Vite Configuration Overview

```typescript
// vite.config.ts
plugins: [
  nodePolyfills({
    include: ['buffer', 'process'],
    globals: { Buffer: true, process: true },
  }),
  wasm(),                    // WebAssembly support
  react(),                   // React JSX transform
  viteCommonjs(),           // CommonJS compatibility
  topLevelAwait(),          // Async module initialization
],
```

---

## 2. Buffer Polyfill

### Why It's Needed

`Buffer` is a Node.js global class for binary data manipulation. Browsers have `Uint8Array` and `ArrayBuffer`, but not `Buffer`. The Midnight SDK uses `Buffer` extensively for:

- Hex encoding/decoding
- Cryptographic operations
- Address formatting
- Serialization

### Packages That Use Buffer

| Package | Usage | Purpose |
|---------|-------|---------|
| `@midnight-ntwrk/compact-runtime` | `Buffer.from(s, 'hex')`, `Buffer.from(s).toString('hex')` | Hex encoding/decoding in `utils.js` |
| `@midnight-ntwrk/compact-runtime` | `Buffer.from(Bytes32Descriptor...)` | Coin commitment creation in `zswap.js` |
| `@midnight-ntwrk/wallet-sdk-address-format` | `Buffer.from(address, 'hex')` | Bech32m address encoding |
| `@midnight-ntwrk/wallet-sdk-hd` | `Buffer.from(secretKey)` | HD wallet key derivation |

### Code Examples from SDK

```javascript
// @midnight-ntwrk/compact-runtime/dist/utils.js
export const fromHex = (s) => Buffer.from(s, 'hex');
export const toHex = (s) => Buffer.from(s).toString('hex');

// @midnight-ntwrk/compact-runtime/dist/zswap.js
circuitContext.currentQueryContext = circuitContext.currentQueryContext
  .insertCommitment(
    Buffer.from(Bytes32Descriptor.fromValue(createCoinCommitment(coinInfo, recipient).value))
      .toString('hex'),
    circuitContext.currentZswapLocalState.currentIndex
  );
```

### UI Code Using Buffer

```typescript
// ZKLoanContext.tsx
new Uint8Array(Buffer.from(addresses.shieldedCoinPublicKey, 'hex'))
Buffer.from(userPublicKey).toString('hex')
```

---

## 3. Process Polyfill

### Why It's Needed

Many npm packages check `process.env.NODE_ENV` for development/production mode detection. Some libraries also check `process.browser` to detect browser environments.

### Implementation

```typescript
// src/globals.ts
if (typeof globalThis.process === 'undefined') {
  globalThis.process = {
    env: {
      NODE_ENV: import.meta.env.MODE || 'production',
    },
    version: '',
    cwd: () => '/',
  };
}

// For environments that expect process.browser
if (typeof process !== 'undefined' && !process.browser) {
  process.browser = true;
}
```

---

## 4. WebAssembly (WASM) Modules

### WASM Files in the SDK

| Package | WASM File | Size | Purpose |
|---------|-----------|------|---------|
| `@midnight-ntwrk/ledger-v6` | `midnight_ledger_wasm_bg.wasm` | **8.8 MB** | Ledger operations, ZK verification |
| `@midnight-ntwrk/onchain-runtime-v1` | `midnight_onchain_runtime_wasm_bg.wasm` | **1.2 MB** | On-chain runtime execution |

**Total WASM size: ~10 MB**

### What the WASM Modules Provide

The `ledger-v6` WASM module exports critical cryptographic functions:

```typescript
// Core Token Operations
nativeToken()
feeToken()
shieldedToken()
unshieldedToken()

// Coin Operations
createCoinInfo(type_, value)
createShieldedCoinInfo(type_, value)
coinNullifier(coin_info, coin_secret_key)
coinCommitment(coin, coin_public_key)

// Address Operations
addressFromKey(key)
encodeContractAddress(addr)
decodeContractAddress(addr)
encodeUserAddress(addr)
decodeUserAddress(addr)

// Proof Operations
createProvingTransactionPayload(tx, proving_data)
createProvingPayload(serialized_preimage, overwrite_binding_input, key_material)
createCheckPayload(serialized_preimage, ir)
parseCheckResult(result)

// Utility
sampleDustSecretKey()
sampleCoinPublicKey()
partitionTranscripts(calls, params)
```

### How WASM is Loaded

```javascript
// midnight_ledger_wasm.js (browser entry point)
import * as wasm from "./midnight_ledger_wasm_bg.wasm";
export * from "./midnight_ledger_wasm_bg.js";
import { __wbg_set_wasm } from "./midnight_ledger_wasm_bg.js";
__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
```

### Browser vs Node.js Entry Points

Both WASM packages provide conditional exports:

```json
{
  "exports": {
    "browser": "./midnight_ledger_wasm.js",
    "node": "./midnight_ledger_wasm_fs.js"
  }
}
```

The `_fs.js` variant uses Node.js filesystem APIs to load the WASM, while the browser variant uses the ESM import.

### Why `vite-plugin-wasm` is Required

Vite needs special handling for `.wasm` imports:
1. The WASM file must be served with correct MIME type
2. The instantiation must be async
3. The module must be properly bundled

### Why `vite-plugin-top-level-await` is Required

WASM initialization is asynchronous. The SDK uses top-level await to ensure WASM is ready before exporting:

```javascript
// The WASM module uses this pattern internally
const wasm = await WebAssembly.instantiate(...);
export const someFunction = wasm.exports.someFunction;
```

Without this plugin, the code would fail because browsers don't natively support top-level await in all bundling scenarios.

---

## 5. CommonJS Compatibility

### Module Format Analysis

| Category | Count | Examples |
|----------|-------|----------|
| **Pure ESM** (`"type": "module"`) | 17 | `compact-runtime`, `ledger-v6`, `wallet-sdk-*` |
| **Pure CommonJS** (`.cjs` only) | 1 | `zswap` |
| **Dual Published** (`.cjs` + `.mjs`) | 9 | `midnight-js-*` packages |

### Pure CommonJS Package

```json
// @midnight-ntwrk/zswap/package.json
{
  "name": "@midnight-ntwrk/zswap",
  "main": "./zswap.cjs",
  "exports": {
    ".": {
      "import": "./zswap.cjs",
      "require": "./zswap.cjs"
    }
  }
}
```

### Dual-Published Packages

```json
// @midnight-ntwrk/midnight-js-contracts/package.json
{
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  }
}
```

### Why `viteCommonjs` is Required

The `@midnight-ntwrk/zswap` package is CommonJS-only. Vite is ESM-native and needs the CommonJS plugin to:
1. Transform `require()` calls to `import`
2. Transform `module.exports` to `export`
3. Handle mixed ESM/CJS dependencies

**Note:** If `@midnight-ntwrk/zswap` ships as ESM in the future, this plugin could be removed.

---

## 6. Additional Configuration

### Global Definitions

```typescript
// vite.config.ts
define: {
  'process.env.NODE_ENV': JSON.stringify(mode),
  'process.env': {},
  global: 'globalThis',
},
```

### Dependency Optimization

```typescript
optimizeDeps: {
  esbuildOptions: {
    define: {
      global: 'globalThis',
    },
  },
  exclude: [
    '@midnight-ntwrk/onchain-runtime',  // Excluded due to WASM
  ],
},
```

### Build Options

```typescript
build: {
  commonjsOptions: {
    transformMixedEsModules: true,  // Handle mixed ESM/CJS
  },
},
```

---

## 7. Package Dependencies Summary

### Direct UI Dependencies (Midnight SDK)

| Package | Version | Module Format | Uses Buffer | Uses WASM |
|---------|---------|---------------|-------------|-----------|
| `@midnight-ntwrk/compact-runtime` | 0.11.0-rc.1 | ESM | Yes | No |
| `@midnight-ntwrk/dapp-connector-api` | 4.0.0-beta.2 | ESM | No | No |
| `@midnight-ntwrk/ledger-v6` | 6.1.0-alpha.6 | ESM | Yes | **Yes (8.8MB)** |
| `@midnight-ntwrk/midnight-js-contracts` | 3.0.0-alpha.11 | Dual | No | No |
| `@midnight-ntwrk/midnight-js-fetch-zk-config-provider` | 3.0.0-alpha.11 | Dual | No | No |
| `@midnight-ntwrk/midnight-js-http-client-proof-provider` | 3.0.0-alpha.11 | Dual | No | No |
| `@midnight-ntwrk/midnight-js-indexer-public-data-provider` | 3.0.0-alpha.11 | Dual | No | No |
| `@midnight-ntwrk/midnight-js-network-id` | 3.0.0-alpha.11 | Dual | No | No |
| `@midnight-ntwrk/midnight-js-types` | 3.0.0-alpha.11 | Dual | No | No |
| `@midnight-ntwrk/zswap` | 4.0.0 | **CJS** | Yes | No |

### Transitive Dependencies

| Package | Module Format | Uses Buffer | Uses WASM |
|---------|---------------|-------------|-----------|
| `@midnight-ntwrk/onchain-runtime-v1` | ESM | No | **Yes (1.2MB)** |
| `@midnight-ntwrk/wallet-sdk-address-format` | ESM | Yes | No |
| `@midnight-ntwrk/wallet-sdk-hd` | ESM | Yes | No |

---

## 8. Performance Considerations

### Bundle Size Impact

| Component | Size | Impact |
|-----------|------|--------|
| WASM modules | ~10 MB | Large initial download, but cached |
| Buffer polyfill | ~50 KB | Minimal |
| Process polyfill | ~5 KB | Negligible |

### Loading Strategy

1. **WASM modules are loaded asynchronously** - doesn't block initial render
2. **Prover keys are fetched on-demand** - only when proof generation is needed
3. **Code splitting** - Vite automatically splits the bundle

---

## 9. Troubleshooting Common Issues

### "Buffer is not defined"
Ensure `globals.ts` is imported at the app entry point before any SDK imports.

### "Cannot use import statement outside a module"
The CommonJS plugin may not be transforming a dependency. Add it to `optimizeDeps.include`.

### WASM loading fails
Check that `vite-plugin-wasm` is configured and the WASM files are accessible.

### "Top-level await is not available"
Ensure `vite-plugin-top-level-await` is in the plugins array.

---

## 10. Deep Dive: Why WASM is Required

### The Fundamental Problem

The Midnight blockchain implements a sophisticated zero-knowledge proof system that requires:

1. **Elliptic curve cryptography** on non-standard curves (BLS12-381, embedded curves)
2. **Zero-knowledge proof verification** involving millions of field operations
3. **Deterministic execution** across different platforms (browser, Node.js, native)
4. **Constant-time operations** to prevent timing attacks

**JavaScript cannot provide these guarantees.**

### Why Not Pure JavaScript?

| Limitation | Impact |
|------------|--------|
| No native 256-bit integers | BigInt is 10-100x slower than native for crypto |
| No constant-time operations | Vulnerable to timing attacks |
| No SIMD instructions | Cannot parallelize field arithmetic |
| Non-deterministic floating point | Results may vary across platforms |
| Memory safety | No guarantees against buffer overflows |

### Architectural Decision from Midnight

From the Midnight Architecture documentation:

> "Ledger Libs are being implemented in Rust language, but expose a TypeScript interface that can be used in Node.js and browsers through targeting WASM."

This decision ensures:
- **Single source of truth** for ledger logic
- **Eliminates duplication** between client-side and server-side implementations
- **Deterministic execution** across all platforms

### What WASM Contains

The WASM modules are compiled from Rust and contain:

| Component | Purpose | Why Rust/WASM |
|-----------|---------|---------------|
| Field arithmetic | 256-bit modular arithmetic | Performance, constant-time |
| Curve operations | Point addition, scalar multiplication | Performance |
| Hash functions | SHA-256, Poseidon | Determinism |
| Merkle trees | Membership proofs | Performance |
| Proof verification | ZK-SNARK verification | Millions of operations |
| Impact VM | Smart contract execution | Determinism |

---

## 11. Midnight Ledger: Rust Implementation Analysis

### Codebase Overview

The `midnight-ledger` repository is a **Rust workspace** containing 27+ interconnected crates:

| Metric | Value |
|--------|-------|
| **Language** | Rust (Edition 2024) |
| **Codebase Size** | 165 Rust source files |
| **Core Ledger Module** | ~13,735 lines of Rust |
| **License** | Apache 2.0 |
| **Version** | 7.0.0-alpha.1 |

### WASM Build Process

```
Rust Crates → cargo (wasm32 target) → WASM binary
  → wasm-bindgen → JavaScript glue code
  → wasm-opt → optimized WASM
  → TypeScript declarations
  → ESM module + Node.js wrapper
```

**Build Toolchain:**
- **Target:** `wasm32-unknown-unknown`
- **Binding Layer:** wasm-bindgen 0.2.104
- **Optimization:** Binaryen's `wasm-opt` with `-Os` flag

**WASM Compilation Profile:**
```toml
[profile.wasm]
opt-level = "z"      # Optimize for size
lto = true           # Link-time optimization
codegen-units = 1    # Single codegen unit for better optimization
panic = "abort"      # No unwinding in WASM
```

### WASM Packages Produced

| Package | npm Name | Purpose |
|---------|----------|---------|
| ledger-wasm | `@midnight-ntwrk/ledger` | Transaction assembly, verification |
| onchain-runtime-wasm | `@midnight-ntwrk/onchain-runtime` | Contract state management |
| zkir-wasm | `@midnight-ntwrk/zkir-v2` | ZK IR proving/verification |

### Crate Dependency Graph

```
ledger-wasm ──┬──→ ledger ──────┬──→ zswap ──→ onchain-runtime ──→ onchain-vm
              │                 ├──→ zkir   ─┐
              ├──→ onchain-runtime-wasm       │
              └──→ transient-crypto ←────────┘
                       ↑
                    (ZK core)
                       ↓
            base-crypto ← serialize ← storage
```

### Key Rust Crates

| Crate | Purpose |
|-------|---------|
| `ledger` | Transaction construction, dust computation, intent verification |
| `zswap` | Shielded token system, nullifiers, commitments |
| `onchain-vm` | Impact VM (smart contract execution engine) |
| `onchain-runtime` | Contract state transitions |
| `transient-crypto` | ZK-specific cryptography |
| `base-crypto` | SHA-256, Schnorr signatures, serialization |
| `zkir` | Zero-Knowledge IR compilation and execution |

---

## 12. Cryptographic Primitives

### External Cryptographic Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `midnight-curves` | ^0.2.0 | Elliptic curve operations & field arithmetic |
| `midnight-proofs` | ^0.7.0 | Zero-knowledge proof system |
| `midnight-circuits` | ^6.0.0 | Circuit representation and compilation |
| `midnight-zk-stdlib` | ^1.0.0 | Zero-knowledge standard library |
| `k256` | ^0.13.4 | secp256k1 implementation (Schnorr signatures) |
| `sha2` | ^0.10.9 | SHA-256 hashing |
| `ff` | ^0.13.1 | Finite field arithmetic |
| `group` | ^0.13.0 | Elliptic curve group operations |

### Cryptographic Modules

#### base-crypto (midnight-base-crypto)

| Component | Implementation |
|-----------|----------------|
| **Hash** | SHA-256 based persistent hashing, 32-byte outputs |
| **Signatures** | BIP340 Schnorr over secp256k1 via k256 |
| **RNG** | Cryptographically secure random number generation |
| **FAB** | Fixed Alignment Blocks for on-chain data |

#### transient-crypto (ZK-specific)

| Component | Implementation |
|-----------|----------------|
| **Primary Field** | `Fr` (scalar field of BLS12-381) |
| **Embedded Curve** | `EmbeddedGroupAffine` points |
| **Commitments** | Pedersen-style commits with randomness |
| **Merkle Trees** | Fixed-height (32) for accumulator functionality |
| **Encryption** | Public-key encryption for shielded transactions |

### Why These Curves Cannot Be Replaced

| Curve | Used For | WebCrypto Support |
|-------|----------|-------------------|
| BLS12-381 | ZK proofs, pairing operations | **No** |
| Embedded curve (Jubjub-like) | In-circuit operations | **No** |
| secp256k1 | Schnorr signatures | **No** (only ECDSA) |

WebCrypto only supports P-256, P-384, P-521, and Ed25519. The curves required by Midnight's ZK system are **not available** in any browser API.

---

## 13. Alternatives to WASM: Analysis

### Alternatives Evaluated by Midnight Team

The Midnight architecture documents (ADR 0004, Proposal 0020) evaluated several alternatives:

#### 1. FFI (Foreign Function Interface)

| Aspect | Details |
|--------|---------|
| **Status** | Used for Node.js only |
| **Limitation** | Browsers have no FFI capability |
| **Decision** | Insufficient for browser support |

#### 2. Pure JavaScript Implementation

| Aspect | Details |
|--------|---------|
| **Status** | Not viable |
| **Performance** | 10-100x slower than WASM for crypto operations |
| **Security** | No constant-time guarantees |
| **Decision** | Rejected |

#### 3. WebCrypto API

| Aspect | Details |
|--------|---------|
| **Status** | Partially viable |
| **Limitation** | Only supports standard curves (P-256, not BLS12-381) |
| **Missing** | Pairing operations, field arithmetic |
| **Decision** | Cannot replace WASM |

#### 4. Native Browser Extensions

| Aspect | Details |
|--------|---------|
| **Status** | Safari only |
| **Limitation** | Not cross-platform |
| **Decision** | Not viable for wide browser support |

#### 5. HTTP-based Proof Server

| Aspect | Details |
|--------|---------|
| **Status** | Current interim solution for proving |
| **Limitation** | WebKit/Safari restrict localhost HTTP from HTTPS |
| **Privacy** | Requires external process, complicates "data stays on device" |
| **Decision** | Workaround, not replacement |

#### 6. Native Messaging API

| Aspect | Details |
|--------|---------|
| **Status** | Proposed for wallet extensions |
| **Limitation** | Only available to browser extensions |
| **Decision** | Good for wallets, not for embedded dApp functionality |

#### 7. WebGPU

| Aspect | Details |
|--------|---------|
| **Status** | Future possibility |
| **Limitation** | Not yet mature for ZK proofs |
| **Decision** | Monitor for future |

### Summary: Why Alternatives Fail

```
┌─────────────────────────────────────────────────────────────────┐
│                    WASM is Required Because:                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Curves used (BLS12-381, embedded) not in WebCrypto          │
│ 2. ZK proof verification needs millions of field operations    │
│ 3. JavaScript BigInt is 10-100x slower than native             │
│ 4. Determinism required across browser, Node.js, native        │
│ 5. Constant-time operations prevent timing attacks             │
│ 6. No other cross-browser solution for native code execution   │
└─────────────────────────────────────────────────────────────────┘
```

### WASM Performance Characteristics

From Midnight's Proposal 0020 (Local Proving Modalities):

> "Generating proofs in a default, single-threaded setup is unacceptably slow - although successful, it took minutes to generate a Zswap spend proof. On the other hand - enabling WASM to run in a multithreaded setup (by leveraging Web Workers, shared array buffers and `wasm-bindgen-rayon` crate) brings performance to noticeably slower than native, but somewhat acceptable levels (usually 20-30s for a Zswap spend proof on a M1 Max/10 core machine)."

**WASM Multi-threading Requirements:**
- Unstable Rust compiler feature `target-features=+atomics`
- Shared array buffers (require COOP/COEP headers)
- Web Workers (WASM blocks its running thread)

---

## 14. Future Considerations

### Short-Term Improvements

1. **Smaller WASM Bundles**
   - Tree-shaking unused functions
   - Separate proving and verification modules

2. **Streaming Compilation**
   - Load WASM progressively while showing UI
   - Use `WebAssembly.compileStreaming()`

3. **Service Worker Caching**
   - Cache 10MB WASM for offline capability
   - Faster subsequent loads

### Medium-Term (SDK Evolution)

1. **Dedicated Browser Builds**
   - Pre-bundled polyfills
   - Optimized WASM for browser-only features

2. **Native Messaging for Wallets**
   - Offload proving to native companion app
   - Better performance for complex proofs

3. **`@midnight-ntwrk/zswap` as ESM**
   - Would eliminate need for `viteCommonjs` plugin

### Long-Term (Ecosystem Changes)

1. **WebCrypto Expansion**
   - If browsers add BLS12-381 support (unlikely soon)
   - Would reduce WASM size significantly

2. **WASM GC (Garbage Collection)**
   - Reduce memory overhead
   - Better integration with JavaScript

3. **WebGPU for Proving**
   - GPU-accelerated proof generation
   - Could dramatically improve proving performance

---

## Appendix A: Architecture Decision Records

### ADR 0004: Workshops without Browser Support

> "It allows components like ledger or zero knowledge system (which are implemented in Rust) connect through an FFI interface to node.js (which is simpler than WebAssembly) - this is essential for claims that private data stays on the device"

**Decision:** FFI for Node.js workshops, WASM for browser support.

### ADR 0016: Forks and Change Management

> "To separate Midnight Ledger from runtime through native runtime interface for the time being"

**Decision:** Ledger logic isolated in WASM, upgradeable independently.

### Proposal 0020: Local Proving Modalities

**Evaluated approaches:**
1. HTTP-based proof server (current)
2. Native Messaging API (for extensions)
3. WASM-based proving (promising but not production-ready)

**Conclusion:** WASM proving is the future, but requires toolchain maturation.

---

## Appendix B: Quick Reference

### Required Vite Plugins

| Plugin | Purpose | Removable If... |
|--------|---------|-----------------|
| `nodePolyfills` | Buffer, process | SDK provides browser builds |
| `wasm` | WASM loading | Never (fundamental) |
| `topLevelAwait` | Async WASM init | Never (fundamental) |
| `viteCommonjs` | CJS compatibility | `zswap` ships as ESM |

### WASM Module Sizes

| Module | Size | Contains |
|--------|------|----------|
| ledger-v6 | 8.8 MB | Crypto, proofs, addresses |
| onchain-runtime-v1 | 1.2 MB | Impact VM, state |
| **Total** | **10 MB** | |

### Cryptographic Curves

| Curve | Purpose | In WebCrypto |
|-------|---------|--------------|
| BLS12-381 | ZK proofs | No |
| Embedded (Jubjub-like) | In-circuit ops | No |
| secp256k1 | Signatures | No |

---

*Last updated: January 2025*

*Based on analysis of:*
- *midnight-architecture repository*
- *midnight-ledger repository*
- *Midnight SDK npm packages*
