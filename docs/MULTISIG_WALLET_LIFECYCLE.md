# Midnight Transaction Lifecycle: Compact Multisig Wallet (Gnosis Safe-like)

A complete end-to-end walkthrough of how a privacy-preserving multisig wallet built in Compact would operate on Midnight, covering all cryptographic operations, key usage, custodial security architecture, and HSM/TEE integration for each signer.

This document mirrors the analysis in [TRANSACTION_LIFECYCLE.md](./TRANSACTION_LIFECYCLE.md) but replaces the ZKLoan credit scorer example with a **multisig wallet** similar to Gnosis Safe, adapted for Midnight's privacy-preserving architecture.

---

## Multisig Wallet Contract Design

### Compact Contract Structure

```compact
pragma language_version 0.21;
import CompactStandardLibrary;

export enum ProposalStatus { Pending, Executed, Cancelled }
export enum ProposalType { Transfer, AddOwner, RemoveOwner, ChangeThreshold }

export struct Proposal {
    proposalType: ProposalType;
    destination: Bytes<32>;       // Recipient address (for transfers)
    amount: Uint<64>;             // NIGHT amount (for transfers)
    targetOwner: Bytes<32>;       // Owner to add/remove (for owner management)
    newThreshold: Uint<8>;        // New threshold (for threshold changes)
    status: ProposalStatus;
    approvalCount: Uint<8>;
    createdAtBlock: Uint<64>;
}

// Public ledger state
export ledger owners: Set<Bytes<32>>;           // Hashed owner identities (privacy-preserving)
export ledger ownerCount: Counter;
export ledger threshold: Uint<8>;               // Required approvals (e.g., 2 of 3)
export ledger proposals: Map<Uint<32>, Proposal>;
export ledger approvals: Map<Uint<32>, Set<Bytes<32>>>;  // proposalId -> set of approver hashes
export ledger nonce: Counter;
export ledger proposalCount: Counter;

// Private: each owner proves membership without revealing which owner they are
// Uses a Merkle tree for private set membership
export ledger ownerTree: MerkleTree<8, Bytes<32>>;

witness getOwnerSecret(): Bytes<32>;            // Owner's private identity secret
witness getMerkleProof(): MerkleTreePath<8, Bytes<32>>;  // Path proving membership

// Owner identity: hash(domain, coinPublicKey, ownerSecret)
// This creates an unlinkable identity per wallet instance
circuit ownerIdentity(coinPubKey: Bytes<32>, secret: Bytes<32>): Bytes<32> {
    return persistentHash<Vector<3, Bytes<32>>>(
        [pad(32, "midnight-multisig:owner"), coinPubKey, secret]
    );
}

// Prove you are an owner without revealing which one
circuit proveOwnership(): Bytes<32> {
    const secret = getOwnerSecret();
    const identity = ownerIdentity(ownPublicKey().bytes, disclose(secret));
    const path = getMerkleProof();
    assert(ownerTree.checkRoot(merkleTreePathRoot<8, Bytes<32>>(path)),
           "Not a registered owner");
    return identity;
}

export circuit proposeTransfer(destination: Bytes<32>, amount: Uint<64>): Uint<32> {
    const identity = proveOwnership();
    // ... create proposal, increment nonce
}

export circuit approveProposal(proposalId: Uint<32>): [] {
    const identity = proveOwnership();
    // ... add approval, check if threshold met, execute if ready
}

export circuit executeProposal(proposalId: Uint<32>): [] {
    const identity = proveOwnership();
    // ... verify threshold met, execute transfer/action
}
```

### Key Differences from a Standard Gnosis Safe

| Aspect | Gnosis Safe (Ethereum) | Midnight Compact Multisig |
|--------|----------------------|---------------------------|
| Owner identity | Public Ethereum addresses | Hashed identities via Merkle tree -- which owner approved is private |
| Approval visibility | Fully public (which address signed) | Only approval count is public; approver identity is ZK-proven |
| Transaction details | Fully public | Can be partially private (amount disclosed, destination can be committed) |
| Signing mechanism | ECDSA on secp256k1 (on-chain ecrecover) | ZK proof of ownership + BIP-340 Schnorr for tx authorization |
| Threshold enforcement | Solidity require() | Compact assert() inside ZK circuit |
| Gas/fees | ETH gas | DUST (derived from registered NIGHT) |

