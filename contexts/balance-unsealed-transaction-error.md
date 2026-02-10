# balanceUnsealedTransaction "Failed to clone intent" Error

## Status: Open / Under Investigation

**Date**: 2026-02-09
**Affected Environment**: preprod network
**Affected Packages**:
- `@midnight-ntwrk/dapp-connector-api`: 4.0.0
- `@midnight-ntwrk/ledger-v7`: 7.0.0
- `@midnight-ntwrk/midnight-js-contracts`: 3.0.0
- `@midnight-ntwrk/wallet-sdk-unshielded-wallet`: 1.0.0
- Wallet: Lace Midnight Preview (apiVersion 4.0.0)

---

## Summary

When a DApp calls `balanceUnsealedTransaction()` through the Lace wallet's DApp Connector API with a proven transaction serialized from `ledger-v7`, the wallet fails internally during the **signing phase** with:

```
Error {
  _id: 'FiberFailure',
  cause: {
    _id: 'Cause',
    _tag: 'Fail',
    failure: {
      _tag: 'Wallet.Transacting',
      message: 'Failed to clone intent',
      cause: {}
    }
  },
  message: '',
  name: 'Error'
}
```

The error surfaces to the DApp as:
```
Unexpected error submitting scoped transaction '<unnamed>': Error
```

---

## What Works

- Wallet connection via `connect()`
- `getShieldedAddresses()` returns addresses correctly
- `getConfiguration()` returns network config
- `findDeployedContract()` successfully joins an existing contract
- Circuit execution and proof generation complete successfully
- Transaction serialization (`tx.serialize()`) succeeds
- The Lace wallet confirmation popup appears and can be approved

## What Fails

The call to `wallet.balanceUnsealedTransaction(serializedStr)` fails after user approval, during the internal signing step.

---

## Detailed Error Flow

### DApp Side (ZKLoanContext.tsx)

```typescript
// 1. Serialize the proven transaction
const serialized = tx.serialize();  // Transaction<SignatureEnabled, Proof, PreBinding>
const serializedStr = uint8ArrayToHex(serialized);

// 2. Call Lace wallet - THIS FAILS
const result = await wallet.balanceUnsealedTransaction(serializedStr);
```

### Lace Extension Side (midnight-dapp-connector-api.ts)

```typescript
public async balanceUnsealedTransaction(tx: string): Promise<{ tx: string }> {
  const wallet = await this.ensureWallet();

  // Step 1: Deserialize - SUCCEEDS
  const deserializedTx = await this.deserializeUnsealedTransaction(tx);
  // Uses: ledger.Transaction.deserialize('signature', 'proof', 'pre-binding', Buffer.from(tx, 'hex'))

  // Step 2: User confirmation - SUCCEEDS
  const { isConfirmed } = await this.#userConfirmationRequest(sender, 'proveTransaction');

  // Step 3: Balance - SUCCEEDS
  const unboundTxRecipe = await firstValueFrom(
    wallet.balanceUnboundTransaction(deserializedTx, { ttl })
  );

  // Step 4: Sign - FAILS HERE
  const signedRecipe = await firstValueFrom(
    wallet.signRecipe(unboundTxRecipe)
  );

  // Step 5: Finalize (never reached)
  const finalizedTx = await firstValueFrom(wallet.finalizeRecipe(signedRecipe));
}
```

### Wallet SDK Side (TransactionOps.ts - the actual failure point)

**File**: `midnight-wallet/packages/unshielded-wallet/src/v1/TransactionOps.ts` (lines 80-132)

The signing flow calls `addSignature()` for each segment. Inside `addSignature`, the wallet clones the intent via a serialize/deserialize round-trip:

