# Midnight Transaction Lifecycle: Contract Execution to Blockchain Inclusion

A complete end-to-end walkthrough of how a Compact circuit call (e.g., `requestLoan`) travels from user action to on-chain finality, covering all cryptographic operations, key usage, and component interactions.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                        USER'S MACHINE (Browser or CLI)                  |
|                                                                         |
|  +-------------+   +------------------+   +------------------------+   |
|  |  Private     |   |  Compact Runtime |   |  Proof Provider        |   |
|  |  State       |-->|  (circuit exec)  |-->|  (HTTP to proof server)|   |
|  |  (witnesses) |   |  CPU-only, no ZK |   |  ZK proof generation   |   |
|  +-------------+   +------------------+   +------------------------+   |
|         |                    |                        |                  |
|         |                    v                        v                  |
|         |          UnprovenTransaction      ProvenTransaction           |
|         |                                            |                  |
|  +------+--------------------------------------------+--------------+   |
|  |                    Wallet (Lace or SDK)                           |   |
|  |  1. Balance (add NIGHT inputs/outputs for fees)                  |   |
|  |  2. Sign (BIP-340 Schnorr on secp256k1)                         |   |
|  |  3. Finalize (attach signatures + bindings)                      |   |
|  +------------------------------+-----------------------------------+   |
|                                 |                                       |
+---------------------------------+---------------------------------------+
                                  v
                        +------------------+
                        |  Midnight Node   |
                        |  (verify proofs, |
                        |   check sigs,    |
                        |   apply to       |
                        |   ledger)        |
                        +------------------+
```

---

## Phase 1: Prepare Private Data

**Where:** User's machine only -- nothing leaves
**Keys used:** None yet

The user provides their private inputs (credit score, income, etc.) and the DApp fetches an attestation signature from the attestation API server.

```
User selects profile (creditScore=720, monthlyIncome=5000, monthsAsCustomer=36)
    |
    v