---

## Architecture Overview

```
+--------------------------------------------------------------------------+
|                     SIGNER'S MACHINE (Browser or Server)                  |
|                                                                           |
|  +---------------+   +------------------+   +------------------------+   |
|  | Owner Secret  |   |  Compact Runtime |   |  Proof Provider        |   |
|  | + Merkle Path |-->|  (circuit exec)  |-->|  (HTTP to proof server)|   |
|  | (witnesses)   |   |  CPU-only, no ZK |   |  ZK proof generation   |   |
|  +---------------+   +------------------+   +------------------------+   |
|         |                    |                        |                    |
|         |                    v                        v                    |
|         |          UnprovenTransaction      ProvenTransaction             |
|         |                                            |                    |
|  +------+--------------------------------------------+----------------+   |
|  |                    Wallet (Lace or SDK)                             |   |
|  |  1. Balance (add NIGHT/DUST for fees)                              |   |
|  |  2. Sign (BIP-340 Schnorr on secp256k1)                           |   |
|  |  3. Finalize                                                       |   |
|  +-------------------------------+------------------------------------+   |
|                                  |                                        |
+----------------------------------+----------------------------------------+
                                   v
                         +------------------+
                         |  Midnight Node   |
                         |  (verify ZK      |
                         |   proofs, check  |
                         |   BIP-340 sigs,  |
                         |   apply ledger)  |
                         +------------------+
```

**Critical distinction:** In a multisig wallet, each signer performs the full lifecycle independently. A 2-of-3 multisig `approveProposal` requires **two separate full transaction lifecycles** -- each signer proves their ownership via ZK proof and signs their own transaction with BIP-340.

---

## Phase 1: Prepare Private Data (Per Signer)

**Where:** Each signer's machine independently
**Keys used:** None yet

Each signer holds their private state:

```
Signer's private state:
{
    ownerSecret: Bytes<32>,         // Random secret chosen at wallet setup
    merkleProofPath: [...],         // Path in the owner Merkle tree
    // The identity hash is: hash("midnight-multisig:owner", coinPubKey, ownerSecret)
}
```

### Private State per Signer