```typescript
addSignature(
  transaction: ledger.UnprovenTransaction,
  signature: ledger.Signature,
  segment: number,
): Either.Either<ledger.UnprovenTransaction, WalletError> {
  return Either.gen(function* () {
    // ... validation checks ...

    const originalIntent = transaction.intents?.get(segment);

    // THIS IS WHERE IT FAILS:
    const clonedIntent = yield* Either.try({
      try: () =>
        ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.PreProof, ledger.PreBinding>(
          'signature',
          'pre-proof',      // <-- Always deserializes as PreProof
          'pre-binding',
          originalIntent.serialize(),
        ),
      catch: (error) => new TransactingError({
        message: 'Failed to clone intent',
        cause: error,       // <-- WASM error, surfaces as {}
      }),
    });

    // ... add signatures to offers (never reached) ...
  });
}
```

### Call Chain

```
Lace: wallet.signRecipe(unboundTxRecipe)
  -> Transacting.ts: #signTransactionInternal(transaction, signSegment)
    -> for each segment:
      -> TransactionOps.ts: addSignature(transaction, signature, segment)
        -> originalIntent.serialize()
        -> ledger.Intent.deserialize('signature', 'pre-proof', 'pre-binding', bytes)
        -> WASM FAILURE -> TransactingError("Failed to clone intent")
```

---

## Root Cause Analysis

### Suspected Type Parameter Mismatch

The `addSignature` function signature accepts `ledger.UnprovenTransaction`:
```typescript
addSignature(transaction: ledger.UnprovenTransaction, ...)
```

Where `UnprovenTransaction = Transaction<SignatureEnabled, PreProof, PreBinding>`.

However, it is called from `#signTransactionInternal` which is **generic**:
```typescript
#signTransactionInternal<T extends ledger.UnprovenTransaction | UnboundTransaction>(
  transaction: T, ...
)
```

Where `UnboundTransaction = Transaction<SignatureEnabled, Proof, PreBinding>`.

When called with an `UnboundTransaction` (which is the case for `balanceUnsealedTransaction` flow):
1. The intent contains **actual proofs** (`Proof`), not pre-proofs
2. `originalIntent.serialize()` serializes bytes that include proof data
3. `Intent.deserialize('signature', 'pre-proof', 'pre-binding', bytes)` tries to deserialize expecting **pre-proof** format
4. The WASM deserializer rejects the bytes because the format doesn't match the expected `PreProof` schema

The `cause: {}` is empty because the WASM-level error doesn't propagate a meaningful JavaScript error object through the Effect error handling chain.

### Why This Affects DApp Connector Flow Specifically

The DApp proves the transaction before sending it to the wallet. The flow is:

1. **DApp**: Circuit execution + proof generation -> `Transaction<SignatureEnabled, Proof, PreBinding>`
2. **DApp**: Serialize and send to Lace via `balanceUnsealedTransaction()`
3. **Lace**: Deserialize as `Transaction<SignatureEnabled, Proof, PreBinding>` (correct)
4. **Lace**: Balance the transaction (succeeds - works with actual Proof data)
5. **Lace**: Sign the balanced transaction
6. **Wallet SDK**: `addSignature()` tries to clone intent as `PreProof` -> **FAILS**

The CLI/standalone wallet path works because it uses `WalletFacade.balanceUnboundTransaction()` which may follow a different signing flow, or the transaction state is different at the point of signing.

---

## Relevant Source Files

### DApp (this repo)
| File | Purpose |
|------|---------|
| `zkloan-credit-scorer-ui/src/contexts/ZKLoanContext.tsx:305-338` | `balanceTx()` - calls `wallet.balanceUnsealedTransaction()` |
| `zkloan-credit-scorer-ui/src/contexts/ZKLoanContext.tsx:110-121` | `uint8ArrayToHex()` / `hexToUint8Array()` helpers |

### Reference DApp (../midnight-wallet-dapp)
| File | Purpose |
|------|---------|
| `src/lib/walletAdapter.ts:67-118` | `balanceTx()` - identical pattern to ZKLoan UI, confirms issue is not DApp-specific |