Fetch attestation signature from API server
    (Schnorr signature over [creditScore, monthlyIncome, monthsAsCustomer, userPubKeyHash]
     on Jubjub curve, signed by attestation provider's private key)
    |
    v
Store in private state:
    {
      creditScore: 720n,
      monthlyIncome: 5000n,
      monthsAsCustomer: 36n,
      attestationSignature: { announcement: {x, y}, response: bigint },
      attestationProviderId: 1n
    }
```

### Private State Storage

| Environment | Backend | Encryption | Persistence |
|-------------|---------|------------|-------------|
| **UI (Browser)** | In-memory `Map` | None (ephemeral) | Lost on page refresh |
| **CLI (Node.js)** | LevelDB on disk | AES-256-GCM (PBKDF2, 100k iterations) | Survives restarts |

**CLI key format:** `${contractAddress}:${privateStateId}` -- serialized with `superjson` (preserves BigInt, Buffer types).

---

## Phase 2: Circuit Execution (CPU-only, no proofs)

**Where:** User's machine, in the Compact Runtime (compiled Compact -> JavaScript)
**Keys used:** `CoinPublicKey` (Jubjub point) -- injected into `CircuitContext`

### What happens

```typescript
// submitCallTx() internally builds a CircuitContext:
const circuitContext = createCircuitContext(
  contractAddress,
  coinPublicKey,        // <-- Jubjub public key from wallet
  currentContractState, // <-- fetched from indexer via GraphQL
  privateState,         // <-- from private state provider
);

// Executes the compiled Compact circuit (pure JS, no ZK proving)
const result = contract.circuits.requestLoan(circuitContext, amount, pin);
```

### Inside the circuit

1. Calls witness `getAttestedScoringWitness()` -> returns private credit data + attestation signature
2. Calls `ownPublicKey()` -> reads `circuitContext.currentZswapLocalState.coinPublicKey` (Jubjub point)
3. Checks `!blacklist.member(ownPublicKey())` -- ensures user is not blacklisted
4. Verifies Schnorr attestation signature on Jubjub curve -- ensures data integrity
5. Evaluates credit score privately -> determines tier and max loan amount
6. Writes to public ledger: `loans.insert(key, loanRecord)` with `disclose()`d values only

### Output

An `UnprovenTransaction` containing:

| Field | Description |
|-------|-------------|
| `publicTranscript` | Ledger operations (insert loan, etc.) -- visible on-chain |
| `privateTranscriptOutputs` | Witness results (encrypted) -- never revealed |
| `partialProofData` | Circuit execution trace for the ZK prover |
| `input` / `output` | Circuit arguments and return value |

No ZK proof yet -- just a complete record of what the circuit computed.

---

## Phase 3: Proof Generation (Proof Server)

**Where:** Proof server (localhost:6300 in dev, remote in production)
**Keys used:** `CoinSecretKey` (Jubjub scalar) -- embedded in `partialProofData` as a witness wire
**Protocol:** HTTP POST to proof server

### Flow

```
User's machine                          Proof Server (:6300)
     |                                       |
     |  POST /prove                          |
     |  {                                    |
     |    circuitId: "requestLoan",          |
     |    input: [amount, pin],              |
     |    output: circuitResult,             |
     |    publicTranscript: [...],           |
     |    privateTranscriptOutputs: [...],   |
     |    partialProofData: {...}             |
     |  }                                    |
     |-------------------------------------->|
     |                                       | 1. Loads proving key
     |                                       |    (requestLoan.prover)
     |                                       |
     |                                       | 2. Runs Plonk prover:
     |                                       |    - Builds R1CS constraints
     |                                       |    - CoinSecretKey is a
     |                                       |      private witness wire
     |                                       |    - Generates zk-SNARK
     |                                       |
     |  { proof: Uint8Array }                |
     |<--------------------------------------|
```

### Critical: Secret Key Exposure

The `CoinSecretKey` (Jubjub scalar) is sent to the proof server as part of the witness data inside `partialProofData`. The prover **must** have the raw key bytes to generate the ZK proof -- it's an input wire to the arithmetic circuit.

**Implications:**
- **Local dev:** Proof server runs on localhost -- acceptable
- **Production:** Proof server must be trusted infrastructure
- **HSM scenarios:** The Jubjub secret key must leave the HSM for this step (see [HSM Compatibility](#hsm-compatibility))

### Output

`Transaction<SignatureEnabled, Proof, PreBinding>` -- proven but not yet balanced or signed.

---

## Phase 4: Balance the Transaction

**Where:** Wallet (Lace extension or WalletFacade SDK)
**Keys used:** `CoinSecretKey` (Jubjub) -- to identify spendable coins and compute nullifiers

Balancing adds NIGHT token inputs/outputs to cover transaction fees.

### Two Paths

**Path A: Lace Wallet (UI)**

```typescript
const serialized = tx.serialize();
const serializedStr = uint8ArrayToHex(serialized);
// Note: {} is required as second arg due to Lace messaging layer bug
const result = await (wallet as any).balanceUnsealedTransaction(serializedStr, {});
// Lace performs balance + sign + finalize internally, returns finalized tx
```

**Path B: WalletFacade (CLI)**

```typescript
const recipe = await walletFacade.balanceUnboundTransaction(
  tx,
  { shieldedSecretKeys, dustSecretKey },
  { ttl }
);
```

### What balancing does

1. **Scans the wallet's coin set** -- finds unspent Zswap coins (NIGHT)
2. **Calculates the transaction fee** -- based on tx size x fee rate from cost model
3. **Builds a balancing transaction:**
   - Adds NIGHT coin inputs to cover the fee
   - Adds change outputs back to the user
   - Adds DUST inputs for fee payment
4. **Produces a `BalancingRecipe`:**

```typescript
{
  type: 'UNBOUND_TRANSACTION',
  baseTransaction: provenContractTx,       // Transaction<SignatureEnabled, Proof, PreBinding>
  balancingTransaction: optionalZswapTx    // Transaction<SignatureEnabled, PreProof, PreBinding>
}
```

---

## Phase 5: Sign the Transaction (BIP-340 Schnorr)

**Where:** Wallet
**Keys used:** `SigningKey` (BIP-340 format, **secp256k1** curve -- different from Jubjub)

### Key Derivation

```
HD Seed (24-word BIP39 mnemonic)
  -> BIP32 derivation path
    -> Raw private key bytes (32 bytes, secp256k1 scalar)
      -> signingKeyFromBip340(bytes)
        -> SigningKey (hex string with 3-byte BIP-340 version prefix)
```

### Signing Process

**Path A: Lace** -- signing happens inside the extension, transparent to the DApp. User sees a confirmation popup and approves.

**Path B: SDK**

```typescript
const signedRecipe = await walletFacade.signRecipe(
  recipe,
  (payload: Uint8Array) => ledger.signData(signingKey, payload)
  //                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                        BIP-340 Schnorr signature on secp256k1
  //                        Input: serialized transaction data
  //                        Output: 64-byte Schnorr signature + version prefix
);
```

### What's signed

Each **intent** (segment) in the transaction gets a separate BIP-340 Schnorr signature. The wallet iterates over all segments and signs each one.

### Known Bug: "Failed to clone intent"

The wallet SDK's `addSignature()` function (in `TransactionOps.ts`) clones each intent via a serialize/deserialize round-trip with a hardcoded `'pre-proof'` type parameter. When the intent contains actual `Proof` data (as with `balanceUnsealedTransaction` flow), the WASM deserializer rejects the bytes. See `docs/` or `contexts/balance-unsealed-transaction-error.md` for full analysis.

---

## Phase 6: Finalize

**Where:** Wallet
**Keys used:** None (assembly step only)

```typescript
const finalizedTx = await walletFacade.finalizeRecipe(signedRecipe);
```

Finalization:
1. Attaches all BIP-340 signatures to the transaction
2. Resolves `PreBinding` -> `Binding` (binds coin commitments to specific outputs)
3. Produces `FinalizedTransaction` -- ready for network submission

---

## Phase 7: Submit to Node

**Where:** User's machine -> Midnight Node (JSON-RPC on port 9944)
**Keys used:** None

```typescript
// CLI
const txId = await walletFacade.submitTransaction(finalizedTx);

// UI (via Lace) -- note the {} workaround
await (wallet as any).submitTransaction(serializedStr, {});
```

The serialized `FinalizedTransaction` bytes are sent to the node via JSON-RPC.

---

## Phase 8: Node Validates & Includes in Block

**Where:** Midnight Node
**Verification uses:** Circuit verifier keys (`.verifier` files deployed with the contract)

The node performs:

1. **Deserialization** -- parse the transaction bytes
2. **BIP-340 signature verification** (secp256k1 Schnorr) on each intent segment
3. **ZK proof verification** using the on-chain verifier key for the `requestLoan` circuit
4. **Guaranteed operations** -- applies public transcript to the ledger (e.g., insert loan record)
5. **Fallible operations** -- may partially succeed without rejecting the whole transaction
6. **Block inclusion** -- transaction assigned a `txId` and `blockHeight`

---

## Phase 9: DApp Watches for Finalization

**Where:** User's machine, polling the indexer

```typescript
// submitCallTx internally polls via the public data provider:
const txData = await publicDataProvider.watchForTxData(txId);

// On success, updates private state for future circuit calls:
await privateStateProvider.set('zkLoanCreditScorerPrivateState', nextPrivateState);
```

### Returns to the DApp

```typescript
{
  public: {
    txId: string,           // Transaction ID on blockchain
    blockHeight: number,    // Block where included
    status: TxStatus,       // SucceedEntirely | PartialSuccess | ...
  },
  private: {
    nextPrivateState: ZKLoanCreditScorerPrivateState,
    nextZswapLocalState: ZswapLocalState,
    newCoins: ShieldedCoinInfo[]
  }
}
```

---

## Cryptographic Primitives Summary

### Curves and Algorithms

| Component | Curve | Algorithm | Purpose |
|-----------|-------|-----------|---------|
| ZK proof system | BLS12-381 | Plonk zk-SNARK | Proving circuit execution correctness |
| Coin keys (`ownPublicKey`) | Jubjub (embedded in BLS12-381) | Zswap protocol | Privacy-preserving identity and coin ownership |
| Transaction signing | secp256k1 | BIP-340 Schnorr | Authorizing transactions on-chain |
| Attestation (this contract) | Jubjub | Schnorr signature (custom polyfill) | Verifying off-chain data integrity |
| Hashing (circuits) | N/A | Rescue-Prime (ZK-friendly) | Commitments, nullifiers, public keys |

### Keys Used at Each Phase

| Phase | Key | Curve | How Used |
|-------|-----|-------|----------|
| 2. Circuit execution | `CoinPublicKey` | Jubjub | Identity via `ownPublicKey()` |
| 3. Proof generation | `CoinSecretKey` | Jubjub (BLS12-381 scalar) | ZK witness -- proves coin ownership |
| 4. Balancing | `CoinSecretKey` | Jubjub | Identifies spendable coins, computes nullifiers |
| 5. Signing | `SigningKey` | secp256k1 (BIP-340) | Authorizes the transaction |
| 8. Verification (node) | Verifier key | BLS12-381 | Validates ZK proof on-chain |

### Key Storage

| Key | UI (Browser) | CLI (Node.js) |
|-----|-------------|---------------|
| HD Seed (mnemonic) | Lace extension (encrypted) | User provides at startup |
| Zswap `CoinSecretKey` | Lace internal storage | LevelDB `signing-keys` sublevel |
| BIP-340 `SigningKey` | Lace internal storage | Derived from HD seed via `HDWallet` |
| Contract private state | In-memory `Map` | LevelDB `private-states` sublevel (AES-256-GCM) |

---

## Key Clarification: CoinSecretKey vs Contract Identity

In this contract, the user's on-chain identity is derived from the **CoinPublicKey**, not a separate secret key:

```compact
// Line 51-52 in zkloan-credit-scorer.compact
const zwapPublicKey = ownPublicKey();                        // CoinPublicKey (Jubjub point)
const requesterPubKey = publicKey(zwapPublicKey.bytes, secretPin);  // Hash(domain, pin, coinPubKey)
```

The `publicKey()` circuit (line 227) is named with a misleading `sk` parameter, but it receives the **public** key bytes:

```compact
export circuit publicKey(sk: Bytes<32>, pin: Uint<16>): Bytes<32> {
    const pinBytes = persistentHash<Uint<16>>(pin);
    return persistentHash<Vector<3, Bytes<32>>>(
           [pad(32, "zk-credit-scorer:pk"), pinBytes, sk]);  // sk = coinPublicKey.bytes
}
```

### Two Keys, Two Purposes

| Key | Type | Used In | Purpose |
|-----|------|---------|---------|
| `CoinPublicKey` | Jubjub point (not secret) | Circuit code via `ownPublicKey()` | Derives contract identity: `hash(domain, pin, coinPubKey)` |
| `CoinSecretKey` | Jubjub scalar (secret) | Zswap protocol layer (never referenced in Compact) | Proves coin ownership during ZK proof generation (nullifiers, spend authorization) |

The `CoinSecretKey` is **never directly referenced** in the Compact contract code. It is used internally by the Zswap protocol layer during proof generation to prove that the user actually owns the `CoinPublicKey` they claim. This happens at the WASM/native prover level, not in the JavaScript circuit execution.

Both are sent to the proof server as part of the witness data, but for different reasons:
- `CoinPublicKey` -- part of the circuit's public inputs (visible on-chain)
- `CoinSecretKey` -- private witness wire in the ZK arithmetic circuit (never revealed)

### Where is the BIP-340 Signature Attached?

The BIP-340 Schnorr signature (secp256k1) is a completely separate operation from the ZK proof. It is attached during **Phase 5 (signing)**, after proof generation and balancing are complete:

```
Phase 3: Proof server generates ZK proof    (uses CoinSecretKey on Jubjub)
Phase 4: Wallet balances the transaction    (uses CoinSecretKey for coin selection)
Phase 5: Wallet signs each intent segment   (uses BIP-340 SigningKey on secp256k1) <-- signature attached here
Phase 6: Finalize                           (binds everything together)
```

The ZK proof proves the **circuit execution** was correct. The BIP-340 signature authorizes the **transaction** on the ledger level. Two different proofs of two different things, using two different keys on two different curves.

---

## HSM Compatibility

Three distinct curves are involved, with very different HSM support:

| Layer | Curve | Standard HSM Support |
|-------|-------|---------------------|
| Transaction signing (BIP-340 Schnorr) | secp256k1 | Partial -- secp256k1 supported, but BIP-340 Schnorr is newer than ECDSA; only Bitcoin-focused hardware (Ledger, Trezor) supports it natively |
| Coin keys / ZK witnesses (Jubjub) | Jubjub (twisted Edwards over BLS12-381 scalar field) | None -- Jubjub is a ZK-specific embedded curve with zero enterprise HSM support |
| Proof verification (BLS12-381) | BLS12-381 | None -- pairing-friendly curves are not in standard HSM firmware |

### Fundamental Limitation

The ZK proof generation (Phase 3) requires the raw `CoinSecretKey` bytes as a witness input to the arithmetic circuit. The prover must perform Jubjub scalar operations that no standard HSM supports. The key **must** be available in memory during proof generation.

### Possible Custodial Approaches

| Approach | Security Model | Complexity |
|----------|---------------|------------|
| TEE + HSM (AWS Nitro, Intel SGX) | Key extracted from HSM into enclave only; never hits disk | High |
| Software HSM in TEE | All key operations inside a trusted enclave | Medium |
| Split key model | HSM for tx signing (secp256k1); separate proving key in encrypted storage | Medium -- requires contract redesign |
| Programmable HSM (Thales Luna) | Custom Jubjub + BIP-340 firmware | Very high cost |

---

## Custodial Security Architecture: HSM and TEE Integration

For a custodial service managing user keys on Midnight, the security architecture must account for the fact that the `CoinSecretKey` (Jubjub) cannot remain inside a standard HSM during proof generation. This section maps the exact security boundaries across each transaction phase.

### Security Zones by Phase

**Phase 1: Private Data Preparation**

```
+------------------------------------------------------------------+
|                         TEE ENCLAVE                               |
|                                                                    |
|  +------------------+     +-------------------+                   |
|  | Private State    |     | Attestation API   |                   |
|  | (credit data,    |     | (external, TLS)   |                   |
|  |  signatures)     |     |                   |                   |
|  | Stored encrypted |<--->| Schnorr sig over  |                   |
|  | at rest in TEE   |     | private data      |                   |
|  +------------------+     +-------------------+                   |
+------------------------------------------------------------------+
```

Private state (credit scores, attestation signatures) is sensitive business data. Stored encrypted at rest, decrypted only inside the TEE.

**Phase 2: Circuit Execution**

```
+------------------------------------------------------------------+
|                         TEE ENCLAVE                               |
|                                                                    |
|  +------------------+     +-------------------+                   |
|  | CoinPublicKey    |     | Compact Runtime   |                   |
|  | (Jubjub point)   |---->| (JS circuit exec) |                   |
|  | NOT secret, but  |     |                   |                   |
|  | derived from     |     | Accesses private  |                   |
|  | protected seed   |     | state as witness  |                   |
|  +------------------+     +-------------------+                   |
|                                   |                                |
|                                   v                                |
|                          UnprovenTransaction                       |
|                          + partialProofData                        |
+------------------------------------------------------------------+
```

Circuit execution uses the `CoinPublicKey` (not secret) but accesses private witness data. Runs inside TEE to protect private state.

**Phase 3: Proof Generation**

```
+------------------------------------------------------------------+
|                         TEE ENCLAVE                               |
|                                                                    |
|  +------------------+     +-------------------+                   |
|  | CoinSecretKey    |     | Proof Server      |                   |
|  | (Jubjub scalar)  |---->| (Plonk prover)    |                   |
|  |                  |     |                   |                   |
|  | MUST be in       |     | Generates zk-SNARK|                   |
|  | memory for       |     | using secret key  |                   |
|  | proof generation |     | as witness wire   |                   |
|  |                  |     |                   |                   |
|  | HSM IMPOSSIBLE:  |     | Output: Proof     |                   |
|  | Jubjub not       |     | (public, safe to  |                   |
|  | supported        |     |  leave TEE)       |                   |
|  +------------------+     +-------------------+                   |
|                                   |                                |
|                                   v                                |
|                          ProvenTransaction                         |
+------------------------------------------------------------------+
```

This is the critical phase. The `CoinSecretKey` must be available as raw bytes in memory for the ZK prover. No standard HSM supports Jubjub curve operations, so the key must exist in TEE memory. The proof server should run inside the same TEE enclave.

**Phase 4: Balancing**

```
+------------------------------------------------------------------+
|                         TEE ENCLAVE                               |
|                                                                    |
|  +------------------+     +-------------------+                   |
|  | CoinSecretKey    |     | Wallet SDK        |                   |
|  | (Jubjub scalar)  |---->| (balance logic)   |                   |
|  |                  |     |                   |                   |
|  | Needed to:       |     | Scans coin set,   |                   |
|  | - compute        |     | adds NIGHT/DUST   |                   |
|  |   nullifiers     |     | inputs/outputs    |                   |
|  | - identify       |     |                   |                   |
|  |   spendable      |     |                   |                   |
|  |   coins          |     |                   |                   |
|  +------------------+     +-------------------+                   |
|                                   |                                |
|                                   v                                |
|                          BalancedTransaction                       |
+------------------------------------------------------------------+
```

Balancing also needs the `CoinSecretKey` to compute nullifiers and identify which coins the user can spend. Same TEE enclave.

**Phase 5: Transaction Signing**

```
+------------------------------------------------------------------+
|                         TEE ENCLAVE                               |
|                                                                    |
|  +-------------------+     +---------------------------------+    |
|  | Balanced TX       |     |            HSM                  |    |
|  | (proven, balanced)|---->|  BIP-340 SigningKey (secp256k1)  |    |
|  |                   |     |                                  |    |
|  | TX payload bytes  |     |  signData(key, payload)          |    |
|  | sent to HSM for   |     |  -> 64-byte Schnorr signature   |    |
|  | signing           |     |                                  |    |
|  |                   |<----|  Key NEVER leaves HSM            |    |
|  | Receives signature|     |  Only operation HSM can handle   |    |
|  +-------------------+     +---------------------------------+    |
|          |                                                         |
|          v                                                         |
|  SignedTransaction                                                 |
+------------------------------------------------------------------+
```

This is the **only phase** where an HSM can be used in the traditional sense. The BIP-340 signing key (secp256k1) stays inside the HSM. The TEE sends the transaction payload to the HSM, receives the signature back. The signing key never leaves the HSM.

**Requires** an HSM that supports BIP-340 Schnorr on secp256k1 (not just ECDSA). Bitcoin Taproot hardware (Ledger, some newer HSMs) supports this.

**Phase 6-7: Finalize & Submit**

```
+------------------------------------------------------------------+
|  No secrets needed -- safe to run anywhere                        |
|                                                                    |
|  FinalizedTransaction --> Midnight Node (JSON-RPC)                |
|  (contains: proofs + signatures, no secret material)              |
+------------------------------------------------------------------+
```

No secret material involved. The finalized transaction contains only proofs and signatures (both public). Safe to transmit over the network.

### Complete Key Derivation Flow

```
+-------------------+
|       HSM         |
|                   |
|  HD Seed (stored) |
|  BIP-340 key      |-----> signData(payload) -> Signature
|  (stored, never   |       (only operation HSM performs at runtime)
|   exported)       |
|                   |
|  Jubjub seed      |
|  (exportable ONLY |---+
|   to verified TEE)|   |
+-------------------+   |
                         |
          +--------------v-----------------+
          |           TEE ENCLAVE          |
          |                                |
          |  Jubjub seed                   |
          |    -> derive CoinSecretKey     |
          |    -> derive CoinPublicKey     |
          |                                |
          |  CoinSecretKey lives ONLY      |
          |  in TEE memory, never on disk  |
          |                                |
          |  Runs: circuit execution,      |
          |        proof server,           |
          |        wallet balancing        |
          |                                |
          +--------------------------------+
```

### Summary: What Goes Where

| Component | Location | Reason |
|-----------|----------|--------|
| HD Seed / Mnemonic | HSM (key derivation) | Source of all keys -- never exposed |
| CoinSecretKey (Jubjub) | TEE memory only | HSMs don't support Jubjub. Must be in memory for proof generation + balancing. Loaded from HSM-stored seed, derived inside TEE |
| BIP-340 SigningKey (secp256k1) | HSM | The one key that can stay in an HSM. HSM receives TX payload, returns signature. Key never leaves. Requires HSM with BIP-340 Schnorr support |
| Private state (credit data) | TEE (encrypted at rest) | Sensitive business data, not a key -- TEE protects it in memory and encrypts on disk |
| Proof server | Inside TEE | Receives CoinSecretKey as witness input -- must be co-located in the trusted boundary |
| Proofs & signatures (output) | Public | Safe to leave TEE -- they reveal nothing about the secret inputs |

---

## TEE vs HSM: Do You Need Both?

A TEE (Trusted Execution Environment) can handle **all** key management on its own. A separate HSM is not strictly required for technical security -- it's primarily a compliance consideration.

### TEE-Only Architecture (Sufficient for Most Cases)

```
Encrypted seed blob (S3/KMS)
         |
         v
+--------------------------------------------+
|              TEE ENCLAVE                    |
|                                              |
|  1. Decrypt seed (sealed to enclave ID)     |
|  2. Derive CoinSecretKey (Jubjub)           |
|  3. Derive BIP-340 SigningKey (secp256k1)   |
|  4. Run circuit execution                   |
|  5. Generate ZK proof (proof server)        |
|  6. Balance transaction                     |
|  7. Sign transaction (BIP-340)              |
|  8. Submit finalized TX                     |
|                                              |
|  All keys in memory only.                   |
|  Keys zeroed on enclave shutdown.           |
|  Only finalized TX leaves the enclave.      |
+--------------------------------------------+
```

The TEE provides:

- **Memory isolation** -- even the host OS/hypervisor cannot read enclave memory
- **Sealed storage** -- data encrypted with a key tied to the enclave identity; only the same verified enclave can decrypt it
- **Remote attestation** -- clients can cryptographically verify they are communicating with the genuine enclave before sending sensitive data

### When to Add an HSM

| Concern | TEE Alone | TEE + HSM |
|---------|-----------|-----------|
| Key in memory during operations | Yes (required for Jubjub) | Same -- Jubjub key still needs memory |
| Key never in extractable memory | No -- keys exist in enclave RAM | Only for BIP-340 (secp256k1) |
| Physical tamper resistance | No -- TEE is CPU/software isolation | Yes -- HSM has tamper-evident/resistant hardware |
| FIPS 140-2/3 Level 3 certification | No (TEE is typically Level 1-2) | Yes -- required by some regulators |
| Side-channel attack resistance | Partial (SGX has had documented vulnerabilities) | Better -- HSMs are hardened against side-channels |
| Regulatory/compliance checkbox | May not satisfy auditors | Satisfies banking/financial regulators |

### Recommendation

**For most custodial setups:** TEE alone is enough. The Jubjub `CoinSecretKey` must be in memory anyway, so an HSM cannot protect it. Adding an HSM only for BIP-340 signing adds architectural complexity for marginal security gain.

**For regulated financial services (banks, licensed custodians):** Add an HSM because auditors and regulators require FIPS 140-2 Level 3 certification for key storage, regardless of technical merit. In this case:

- HSM stores the seed and the BIP-340 signing key (compliance checkbox)
- TEE receives the Jubjub key material exported from HSM at startup (operational necessity)
- Document in your security model that the Jubjub key exists in TEE memory as an accepted risk, mitigated by the TEE's memory isolation guarantees

### Cloud Platform Options

| Platform | TEE Option | HSM Option |
|----------|-----------|------------|
| AWS | Nitro Enclaves | CloudHSM (needs BIP-340 custom key store) |
| Azure | Confidential VMs (SGX/SEV) | Managed HSM |
| GCP | Confidential VMs | Cloud HSM |
| On-prem | Intel SGX / AMD SEV | Thales Luna, YubiHSM (needs custom firmware for BIP-340) |

---

## Lace Wallet vs CLI: Flow Comparison

### Lace (Browser DApp)

```
DApp                          Lace Extension                    Proof Server     Node
 |                                |                                |              |
 | submitCallTx()                 |                                |              |
 |  -> circuit execution (local)  |                                |              |
 |  -> POST /prove ---------------|------------------------------->|              |
 |  <- proof                      |                                |              |
 |                                |                                |              |
 | balanceUnsealedTransaction --->|                                |              |
 |   (serialized proven tx, {})   | 1. Deserialize                |              |
 |                                | 2. User confirmation popup    |              |
 |                                | 3. Balance (add NIGHT/DUST)   |              |
 |                                | 4. Sign (BIP-340 internally)  |              |
 |                                | 5. Finalize                   |              |
 | <- finalized tx hex            |                                |              |
 |                                |                                |              |
 | submitTransaction ------------>|---------------------------------------------->|
 |   (finalized tx hex, {})       |                                |              |
 |                                |                                |   Verify &   |
 |                                |                                |   include    |
 | watchForTxData (poll indexer)  |                                |              |
 | <- txId, blockHeight           |                                |              |
```

### CLI (Node.js SDK)

```
CLI Process                     WalletFacade                      Proof Server     Node
 |                                |                                |              |
 | contract.callTx.requestLoan()  |                                |              |
 |  -> circuit execution (local)  |                                |              |
 |  -> proofProvider.prove() -----|------------------------------->|              |
 |  <- proof                      |                                |              |
 |                                |                                |              |
 | balanceUnboundTransaction ---->|                                |              |
 |   (tx, secretKeys, {ttl})      | 1. Scan coin set              |              |
 |                                | 2. Calculate fees              |              |
 |                                | 3. Build balancing tx          |              |
 | <- BalancingRecipe             |                                |              |
 |                                |                                |              |
 | signRecipe ------------------->|                                |              |
 |   (recipe, signCallback)       | For each segment:             |              |
 |                                |   signData(key, payload)      |              |
 | <- signed recipe               |   (BIP-340 Schnorr)           |              |
 |                                |                                |              |
 | finalizeRecipe ---------------->|                                |              |
 | <- FinalizedTransaction        |                                |              |
 |                                |                                |              |
 | submitTransaction ------------->|---------------------------------------------->|
 |                                |                                |   Verify &   |
 |                                |                                |   include    |
 | watchForTxData (poll indexer)  |                                |              |
 | <- txId, blockHeight           |                                |              |
```

### Key Differences

| Aspect | Lace (UI) | CLI (SDK) |
|--------|-----------|-----------|
| Balance + Sign + Finalize | Single call (`balanceUnsealedTransaction`) | Three separate calls |
| User confirmation | Popup dialog in browser | Implicit (automated) |
| Key access | Keys never exposed to DApp | DApp has full key access |
| Signing | Internal to extension | Callback: `signData(key, payload)` |
| Submission | Via Lace extension relay | Direct to node JSON-RPC |
| Private state | In-memory `Map` | LevelDB (encrypted, persistent) |

---

## Relevant Source Files

### DApp (this repo)

| File | Purpose |
|------|---------|
| `zkloan-credit-scorer-ui/src/contexts/ZKLoanContext.tsx` | UI flow: wallet connection, circuit calls, Lace interaction |
| `zkloan-credit-scorer-cli/src/api.ts` | CLI flow: wallet init, contract deployment, circuit calls |
| `contract/src/zkloan-credit-scorer.compact` | Compact contract source |
| `contract/src/witnesses.ts` | Witness implementations (private data access) |

### Midnight SDK (node_modules)

| Package | Purpose |
|---------|---------|
| `@midnight-ntwrk/compact-runtime` | Circuit execution, `ownPublicKey()`, Zswap primitives |
| `@midnight-ntwrk/midnight-js-contracts` | `submitCallTx`, `createUnprovenCallTx`, transaction orchestration |
| `@midnight-ntwrk/wallet-sdk-facade` | `balanceUnboundTransaction`, `signRecipe`, `finalizeRecipe` |
| `@midnight-ntwrk/midnight-js-http-client-proof-provider` | HTTP client for proof server (`/check`, `/prove`) |
| `@midnight-ntwrk/ledger-v7` | `Transaction`, `signData`, `signingKeyFromBip340`, `CoinSecretKey` |
| `@midnight-ntwrk/wallet-sdk-hd` | HD wallet derivation (Zswap, NightExternal, Dust roles) |

---

*Last updated: 2026-02-27*
*Based on: ledger-v7 7.0.0, wallet-sdk-facade 1.0.0, dapp-connector-api 4.0.0, compact-runtime (language version 0.19/0.21)*