| Data | Visibility | Purpose |
|------|-----------|---------|
| `ownerSecret` | Private (never leaves signer's machine) | Combined with `CoinPublicKey` to derive unique owner identity |
| Merkle tree path | Private (used as ZK witness) | Proves membership in owner set without revealing which leaf |
| Owner identity hash | Public (on-chain in approval set) | Unlinkable -- different per wallet instance even for same user |

### Storage

| Environment | Backend | Notes |
|-------------|---------|-------|
| Browser (Lace) | In-memory `Map` | Signer must re-enter or re-derive secret each session |
| Server (custodial) | TEE-protected storage | Encrypted at rest, sealed to enclave identity |
| CLI | LevelDB | AES-256-GCM encrypted on disk |

---

## Phase 2: Circuit Execution -- `approveProposal(proposalId)`

**Where:** Signer's machine, Compact Runtime (JavaScript)
**Keys used:** `CoinPublicKey` (Jubjub point) via `ownPublicKey()`

### What happens

```typescript
const circuitContext = createCircuitContext(
    multisigContractAddress,
    signerCoinPublicKey,        // Jubjub public key from this signer's wallet
    currentContractState,       // Fetched from indexer: owners, proposals, approvals
    signerPrivateState,         // ownerSecret + merkle proof
);

const result = contract.circuits.approveProposal(circuitContext, proposalId);
```

### Inside the circuit

1. **Witness `getOwnerSecret()`** -- returns the signer's private owner secret
2. **Witness `getMerkleProof()`** -- returns the Merkle path proving this identity is in the owner tree
3. **`ownPublicKey()`** -- reads signer's `CoinPublicKey` (Jubjub point) from circuit context
4. **Compute identity:** `hash("midnight-multisig:owner", coinPubKey.bytes, ownerSecret)`
5. **Verify Merkle membership:** `ownerTree.checkRoot(merkleTreePathRoot(path))` -- proves the signer is a registered owner without revealing which one
6. **Check not already approved:** `!approvals.lookup(proposalId).member(identity)`
7. **Add approval:** `approvals.lookup(proposalId).insert(disclose(identity))` -- identity hash is disclosed but unlinkable
8. **Check threshold:** if `approvalCount >= threshold`, mark proposal as executable

### What becomes public vs private

| Data | Visibility | On-chain |
|------|-----------|----------|
| Proposal ID being approved | Public | Yes -- necessary for coordination |
| Approval count | Public | Yes -- others need to see progress toward threshold |
| Which owner approved | **Private** | No -- only the identity hash is stored, and the Merkle proof hides which leaf was used |
| Owner's `CoinPublicKey` | **Private** | No -- hidden inside the ZK proof |
| Owner's secret | **Private** | No -- never leaves the witness |

### Output

`UnprovenTransaction` with `partialProofData` containing the circuit execution trace. The proof must demonstrate:
- The signer knows a valid `ownerSecret`
- The derived identity is in the Merkle tree
- The identity has not already approved this proposal

---

## Phase 3: Proof Generation (Proof Server)

**Where:** Proof server (localhost:6300 in dev, custodial TEE in production)
**Keys used:** `CoinSecretKey` (Jubjub scalar) -- Zswap witness wire
**Protocol:** HTTP POST

```
Signer's machine                        Proof Server (:6300)
     |                                       |
     |  POST /prove                          |
     |  {                                    |
     |    circuitId: "approveProposal",      |
     |    partialProofData: {                |
     |      CoinSecretKey (Jubjub scalar),   |  <-- Zswap protocol witness
     |      ownerSecret (Bytes<32>),         |  <-- Contract witness
     |      merkleProofPath ([...]),         |  <-- Contract witness
     |      circuit execution trace,         |
     |    }                                  |
     |  }                                    |
     |-------------------------------------->|
     |                                       | Plonk prover generates ZK proof:
     |                                       |
     |                                       | Proves:
     |                                       |  1. Signer owns CoinPublicKey
     |                                       |     (via CoinSecretKey witness)
     |                                       |  2. Identity = hash(domain,
     |                                       |     coinPubKey, ownerSecret)
     |                                       |  3. Identity is in Merkle tree
     |                                       |  4. Circuit logic executed correctly
     |                                       |
     |  { proof: Uint8Array }                |
     |<--------------------------------------|
```

### Secrets Sent to Proof Server

| Secret | Why It's Needed | Curve |
|--------|----------------|-------|
| `CoinSecretKey` | Proves ownership of `CoinPublicKey` (Zswap protocol layer) | Jubjub (BLS12-381 scalar field) |
| `ownerSecret` | Proves the signer can derive a valid owner identity | N/A (raw bytes, hashed in circuit) |
| Merkle tree path | Proves identity membership without revealing which leaf | N/A (tree structure) |

All three are private witness wires in the ZK arithmetic circuit. None are revealed in the proof output.

### Output

`Transaction<SignatureEnabled, Proof, PreBinding>` -- proven, but not balanced or signed.

---

## Phase 4: Balance the Transaction

**Where:** Signer's wallet (Lace or WalletFacade)
**Keys used:** `CoinSecretKey` (Jubjub) -- to compute nullifiers and identify spendable coins

```typescript
// Via Lace (browser)
const result = await (wallet as any).balanceUnsealedTransaction(serializedStr, {});

// Via SDK (server/CLI)
const recipe = await signerWallet.balanceUnboundTransaction(tx, secretKeys, { ttl });
```

Each signer pays their own transaction fee from their own NIGHT/DUST balance. The multisig wallet contract itself does not hold NIGHT for fees -- each approval transaction is independently funded by the approving signer.

---

## Phase 5: Sign the Transaction (BIP-340 Schnorr)

**Where:** Signer's wallet
**Keys used:** `SigningKey` (BIP-340, secp256k1) -- each signer has their own

```typescript
const signedRecipe = await signerWallet.signRecipe(
    recipe,
    (payload: Uint8Array) => ledger.signData(signerSigningKey, payload)
);
```

**Important distinction:** This BIP-340 signature authorizes the **Midnight transaction** (the approval action). It is **not** the multisig approval itself -- that was proven in the ZK circuit. The BIP-340 signature is required by the Midnight ledger protocol for any transaction, regardless of what the contract does.

### Two Layers of "Signing"

| Layer | Mechanism | Purpose | Curve |
|-------|-----------|---------|-------|
| **Contract-level approval** | ZK proof of Merkle membership | Proves "I am a valid owner and I approve this proposal" | Jubjub (inside ZK circuit) |
| **Transaction-level authorization** | BIP-340 Schnorr signature | Proves "I authorize this transaction to be included on-chain" | secp256k1 |

Both are required. The ZK proof handles the **multisig logic**. The BIP-340 signature handles the **blockchain protocol**.

---

## Phase 6-7: Finalize & Submit

Same as any Midnight transaction:

```typescript
const finalizedTx = await signerWallet.finalizeRecipe(signedRecipe);
const txId = await signerWallet.submitTransaction(finalizedTx);
```

No secrets involved. The finalized transaction (proofs + signatures) is submitted to the Midnight node.

---

## Phase 8: Node Validates

The Midnight node:

1. **Verifies BIP-340 signature** (secp256k1 Schnorr) -- transaction authorization
2. **Verifies ZK proof** using on-chain verifier key for `approveProposal` circuit
3. **Applies ledger operations:**
   - Inserts identity hash into `approvals[proposalId]`
   - Increments approval count
   - If threshold reached, updates proposal status
4. **Includes in block**

---

## Phase 9: Threshold Reached -- Execute Proposal

When enough signers have approved (each through their own independent transaction lifecycle), any owner can call `executeProposal`:

```
Signer 1: proposeTransfer(dest, 10000)  -->  Proposal #7 created (Pending)
Signer 2: approveProposal(7)            -->  Approval 1/2
Signer 3: approveProposal(7)            -->  Approval 2/2, threshold met
Signer 1: executeProposal(7)            -->  Transfer executed
```

Each of these is a **separate, independent transaction** going through the full 9-phase lifecycle. The coordination happens at the contract level (checking approval counts), not at the protocol level.

---

## Complete Multi-Signer Flow

```
Signer A (Proposer)                Signer B (Approver)              Signer C (Approver)
     |                                  |                                |
     | proposeTransfer(dest, amt)       |                                |
     |  Phase 1: Load ownerSecret      |                                |
     |  Phase 2: Circuit execution     |                                |
     |  Phase 3: Proof generation      |                                |
     |  Phase 4: Balance (A pays fee)  |                                |
     |  Phase 5: Sign (A's BIP-340)    |                                |
     |  Phase 6-7: Submit              |                                |
     |  Phase 8: Node validates        |                                |
     |  Phase 9: Proposal created      |                                |
     |                                  |                                |
     |  (off-chain: notify signers)    |                                |
     |-------------------------------->|                                |
     |                                  |                                |
     |                                  | approveProposal(id)           |
     |                                  |  Phase 1: Load ownerSecret    |
     |                                  |  Phase 2: Circuit execution   |
     |                                  |  Phase 3: Proof generation    |
     |                                  |  Phase 4: Balance (B pays)    |
     |                                  |  Phase 5: Sign (B's BIP-340)  |
     |                                  |  Phase 6-7: Submit            |
     |                                  |  Phase 8: Node validates      |
     |                                  |  Phase 9: Approval 1/2        |
     |                                  |                                |
     |                                  |  (off-chain: notify signers)  |
     |                                  |------------------------------->|
     |                                  |                                |
     |                                  |                                | approveProposal(id)
     |                                  |                                |  Phase 1-9: same flow
     |                                  |                                |  Approval 2/2
     |                                  |                                |  Threshold met!
     |                                  |                                |
     | executeProposal(id)              |                                |
     |  Phase 1-9: same flow           |                                |
     |  Transfer executed on-chain     |                                |
     |                                  |                                |
```

---

## Cryptographic Primitives Summary

### Keys Per Signer

| Key | Type | Curve | Used In | Purpose |
|-----|------|-------|---------|---------|
| `CoinPublicKey` | Jubjub point (not secret) | Jubjub | Circuit via `ownPublicKey()` | Part of owner identity derivation |
| `CoinSecretKey` | Jubjub scalar (secret) | Jubjub (BLS12-381 scalar) | Proof generation (Zswap layer) | Proves coin ownership for spending |
| `ownerSecret` | Random bytes (secret) | N/A | Circuit witness | Combined with CoinPublicKey to derive owner identity |
| `SigningKey` | BIP-340 key (secret) | secp256k1 | Transaction signing | Authorizes Midnight transaction |
| Merkle tree path | Tree nodes (private) | N/A | Circuit witness | Proves set membership without revealing position |

### Keys Used at Each Phase

| Phase | Keys | Curve | Purpose |
|-------|------|-------|---------|
| 2. Circuit execution | `CoinPublicKey` | Jubjub | Identity via `ownPublicKey()` for owner hash |
| 3. Proof generation | `CoinSecretKey` + `ownerSecret` + Merkle path | Jubjub + N/A | ZK witness: proves ownership + membership |
| 4. Balancing | `CoinSecretKey` | Jubjub | Identifies spendable coins, computes nullifiers |
| 5. Signing | `SigningKey` | secp256k1 (BIP-340) | Authorizes the Midnight transaction |
| 8. Verification (node) | Verifier key | BLS12-381 | Validates ZK proof on-chain |

---

## Custodial Security Architecture: Multi-Signer HSM/TEE

In a custodial multisig setup, each signer's keys are managed by a custodial service. This creates a more complex security topology than a single-signer scenario because:

1. **Each signer has independent key material** -- different `CoinSecretKey`, `ownerSecret`, `SigningKey`
2. **Compromise of one signer is not catastrophic** -- threshold prevents unilateral action
3. **But each signer's TEE/HSM must be independently secure** -- a shared TEE defeats the purpose of multisig

### Architecture: Independent TEE Per Signer

```
+-------------------+  +-------------------+  +-------------------+
|   SIGNER A TEE    |  |   SIGNER B TEE    |  |   SIGNER C TEE    |
|                   |  |                   |  |                   |
| CoinSecretKey_A   |  | CoinSecretKey_B   |  | CoinSecretKey_C   |
| ownerSecret_A     |  | ownerSecret_B     |  | ownerSecret_C     |
| MerklePath_A      |  | MerklePath_B      |  | MerklePath_C      |
|                   |  |                   |  |                   |
| +Proof Server A+  |  | +Proof Server B+  |  | +Proof Server C+  |
| +Circuit Exec  +  |  | +Circuit Exec  +  |  | +Circuit Exec  +  |
| +Wallet SDK    +  |  | +Wallet SDK    +  |  | +Wallet SDK    +  |
+--------+----------+  +--------+----------+  +--------+----------+
         |                       |                       |
         v                       v                       v
+--------+----------+  +--------+----------+  +--------+----------+
|    HSM A          |  |    HSM B          |  |    HSM C          |
| BIP-340 Key_A     |  | BIP-340 Key_B     |  | BIP-340 Key_C     |
| (signing only)    |  | (signing only)    |  | (signing only)    |
+-------------------+  +-------------------+  +-------------------+
         |                       |                       |
         +----------+------------+-----------+-----------+
                    |                        |
                    v                        v
            +---------------+     +-------------------+
            | Midnight Node |     | Coordination      |
            | (validates    |     | Service            |
            |  all txns)    |     | (notifies signers  |
            +---------------+     |  of new proposals) |
                                  +-------------------+
```

### Why Independent TEEs

If all signers share a single TEE, then:
- Compromising that one TEE compromises **all** signer keys
- The multisig threshold becomes meaningless -- an attacker with TEE access can sign as all owners
- The security degrades from M-of-N multisig to single-point-of-failure

Each signer's TEE must be:
- **Physically separate** (different hardware, different data center, or at minimum different enclave instances)
- **Independently attestable** (each TEE has its own attestation identity)
- **Separately administered** (different access controls, different key custodians)

### Geographic Distribution (Recommended)

```
+------------------+    +------------------+    +------------------+
| Region: US-East  |    | Region: EU-West  |    | Region: AP-South |
|                  |    |                  |    |                  |
| TEE A (Nitro)    |    | TEE B (Nitro)    |    | TEE C (Nitro)    |
| HSM A (CloudHSM) |    | HSM B (CloudHSM) |    | HSM C (CloudHSM) |
|                  |    |                  |    |                  |
| Signer A keys    |    | Signer B keys    |    | Signer C keys    |
+------------------+    +------------------+    +------------------+
         \                      |                       /
          \                     |                      /
           +--------------------+---------------------+
                                |
                        Midnight Network
```

### Security Zones by Phase (Per Signer)

**Phases 1-3: Private Data, Circuit Execution, Proof Generation**

```
+------------------------------------------------------------------+
|                     SIGNER N's TEE ENCLAVE                        |
|                                                                    |
|  +------------------+  +------------------+  +----------------+   |
|  | CoinSecretKey_N  |  | ownerSecret_N    |  | Proof Server   |   |
|  | (Jubjub scalar)  |  | (Bytes<32>)      |  | (co-located)   |   |
|  |                  |  |                  |  |                |   |
|  | From HSM seed,   |  | Sealed to this   |  | Receives all   |   |
|  | derived in TEE   |  | TEE instance     |  | secrets as     |   |
|  |                  |  |                  |  | witness wires  |   |
|  +--------+---------+  +--------+---------+  +-------+--------+   |
|           |                      |                    |            |
|           +----------------------+--------------------+            |
|                                  |                                 |
|                                  v                                 |
|                         ProvenTransaction                          |
|                         (safe to leave TEE)                        |
+------------------------------------------------------------------+
```

All three secrets (`CoinSecretKey`, `ownerSecret`, Merkle path) must be in the TEE's memory simultaneously during proof generation. No standard HSM can perform the Jubjub or Rescue-Prime operations needed.

**Phase 5: Transaction Signing**

```
+------------------------------------------------------------------+
|                     SIGNER N's TEE ENCLAVE                        |
|                                                                    |
|  +-------------------+     +---------------------------------+    |
|  | Balanced TX       |     |         HSM N                   |    |
|  | payload bytes     |---->|  BIP-340 SigningKey_N            |    |
|  |                   |     |  (secp256k1)                     |    |
|  |                   |     |                                  |    |
|  |                   |     |  signData(key, payload)          |    |
|  |                   |     |  -> 64-byte Schnorr signature    |    |
|  |                   |<----|                                  |    |
|  | + signature       |     |  Key NEVER leaves HSM           |    |
|  +-------------------+     +---------------------------------+    |
+------------------------------------------------------------------+
```

### Key Derivation Flow (Per Signer)

```
+-------------------+
|    HSM N          |
|                   |
|  HD Seed_N        |
|  (stored, never   |
|   exported raw)   |
|                   |
|  BIP-340 key -----+-----> signData(payload) -> Signature
|  (never leaves    |       (runtime signing operation)
|   HSM)            |
|                   |
|  Jubjub seed -----+---+
|  (exportable to   |   |
|   attested TEE    |   |
|   only)           |   |
+-------------------+   |
                         |
          +--------------v-----------------+
          |      SIGNER N's TEE ENCLAVE    |
          |                                |
          |  Jubjub seed                   |
          |    -> derive CoinSecretKey_N   |
          |    -> derive CoinPublicKey_N   |
          |                                |
          |  ownerSecret_N                 |
          |    (sealed storage in TEE)     |
          |                                |
          |  Merkle path_N                 |
          |    (sealed storage or fetched  |
          |     from indexer + recomputed) |
          |                                |
          +--------------------------------+
```

### Secret Inventory Per Signer

| Secret | Location | Backup Strategy |
|--------|----------|-----------------|
| HD Seed | HSM (never exported raw) | HSM key ceremony + Shamir shares in separate vaults |
| BIP-340 SigningKey | HSM (derived from seed) | Re-derivable from seed |
| CoinSecretKey (Jubjub) | TEE memory only (derived from seed) | Re-derivable from seed in any attested TEE |
| ownerSecret | TEE sealed storage | Encrypted backup in cold storage; loss = need to re-register as owner via multisig governance |
| Merkle tree path | TEE (can be recomputed from indexer) | Not secret per se -- privacy relies on ZK proof, not path secrecy. Can be re-fetched. |

---

## TEE vs HSM: Multisig-Specific Considerations

### TEE-Only Architecture (Per Signer)

```
Encrypted seed blob (KMS, unique per signer)
         |
         v
+----------------------------------------------+
|           SIGNER N's TEE ENCLAVE             |
|                                                |
|  1. Decrypt seed (sealed to enclave ID)       |
|  2. Derive CoinSecretKey (Jubjub)             |
|  3. Derive BIP-340 SigningKey (secp256k1)     |
|  4. Load ownerSecret (sealed storage)         |
|  5. Run circuit execution                     |
|  6. Generate ZK proof (proof server)          |
|  7. Balance transaction                       |
|  8. Sign transaction (BIP-340)                |
|  9. Submit finalized TX                       |
|                                                |
|  All keys in memory only.                     |
|  Keys zeroed on enclave shutdown.             |
|  Only finalized TX leaves the enclave.        |
+----------------------------------------------+
```

**Advantages for multisig:**
- Simpler deployment -- one TEE per signer, no HSM procurement
- Sufficient security if the primary threat model is remote compromise
- Lower cost -- cloud TEEs (AWS Nitro) are significantly cheaper than CloudHSM

### TEE + HSM Architecture (Per Signer)

**Advantages for multisig:**
- BIP-340 signing key has hardware-backed non-extractability
- FIPS 140-2 Level 3 certification for the signing key satisfies financial regulators
- Defense-in-depth: even if TEE is compromised, attacker cannot forge BIP-340 signatures without HSM access

**When HSM adds real value in multisig context:**

| Threat | TEE Only | TEE + HSM |
|--------|----------|-----------|
| Remote code execution in TEE | All keys exposed | BIP-340 key safe in HSM; attacker can forge ZK proofs but cannot sign transactions |
| TEE side-channel (e.g., SGX vulnerabilities) | All keys at risk | BIP-340 key protected; Jubjub key at risk |
| Physical access to server | TEE memory potentially extractable | HSM resists physical tampering |
| Insider threat (rogue admin) | Depends on TEE attestation | HSM provides additional access control layer |
| Single signer compromised | Threshold protects (M-of-N) | Same -- threshold still protects |

### Recommendation for Multisig

**For 2-of-3 or 3-of-5 custodial multisig:**

The multisig threshold itself provides significant security. Even if one signer's TEE is fully compromised, the attacker cannot execute proposals unilaterally. This means:

1. **TEE-only is acceptable** if signers are geographically distributed and independently administered
2. **Add HSMs** if regulated (banking, licensed custodian) or if signers are in the same physical facility
3. **The threshold is your primary security mechanism** -- HSM/TEE are defense-in-depth for individual signers

```
Security layering:

Layer 1: M-of-N threshold             (attacker needs multiple signers)
Layer 2: Geographic distribution       (attacker needs access to multiple facilities)
Layer 3: TEE per signer               (attacker needs enclave compromise per signer)
Layer 4: HSM per signer (optional)    (attacker needs physical HSM access per signer)
```

---

## Coordination Service

The multisig wallet needs an off-chain coordination layer to notify signers of pending proposals. This service does **not** handle any secrets.

```
+--------------------------------------------+
|         Coordination Service               |
|         (NO secrets, NO signing)            |
|                                              |
|  - Watches Midnight indexer for new          |
|    proposals and approval events             |
|  - Notifies signers via webhook/push         |
|  - Provides UI for viewing proposal status   |
|  - Optionally queues transactions for        |
|    signers to review and approve             |
|                                              |
|  Security: Read-only access to public        |
|  on-chain data. No key material.             |
+--------------------------------------------+
         |              |              |
         v              v              v
    Signer A TEE   Signer B TEE   Signer C TEE
```

The coordination service can run on standard infrastructure -- it only reads public blockchain state and sends notifications. No TEE or HSM required.

---

## Comparison: Single-Signer (ZKLoan) vs Multisig Security

| Aspect | ZKLoan (Single Signer) | Multisig Wallet (M-of-N) |
|--------|----------------------|--------------------------|
| Key compromise impact | Total -- attacker can act as user | Partial -- attacker needs M signers |
| TEE instances needed | 1 | N (one per signer) |
| HSM instances needed | 0-1 | 0-N (one per signer, optional) |
| Proof server instances | 1 (shared or per-user) | N (one per signer TEE, or shared with mutual TLS) |
| Secrets in proof | CoinSecretKey | CoinSecretKey + ownerSecret + Merkle path |
| Transaction signing | 1 BIP-340 signature | 1 BIP-340 signature per approval transaction |
| On-chain approval mechanism | N/A | ZK-proven Merkle membership + threshold count |
| Privacy of approvers | N/A | Hidden -- Merkle tree proves membership without revealing which owner |
| Recovery from key loss | Re-derive from mnemonic | Other owners can vote to add replacement owner |

---

## Cloud Deployment Example: 2-of-3 Multisig on AWS

```
AWS Region: us-east-1                AWS Region: eu-west-1
+---------------------------+        +---------------------------+
| EC2 + Nitro Enclave       |        | EC2 + Nitro Enclave       |
|                           |        |                           |
| Signer A TEE:             |        | Signer B TEE:             |
|  - CoinSecretKey_A        |        |  - CoinSecretKey_B        |
|  - ownerSecret_A          |        |  - ownerSecret_B          |
|  - Proof server (local)   |        |  - Proof server (local)   |
|  - Wallet SDK             |        |  - Wallet SDK             |
|                           |        |                           |
| CloudHSM (optional):      |        | CloudHSM (optional):      |
|  - BIP-340 SigningKey_A   |        |  - BIP-340 SigningKey_B   |
+---------------------------+        +---------------------------+

AWS Region: ap-southeast-1
+---------------------------+
| EC2 + Nitro Enclave       |
|                           |
| Signer C TEE:             |
|  - CoinSecretKey_C        |
|  - ownerSecret_C          |
|  - Proof server (local)   |
|  - Wallet SDK             |
|                           |
| CloudHSM (optional):      |
|  - BIP-340 SigningKey_C   |
+---------------------------+

Shared (no secrets):
+---------------------------+
| Coordination Service      |
|  - Indexer watcher        |
|  - Notification system    |
|  - Proposal dashboard     |
+---------------------------+
```

### Cost Estimate (Per Signer)

| Component | AWS Service | Approximate Monthly Cost |
|-----------|------------|-------------------------|
| TEE | EC2 c5.xlarge + Nitro Enclave | ~$125 |
| HSM (optional) | CloudHSM | ~$1,400 (dedicated HSM cluster) |
| Proof server | Runs inside TEE (CPU-bound) | Included in EC2 cost |
| Coordination service | Lambda + DynamoDB | ~$10 |

Without HSM: ~$135/signer/month ($405 for 3 signers)
With HSM: ~$1,535/signer/month ($4,605 for 3 signers)

The HSM adds ~10x cost per signer. For most setups, the M-of-N threshold provides sufficient security without individual HSMs.

---

## Relevant Source Files

### Midnight SDK (used by each signer)

| Package | Purpose |
|---------|---------|
| `@midnight-ntwrk/compact-runtime` | Circuit execution, `ownPublicKey()`, Merkle tree verification |
| `@midnight-ntwrk/midnight-js-contracts` | `submitCallTx`, transaction orchestration |
| `@midnight-ntwrk/wallet-sdk-facade` | `balanceUnboundTransaction`, `signRecipe`, `finalizeRecipe` |
| `@midnight-ntwrk/midnight-js-http-client-proof-provider` | HTTP client for proof server |
| `@midnight-ntwrk/ledger-v7` | `Transaction`, `signData`, `signingKeyFromBip340`, `CoinSecretKey` |
| `@midnight-ntwrk/wallet-sdk-hd` | HD wallet derivation (Zswap, NightExternal, Dust roles) |

### Compact Patterns Used

| Pattern | Purpose |
|---------|---------|
| `MerkleTree<N, T>` | Private owner set membership proof |
| `Set<Bytes<32>>` | Approval tracking (identity hashes) |
| `Map<Uint<32>, Proposal>` | Proposal storage |
| `ownPublicKey()` | Signer identity derivation |
| `persistentHash<Vector<3, Bytes<32>>>` | Domain-separated identity hashing |
| `disclose()` | Explicit disclosure of identity hashes and approval counts |

---

*Last updated: 2026-02-27*
*Based on: Midnight SDK v7.0.0, Compact language version 0.21*
*Reference architecture: [TRANSACTION_LIFECYCLE.md](./TRANSACTION_LIFECYCLE.md) for single-signer ZKLoan analysis*