### Lace Extension (../lace-platform)
| File | Purpose |
|------|---------|
| `packages/module/dapp-connector-midnight/src/store/dependencies/midnight-dapp-connector-api.ts:185-219` | `balanceUnsealedTransaction()` implementation |
| `packages/module/dapp-connector-midnight/src/store/dependencies/midnight-dapp-connector-api.ts:406-417` | `deserializeUnsealedTransaction()` |
| `packages/module/dapp-connector-midnight/src/midnight-wallet-api.ts:45` | `apiVersion: '4.0.0'` declaration |
| `apps/lace-extension/metro.config.js:108-118` | Metro blacklist for `ledger-v7` (UI build only, not background worker) |

### Wallet SDK (../midnight-wallet)
| File | Purpose |
|------|---------|
| `packages/unshielded-wallet/src/v1/TransactionOps.ts:80-132` | `addSignature()` - **where the error originates** |
| `packages/unshielded-wallet/src/v1/TransactionOps.ts:99-108` | Intent clone via `Intent.deserialize()` - **the failing line** |
| `packages/unshielded-wallet/src/v1/Transacting.ts:145-150` | `balanceUnboundTransaction()` entry point |
| `packages/unshielded-wallet/src/v1/Transacting.ts:346-363` | `#signTransactionInternal()` - calls `addSignature()` |
| `packages/unshielded-wallet/src/v1/Transacting.ts:497-555` | `#balanceUnboundishTransaction()` - core balancing logic |
| `packages/unshielded-wallet/src/v1/WalletError.ts:66-69` | `TransactingError` class definition (`Wallet.Transacting` tag) |
| `packages/facade/src/index.ts:356-388` | `signRecipe()` - dispatches to `signUnboundTransaction()` for UNBOUND_TRANSACTION type |

### DApp Connector API (npm package)
| File | Purpose |
|------|---------|
| `node_modules/@midnight-ntwrk/dapp-connector-api/dist/api.d.ts:99-109` | `balanceUnsealedTransaction` type definition |
| `node_modules/@midnight-ntwrk/dapp-connector-api/dist/api.d.ts:105` | Outdated JSDoc referencing `ledger-v6` (misleading, Lace actually uses v7) |

---

## Facade signRecipe Flow (Key to Understanding the Bug)

The `WalletFacade.signRecipe()` method (at `../midnight-wallet/packages/facade/src/index.ts:356-388`) dispatches signing based on the recipe type:

```typescript
async signRecipe(recipe: BalancingRecipe, signSegment): Promise<BalancingRecipe> {
  switch (recipe.type) {
    case 'UNBOUND_TRANSACTION': {
      // Balancing tx is UnprovenTransaction (PreProof) - signing WORKS
      const signedBalancingTx = recipe.balancingTransaction
        ? await this.signUnprovenTransaction(recipe.balancingTransaction, signSegment)
        : undefined;

      // Base tx is UnboundTransaction (Proof) - signing FAILS
      const signedBaseTx = await this.signUnboundTransaction(
        recipe.baseTransaction, signSegment
      );
      // ...
    }
  }
}
```

Both `signUnprovenTransaction` and `signUnboundTransaction` delegate to `Transacting.#signTransactionInternal()`, which is **generic** over `UnprovenTransaction | UnboundTransaction`. This generic method calls `TransactionOps.addSignature()` for each segment, where the hardcoded `'pre-proof'` type parameter causes the clone failure on the baseTransaction.

### Why the Balancing Transaction Succeeds but Base Transaction Fails

| | Balancing Transaction | Base Transaction |
|---|---|---|
| **Type** | `UnprovenTransaction` (PreProof) | `UnboundTransaction` (Proof) |
| **Intent proof state** | PreProof (placeholder) | Proof (actual ZK proof) |
| **Clone format** | `Intent.deserialize('signature', 'pre-proof', ...)` | `Intent.deserialize('signature', 'pre-proof', ...)` |
| **Result** | Matches - deserialization succeeds | **Mismatch** - WASM rejects proof bytes as PreProof |

---

## Confirmed: Bug Affects ALL DApps Using balanceUnsealedTransaction

The `../midnight-wallet-dapp` reference implementation (at `src/lib/walletAdapter.ts:67-118`) uses the **exact same pattern** as ZKLoan UI:

