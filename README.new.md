# ZKLoan Credit Scorer

A privacy-preserving loan application DApp built on **Midnight**, demonstrating how zero-knowledge proofs enable confidential credit evaluation without exposing sensitive financial data.

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Problem & Midnight's Solution](#2-the-problem--midnights-solution)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Credit Evaluation Tiers](#5-credit-evaluation-tiers)
6. [Contract Features](#6-contract-features)
7. [Circuit Reference](#7-circuit-reference)
8. [Advanced Patterns](#8-advanced-patterns)
9. [Security Considerations](#9-security-considerations)
10. [Getting Started](#10-getting-started)
11. [Testing](#11-testing)
12. [Extending the Example](#12-extending-the-example)

---

## 1. Overview

The ZKLoan Credit Scorer is a decentralized application (DApp) that demonstrates the powerful privacy-preserving capabilities of **Midnight's Compact smart contract language**. It showcases how to build applications that process sensitive data while keeping that data completely confidential.

### What This Example Demonstrates

| Concept | Implementation |
|---------|---------------|
| **Private Data Processing** | Credit scores evaluated off-chain, never exposed on-chain |
| **Public State Management** | Nested Map structures for complex relational data |
| **Role-Based Access Control** | Admin-only operations with ownership transfer |
| **Batched Data Migration** | Fixed-iteration pattern for moving records between keys |
| **Input Validation** | Secure assertions protecting contract integrity |

### Disclaimer

This DApp is an **educational example** intended to demonstrate Midnight platform features and Compact language patterns. The business logic has been simplified for clarity and is not intended for production use without additional security review and enhancements.

---

## 2. The Problem & Midnight's Solution

### The Problem with Traditional Credit Scoring

In conventional finance, applying for a loan requires disclosing extensive personally identifiable information (PII) to lending institutions:

- **Data Security Risks**: Centralized databases are high-value targets. A single breach can expose millions of users' financial data.
- **Lack of User Control**: Once submitted, users lose control over their data with little visibility into how it's stored or used.
- **Unnecessary Disclosure**: Lenders often only need to verify simple assertions (e.g., "Is the credit score above 700?") but end up collecting entire datasets.

### Why Midnight is the Ideal Solution

Midnight's architecture, powered by the **Kachina model** for smart contracts, enables applications to manage two distinct states simultaneously:

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S DEVICE                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PRIVATE STATE (Never Leaves)                │   │
│  │  • Credit Score: 720                                     │   │
│  │  • Monthly Income: $3,500                                │   │
│  │  • Months as Customer: 36                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│                   ┌─────────────────┐                          │
│                   │  ZK Proof Gen   │                          │
│                   │  (Off-Chain)    │                          │
│                   └────────┬────────┘                          │
└────────────────────────────┼────────────────────────────────────┘
                             │ Proof + Public Output Only
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MIDNIGHT BLOCKCHAIN                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              PUBLIC STATE (On-Chain)                     │   │
│  │  • Loan #1: Approved, $10,000 authorized                 │   │
│  │  • Loan #2: Approved, $5,000 authorized                  │   │
│  │  (No credit scores, income, or PII visible)              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

The **zero-knowledge proof** bridges these worlds: it cryptographically proves that the evaluation was performed correctly according to predefined rules, without revealing the underlying private data. The blockchain verifies the proof and updates the public ledger, ensuring both **privacy and integrity**.

### Benefits for All Parties

| Stakeholder | Benefit |
|-------------|---------|
| **Users** | Financial data stays private; no risk of data breaches exposing their information |
| **Lenders** | Reduced data liability; compliance with data minimization principles (GDPR, etc.) |
| **Regulators** | Auditable rules with cryptographic guarantees of correct execution |

This elegant separation is what makes Midnight uniquely suited for privacy-sensitive applications in finance, healthcare, identity, and beyond.

---

## 3. Architecture

### Data Flow

```
User Request                 Off-Chain Processing              On-Chain Result
─────────────               ────────────────────              ────────────────

[Amount + PIN] ──────► [Witness provides private data]
                              │
                              ▼
                       [evaluateApplicant()]
                       Compares against tiers
                              │
                              ▼
                       [Generate ZK Proof]
                              │
                              ▼
                       [createLoan()]  ──────► [loans Map updated]
                       Writes public result     Approved/Rejected
                                                + authorized amount
```

### State Architecture

| State Type | Location | Contents | Visibility |
|------------|----------|----------|------------|
| **Private State** | User's device | `creditScore`, `monthlyIncome`, `monthsAsCustomer` | Never shared |
| **Public Ledger** | Blockchain | `loans`, `blacklist`, `admin`, `onGoingPinMigration` | Publicly verifiable |

### Identity Model

Users are identified by a **privacy-preserving public key** derived from:

```
publicKey = hash("zk-credit-scorer:pk" || hash(PIN) || ZswapPublicKey)
```

This design means:
- The same user with different PINs has completely separate, unlinkable identities
- No direct connection between on-chain activity and real-world identity
- Users can compartmentalize their loan history across multiple PINs if desired

---

## 4. Project Structure

```
zkloan-credit-scorer/
├── contract/                          # Smart contract package
│   ├── src/
│   │   ├── zkloan-credit-scorer.compact  # The Compact contract
│   │   ├── witnesses.ts                   # Witness implementation
│   │   ├── managed/                       # Generated artifacts (after compilation)
│   │   └── test/
│   │       ├── zkloan-credit-scorer.test.ts      # Test suite
│   │       ├── zkloan-credit-scorer.simulator.ts # Circuit simulator
│   │       └── utils/
│   └── package.json
│
├── zkloan-credit-scorer-cli/          # CLI application package
│   └── src/
│       └── state.utils.ts             # User profile utilities
│
├── package.json                       # Workspace root
└── README.md
```

### Key Files

| File | Purpose |
|------|---------|
| `zkloan-credit-scorer.compact` | The Compact smart contract defining all circuits and ledger state |
| `witnesses.ts` | TypeScript implementation of witness functions that provide private data |
| `zkloan-credit-scorer.simulator.ts` | Test harness for executing circuits without deploying |
| `state.utils.ts` | Utilities for creating user profiles with different credit tiers |

---

## 5. Credit Evaluation Tiers

The contract implements a three-tier credit evaluation system:

| Tier | Credit Score | Monthly Income | Tenure (Months) | Max Loan Amount |
|------|-------------|----------------|-----------------|-----------------|
| **Tier 1** (Premium) | ≥ 700 | ≥ $2,000 | ≥ 24 | $10,000 |
| **Tier 2** (Standard) | ≥ 600 | ≥ $1,500 | Any | $7,000 |
| **Tier 3** (Basic) | ≥ 580 | Any | Any | $3,000 |
| **Rejected** | < 580 | — | — | $0 |

**Important**: The user can request any amount, but the contract caps the authorized amount at the tier maximum. For example, a Tier 2 user requesting $15,000 will be approved for $7,000.

---

## 6. Contract Features

### Roles

#### User Role
Regular users interact with the contract through:

| Action | Circuit | Description |
|--------|---------|-------------|
| Apply for loan | `requestLoan` | Submit loan application with amount and PIN |
| Change PIN | `changePin` | Migrate all loans to a new PIN (batched operation) |

#### Admin Role
The admin (set at deployment) can:

| Action | Circuit | Description |
|--------|---------|-------------|
| Blacklist user | `blacklistUser` | Prevent a Zswap key from requesting loans |
| Remove from blacklist | `removeBlacklistUser` | Restore a user's ability to request loans |
| Transfer admin | `transferAdmin` | Hand over admin role to a new address |

### Ledger State

```compact
export ledger loans: Map<Bytes<32>, Map<Uint<16>, LoanApplication>>;
export ledger blacklist: Set<ZswapCoinPublicKey>;
export ledger onGoingPinMigration: Map<Bytes<32>, Uint<16>>;
export ledger admin: ZswapCoinPublicKey;
```

| Ledger | Type | Purpose |
|--------|------|---------|
| `loans` | Nested Map | User public key → Loan ID → Loan details |
| `blacklist` | Set | Blocked Zswap public keys |
| `onGoingPinMigration` | Map | Tracks progress of multi-batch PIN changes |
| `admin` | Cell | Current admin's public key |

---

## 7. Circuit Reference

### Public Circuits (Exported)

#### `requestLoan(amountRequested: Uint<16>, secretPin: Uint<16>): []`

The main entry point for loan applications.

**Flow:**
1. Derives user's public key from Zswap key + PIN
2. Validates user is not blacklisted
3. Validates no PIN migration is in progress
4. Validates amount > 0
5. Evaluates credit tier (privately)
6. Creates loan record with capped amount

**Errors:**
| Error Message | Cause |
|--------------|-------|
| `"Loan amount must be greater than zero"` | Requested amount is 0 |
| `"Requester is blacklisted"` | User's Zswap key is on blacklist |
| `"PIN migration is in progress for this user"` | Must complete `changePin` first |

---

#### `changePin(oldPin: Uint<16>, newPin: Uint<16>): []`

Migrates all loans from old PIN identity to new PIN identity.

**Flow:**
1. Validates user is not blacklisted
2. Validates new PIN differs from old PIN
3. Validates old PIN has associated loans
4. Migrates up to 5 loans per transaction
5. Tracks progress in `onGoingPinMigration`
6. Cleans up when migration completes

**Errors:**
| Error Message | Cause |
|--------------|-------|
| `"User is blacklisted"` | Blacklisted users cannot change PIN |
| `"New PIN must be different from old PIN"` | PINs must differ |
| `"Old PIN does not match any user"` | No loans exist for old PIN |

**Note:** For users with more than 5 loans, this circuit must be called multiple times until migration completes.

---

#### `blacklistUser(account: ZswapCoinPublicKey): []`

Adds a Zswap public key to the blacklist. **Admin only.**

**Error:** `"Only admin can blacklist users"`

---

#### `removeBlacklistUser(account: ZswapCoinPublicKey): []`

Removes a Zswap public key from the blacklist. **Admin only.**

**Error:** `"Only admin can remove from blacklist"`

---

#### `transferAdmin(newAdmin: ZswapCoinPublicKey): []`

Transfers admin role to a new address. **Admin only.**

**Error:** `"Only admin can transfer admin role"`

---

#### `publicKey(sk: Bytes<32>, pin: Uint<16>): Bytes<32>`

Pure circuit that derives a public key from a secret key and PIN.

```compact
export circuit publicKey(sk: Bytes<32>, pin: Uint<16>): Bytes<32> {
    const pinBytes = persistentHash<Uint<16>>(pin);
    return persistentHash<Vector<3, Bytes<32>>>(
           [pad(32, "zk-credit-scorer:pk"), pinBytes, sk]);
}
```

This deterministic derivation ensures:
- Same inputs always produce the same public key
- Different PINs produce completely different keys
- The PIN and secret key cannot be reverse-engineered from the public key

---

### Internal Circuits

#### `evaluateApplicant(): [Uint<16>, LoanStatus]`

The heart of the private computation. Fetches private data via witness and evaluates against tier criteria.

**Key Design Decisions:**
- Executes entirely off-chain
- No ledger interaction (pure computation)
- Returns only the non-sensitive outcome

---

#### `createLoan(...): []`

Handles all `loans` ledger interactions.

**Key Design Decisions:**
- Auto-increments loan IDs using `size() + 1`
- Initializes user's loan map if first loan
- Includes overflow protection (`totalLoans < 65535`)

---

## 8. Advanced Patterns

### Pattern 1: Batched Data Migration

One of the most important patterns demonstrated is **batched migration** in the `changePin` circuit. This pattern solves a fundamental challenge in ZK circuits: **you cannot iterate over collections of unknown size**.

#### The Challenge

```compact
// THIS IS NOT VALID IN COMPACT:
for (const loan of loans.lookup(oldPk)) {  // Size unknown at compile time!
    // migrate loan...
}
```

ZK circuits require fixed computation at compile time to generate valid proofs.

#### The Solution

```compact
// Process exactly 5 loans per transaction
for (const i of 0..5) {
    const sourceId = (lastMigratedSourceId + i + 1) as Uint<16>;
    if (loans.lookup(disclosedOldPk).member(sourceId)) {
        // Migrate this loan
        onGoingPinMigration.insert(disclosedOldPk, sourceId);
    } else {
        // No more loans - cleanup and exit
        onGoingPinMigration.remove(disclosedOldPk);
        loans.remove(disclosedOldPk);
    }
}
```

**Key Elements:**
1. **Fixed-size iteration**: `for (const i of 0..5)` has known bounds
2. **Progress tracking**: `onGoingPinMigration` stores last migrated ID
3. **Off-chain orchestration**: DApp calls circuit repeatedly until complete
4. **Graceful completion**: Detects end of migration and cleans up

This pattern is applicable whenever you need to process unbounded collections in Compact.

---

### Pattern 2: Private-to-Public Data Flow

The contract demonstrates careful management of the privacy boundary:

```compact
export circuit requestLoan(amountRequested: Uint<16>, secretPin: Uint<16>): [] {
    // 1. Private computation
    const [topTierAmount, status] = evaluateApplicant();  // Private!

    // 2. Explicit disclosure
    const disclosedTopTierAmount = disclose(topTierAmount);
    const disclosedStatus = disclose(status);

    // 3. Public state update
    createLoan(disclose(requesterPubKey), amountRequested,
               disclosedTopTierAmount, disclosedStatus);
}
```

The `disclose()` function is the explicit gate between private and public worlds. Every piece of data written to the ledger must pass through `disclose()`, making privacy decisions explicit and auditable in code.

---

### Pattern 3: Nested Map Structures

The `loans` ledger demonstrates complex relational data on-chain:

```compact
export ledger loans: Map<Bytes<32>, Map<Uint<16>, LoanApplication>>;
```

**Operations:**
```compact
// Check if user exists
loans.member(userPubKey)

// Initialize new user
loans.insert(userPubKey, default<Map<Uint<16>, LoanApplication>>)

// Get user's loan count
loans.lookup(userPubKey).size()

// Add a loan
loans.lookup(userPubKey).insert(loanId, loan)

// Access specific loan
loans.lookup(userPubKey).lookup(loanId)

// Remove a loan
loans.lookup(userPubKey).remove(loanId)

// Remove user entirely
loans.remove(userPubKey)
```

---

## 9. Security Considerations

### Input Validation

The contract implements multiple validation layers:

| Validation | Circuit | Purpose |
|------------|---------|---------|
| `amountRequested > 0` | `requestLoan` | Prevents zero-amount spam |
| `oldPin != newPin` | `changePin` | Prevents no-op migrations |
| `!blacklist.member(...)` | `requestLoan`, `changePin` | Enforces blacklist |
| `!onGoingPinMigration.member(...)` | `requestLoan` | Prevents state corruption during migration |
| `totalLoans < 65535` | `createLoan` | Overflow protection for `Uint<16>` |

### Admin Controls

- Admin role is set at deployment via `constructor()`
- Admin operations check `ownPublicKey() == admin`
- Admin can be transferred but never removed (always one admin)
- Blacklist operations are idempotent (safe to repeat)

### Privacy Guarantees

| Data | Visibility |
|------|------------|
| Credit score | Never leaves user's device |
| Monthly income | Never leaves user's device |
| Customer tenure | Never leaves user's device |
| Zswap public key | Visible when blacklisted, otherwise only derivations visible |
| Loan outcomes | Public (by design) |
| Loan amounts | Public (by design) |

---

## 10. Getting Started

### Prerequisites

- Node.js ≥ 22.0.0
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd zkloan-credit-scorer

# Install dependencies
npm install
```

### Build the Contract

```bash
cd contract

# Compile Compact to generate circuit artifacts
npm run compact

# Build TypeScript
npm run build
```

### Run Tests

```bash
npm run test
```

---

## 11. Testing

The project includes a comprehensive test suite with **37 tests** covering:

### Test Categories

| Category | Tests | Coverage |
|----------|-------|----------|
| **Loan Tiers** | 8 | All tier boundaries and edge cases |
| **Loan Management** | 4 | Multiple loans, incrementing IDs |
| **Blacklist** | 4 | Add, remove, edge cases |
| **PIN Migration** | 5 | Single batch, multi-batch, interruption |
| **Input Validation** | 3 | Zero amount, same PIN, blacklisted user |
| **Admin Authorization** | 3 | Non-admin rejection for all admin ops |
| **Admin Transfer** | 4 | Transfer, old admin rejection, chaining |
| **Public Key Derivation** | 3 | Determinism, PIN isolation, user isolation |
| **Multi-Identity** | 3 | Separate PINs, blacklist isolation |

### Running Specific Tests

```bash
# Run all tests
npm run test

# Run with verbose output
npm run test -- --reporter=verbose
```

### Test Architecture

The tests use a **simulator pattern** that executes circuits locally without blockchain deployment:

```typescript
const simulator = new ZKLoanCreditScorerSimulator();

// Set private state (simulates witness)
simulator.circuitContext.currentPrivateState = {
    creditScore: 750n,
    monthlyIncome: 2500n,
    monthsAsCustomer: 30n,
};

// Execute circuit
simulator.requestLoan(5000n, 1234n);

// Verify ledger state
const ledger = simulator.getLedger();
expect(ledger.loans.lookup(userPubKey).lookup(1n).status).toEqual(0); // Approved
```

---

## 12. Extending the Example

This example provides a foundation that can be extended in several directions:

### Ideas for Enhancement

| Extension | Description |
|-----------|-------------|
| **Verifiable Credentials** | Integrate with credential issuers so credit scores come from trusted sources with cryptographic attestations |
| **Loan Repayment Tracking** | Add circuits for recording payments and updating loan status |
| **Interest Calculation** | Implement on-chain or off-chain interest computation |
| **Multi-Signature Admin** | Require multiple admins to agree on blacklist operations |
| **Appeal Process** | Allow blacklisted users to submit appeals |
| **Loan NFTs** | Mint NFTs representing approved loans for secondary markets |
| **Credit Score Updates** | Allow users to refresh their credit evaluation with new data |

### Learning Resources

- [Midnight Documentation](https://docs.midnight.network/)
- [Compact Language Reference](https://docs.midnight.network/develop/tutorial/compact)
- [MidnightJS Library](https://docs.midnight.network/develop/tutorial/midnightjs)

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

---

*Built with Midnight - Where Privacy Meets Blockchain*