```typescript
async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
  const serialized = tx.serialize();
  const serializedStr = uint8ArrayToHex(serialized);
  const result = await connectedAPI.balanceUnsealedTransaction(serializedStr);
  const resultBytes = hexToUint8Array(result.tx);
  const deserializedTx = Transaction.deserialize('signature', 'proof', 'binding', resultBytes);
  return deserializedTx;
}
```

This confirms the bug is **not specific to ZKLoan** but affects any DApp that:
1. Proves a transaction locally (circuit execution + proof generation)
2. Serializes the proven `Transaction<SignatureEnabled, Proof, PreBinding>`
3. Sends it to Lace via `balanceUnsealedTransaction()`

---

## Ruled Out Causes

### ledger-v6 / ledger-v7 Mismatch (RULED OUT)
The `dapp-connector-api` v4.0.0 JSDoc references `ledger-v6`, but this is **outdated documentation**. The Lace source code at `../lace-platform` confirms:
- `package.json` depends on `@midnight-ntwrk/ledger-v7: 7.0.0`
- `midnight-dapp-connector-api.ts` imports `import * as ledger from '@midnight-ntwrk/ledger-v7'`
- Transaction deserialization uses `ledger-v7` API

### Metro Blacklist Breaking ledger-v7 (RULED OUT)
The `metro.config.js` blacklists `@midnight-ntwrk/ledger-v7` for the extension build, but this only affects the **popup UI bundle** (React Native/Expo). The DApp connector logic runs in the **background service worker** which is bundled separately and has access to `ledger-v7`.

### Transaction Serialization Format (RULED OUT)
The transaction serializes and deserializes correctly between the DApp and Lace. The error occurs **after** successful deserialization and balancing, during the signing step.

---

## Reproduction Steps

1. Start the UI: `cd zkloan-credit-scorer-ui && npm run dev`
2. Open `http://localhost:5173/`
3. Connect Lace wallet (must be connected to preprod network)
4. Enter contract address: `d365145e81adf2debd432ccdb03587e3d652ee8f8c9c6202327a1e5f06407282`
5. Click "Connect"
6. Select profile `user-001 - Score: 720`, PIN `1234`
7. Enter loan amount `3000`
8. Click "Request Loan"
9. Approve the transaction in the Lace popup when it appears
10. Observe error: "Unexpected error submitting scoped transaction '<unnamed>': Error"
11. Check browser console for the full `FiberFailure` cause chain

---

## Recommended Next Steps

1. **File a bug report** against `@midnight-ntwrk/wallet-sdk-unshielded-wallet` describing the type parameter mismatch in `addSignature()` when handling `UnboundTransaction` (Proof) vs `UnprovenTransaction` (PreProof). Include the facade's `signRecipe` flow showing that `signUnboundTransaction` on the `baseTransaction` triggers the bug.

2. **Reference the midnight-wallet-dapp** in the bug report to show this affects all DApps using `balanceUnsealedTransaction`, not just ZKLoan.

3. **Proposed fix direction**: The `addSignature()` function in `TransactionOps.ts` should detect the proof type of the intent being cloned and use the matching type parameter for `Intent.deserialize()`:
   - For `UnprovenTransaction` intents: use `'pre-proof'` (current behavior, works)
   - For `UnboundTransaction` intents: use `'proof'` (needed fix)

4. **Test on preview network** to determine if this is preprod-specific or affects all networks.

5. **Add diagnostic logging** to capture the serialized intent bytes before the failing `Intent.deserialize()` call, to confirm whether the proof-format mismatch is the root cause.

6. **Potential workaround**: If the wallet SDK exposes a way to balance AND sign in a single step (avoiding the separate `signRecipe` call), this might bypass the `addSignature` clone path. Check if `balanceUnboundTransaction` can return a fully signed transaction directly.

7. **Check if CLI path works on preprod**: The CLI uses `WalletFacade.balanceUnboundTransaction()` + `finalizeRecipe()` which may follow a different internal signing path that doesn't hit the `addSignature` clone bug.
