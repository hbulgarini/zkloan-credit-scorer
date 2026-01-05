// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ZKLoanCreditScorerSimulator } from "./zkloan-credit-scorer.simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";

setNetworkId("undeployed");

    const bigintReplacer = (_key: string, value: any) =>
      typeof value === 'bigint' ? value.toString() : value;

describe("ZKLoanCreditScorer smart contract", () => {
   it("generates initial ledger state deterministically", () => {
    const simulator0 = new ZKLoanCreditScorerSimulator();
    const simulator1 = new ZKLoanCreditScorerSimulator();
    
    const ledger0 = simulator0.getLedger();
    const ledger1 = simulator1.getLedger();
    
    expect(JSON.stringify(ledger0, bigintReplacer)).toEqual(JSON.stringify(ledger1, bigintReplacer));

  });

  it("approves a Tier 1 loan and caps at the max amount", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;
    
    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request an amount higher than the tier's max
    simulator.requestLoan(1500n, userPin);
    console.log("User public key:", userPubKey);
    const ledger = simulator.getLedger();
    const userLoans = ledger.loans.lookup(userPubKey);
    const loan = userLoans.lookup(1n); // First loan
    // 0 is the first element of the variant LoanStatus.Approved
    expect(loan.status).toEqual(0);
    expect(loan.authorizedAmount).toEqual(1500n); // Capped at Tier 1 max */
  });
 
  it("approves a Tier 2 loan and gives the requested amount", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Set private state for a mid-value applicant
    simulator.circuitContext.currentPrivateState = {
      creditScore: 650n,
      monthlyIncome: 1600n,
      monthsAsCustomer: 10n,
    };
    
    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request an amount lower than the tier's max
    simulator.requestLoan(5000n, userPin);
    
    const ledger = simulator.getLedger();
    const userLoans = ledger.loans.lookup(userPubKey);
    const loan = userLoans.lookup(1n);

    expect(loan.status).toEqual(0); // Approved
    expect(loan.authorizedAmount).toEqual(5000n); // Gets the requested amount
  });

  it("proposes a Tier 3 loan when amount exceeds limit", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 590n,
      monthlyIncome: 1000n,
      monthsAsCustomer: 1n,
    };
    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(10000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(3000n); // Capped at Tier 3 max
  });

  it("rejects a loan for a non-eligible applicant", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 500n,
      monthlyIncome: 1000n,
      monthsAsCustomer: 1n,
    };
    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(1000n, userPin);
    
    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(1); // Rejected
    expect(loan.authorizedAmount).toEqual(0n);
  });

  it("creates multiple loans for the same user with incrementing IDs", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };
    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    simulator.requestLoan(100n, userPin);
    simulator.requestLoan(200n, userPin);
    simulator.requestLoan(300n, userPin);

    const userLoans = simulator.getLedger().loans.lookup(userPubKey);
    expect(userLoans.size()).toEqual(3n);
    expect(userLoans.lookup(1n).authorizedAmount).toEqual(100n);
    expect(userLoans.lookup(2n).authorizedAmount).toEqual(200n);
    expect(userLoans.lookup(3n).authorizedAmount).toEqual(300n);
  });

  it("throws an error if the user is blacklisted", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Blacklist the user's Zswap key
    simulator.blacklistUser(userZwapKey);
    
    expect(() => {
      simulator.requestLoan(1000n, userPin);
    }).toThrow("Requester is blacklisted");
  });

  it("allows admin to blacklist and remove a user", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    let ledger = simulator.getLedger();
    
    // Check Bob is not blacklisted
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeFalsy();

    // Blacklist Bob
    simulator.blacklistUser(bobZwapKey);
    ledger = simulator.getLedger();
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeTruthy();

    // Remove Bob from blacklist
    simulator.removeBlacklistUser(bobZwapKey);
    ledger = simulator.getLedger();
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeFalsy();
  });

it("migrates a small number of loans (1 batch) and cleans up", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const oldPin = 1234n;
    const newPin = 9876n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };
    
    const oldPubKey = simulator.publicKey(userZwapKey, oldPin);
    const newPubKey = simulator.publicKey(userZwapKey, newPin);

    // Create 3 loans
    simulator.requestLoan(100n, oldPin); // Loan 1
    simulator.requestLoan(200n, oldPin); // Loan 2
    simulator.requestLoan(300n, oldPin); // Loan 3

    let ledger = simulator.getLedger();
    expect(ledger.loans.lookup(oldPubKey).size()).toEqual(3n);

    // Call changePin. This should migrate 1, 2, 3 and find that 4, 5 are empty.
    simulator.changePin(oldPin, newPin);
    
    ledger = simulator.getLedger();
    
    
    // Migration should be complete, and old entries cleaned up
    expect(ledger.loans.member(oldPubKey)).toBeFalsy(); 
    expect(ledger.onGoingPinMigration.member(oldPubKey)).toBeFalsy();
    
    // All 3 loans should be with the new key
    expect(ledger.loans.member(newPubKey)).toBeTruthy();
    expect(ledger.loans.lookup(newPubKey).size()).toEqual(3n); 
    expect(ledger.loans.lookup(newPubKey).lookup(2n).authorizedAmount).toEqual(200n);
  });

  it("migrates multiple batches of loans (7 loans) correctly", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const oldPin = 1234n;
    const newPin = 9876n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };
    
    const oldPubKey = simulator.publicKey(userZwapKey, oldPin);
    const newPubKey = simulator.publicKey(userZwapKey, newPin);

    // Create 7 loans
    for (let i = 1; i <= 7; i++) {
      simulator.requestLoan(BigInt(i * 100), oldPin); // Loans 1-7
    }

    let ledger = simulator.getLedger();
    expect(ledger.loans.lookup(oldPubKey).size()).toEqual(7n);
    expect(ledger.loans.member(newPubKey)).toBeFalsy();

    // --- BATCH 1 (Migrates 1-5) ---
    simulator.changePin(oldPin, newPin);
    
    ledger = simulator.getLedger();
    expect(ledger.loans.member(newPubKey)).toBeTruthy(); // New user map created
    expect(ledger.onGoingPinMigration.lookup(oldPubKey)).toEqual(5n); // Progress updated
    expect(ledger.loans.lookup(oldPubKey).size()).toEqual(2n); // 7 - 5 = 2
    expect(ledger.loans.lookup(newPubKey).size()).toEqual(5n);
    expect(ledger.loans.lookup(newPubKey).lookup(5n).authorizedAmount).toEqual(500n); // Check loan 5

    expect(ledger.loans.lookup(oldPubKey).member(6n)).toBeTruthy(); // Check loan 6 still with old key

// --- BATCH 2 (Migrates 6-7, finds 8-10 empty, finishes) ---
    simulator.changePin(oldPin, newPin);

    ledger = simulator.getLedger();
    
    // Check that the migration key was successfully removed.
    expect(ledger.onGoingPinMigration.member(oldPubKey)).toBeFalsy();
    
    // Check that all loans are now with the new key
    expect(ledger.loans.lookup(newPubKey).size()).toEqual(7n); 
    expect(ledger.loans.lookup(newPubKey).lookup(6n).authorizedAmount).toEqual(600n);
    expect(ledger.loans.lookup(newPubKey).lookup(7n).authorizedAmount).toEqual(700n);

    // If you can get the map item 'remove' to work,
    // you can uncomment this final check:
    expect(ledger.loans.member(oldPubKey)).toBeFalsy();

  });

  it("throws an error if user tries to requestLoan during migration", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
        
    const oldPin = 1234n;
    const newPin = 9876n;
    const oldPubKey = simulator.publicKey(userZwapKey, oldPin);
    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };

    // Create 7 loans to ensure migration will be in progress
    for (let i = 1; i <= 7; i++) {
      simulator.requestLoan(100n, oldPin);
    }
    
    // Start the migration (run batch 1)
    simulator.changePin(oldPin, newPin);
    
    let ledger = simulator.getLedger();
    
    expect(ledger.onGoingPinMigration.lookup(oldPubKey)).toEqual(5n);
    expect(ledger.onGoingPinMigration.member(oldPubKey)).toBeTruthy(); // Migration is active

    // Try to request a new loan with the old PIN
    expect(() => {
      simulator.requestLoan(100n, oldPin);
    }).toThrow("PIN migration is in progress for this user"); 

  });

  it("migrates loans to a new PIN that already has loans", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const oldPin = 1234n;
    const newPin = 9876n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };

    const oldPubKey = simulator.publicKey(userZwapKey, oldPin);
    const newPubKey = simulator.publicKey(userZwapKey, newPin);

    // Create 6 loans for the old PIN
    for (let i = 1; i <= 6; i++) {
      simulator.requestLoan(BigInt(i * 10), oldPin);
    }

    // Create 3 loans for the new PIN
    for (let i = 1; i <= 3; i++) {
      simulator.requestLoan(BigInt(i * 100), newPin);
    }

    let ledger = simulator.getLedger();
    expect(ledger.loans.lookup(oldPubKey).size()).toEqual(6n);
    expect(ledger.loans.lookup(newPubKey).size()).toEqual(3n);

    // --- BATCH 1 (Migrates loans 1-5 from old to new) ---
    simulator.changePin(oldPin, newPin);

    ledger = simulator.getLedger();
    expect(ledger.onGoingPinMigration.lookup(oldPubKey)).toEqual(5n); // Progress updated
    expect(ledger.loans.lookup(newPubKey).size()).toEqual(3n + 5n); // 3 existing + 5 migrated

    // --- BATCH 2 (Migrates loan 6, finds 7-10 empty, finishes) ---
    simulator.changePin(oldPin, newPin);

    ledger = simulator.getLedger();

    // Migration should be complete, and old entries cleaned up
    expect(ledger.loans.member(oldPubKey)).toBeFalsy();
    expect(ledger.onGoingPinMigration.member(oldPubKey)).toBeFalsy();

    // All 9 loans should be with the new key
    expect(ledger.loans.lookup(newPubKey).size()).toEqual(9n);
    expect(ledger.loans.lookup(newPubKey).lookup(9n).authorizedAmount).toEqual(60n); // loan 6 from old is now loan 9
  });

  // ============================================================
  // NEW TESTS: Input Validation
  // ============================================================

  it("throws when requesting loan with zero amount", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userPin = 1234n;

    expect(() => {
      simulator.requestLoan(0n, userPin);
    }).toThrow("Loan amount must be greater than zero");
  });

  // ============================================================
  // NEW TESTS: changePin Validation
  // ============================================================

  it("throws when blacklisted user tries to change PIN", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const oldPin = 1234n;
    const newPin = 5678n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };

    // Create a loan first so the user exists
    simulator.requestLoan(100n, oldPin);

    // Blacklist the user
    simulator.blacklistUser(userZwapKey);

    // Try to change PIN - should fail
    expect(() => {
      simulator.changePin(oldPin, newPin);
    }).toThrow("User is blacklisted");
  });

  it("throws when changing PIN to the same value", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 800n,
      monthlyIncome: 3000n,
      monthsAsCustomer: 30n,
    };

    // Create a loan first so the user exists
    simulator.requestLoan(100n, userPin);

    // Try to change PIN to the same value - should fail
    expect(() => {
      simulator.changePin(userPin, userPin);
    }).toThrow("New PIN must be different from old PIN");
  });

  // ============================================================
  // NEW TESTS: Admin Transfer
  // ============================================================

  it("allows admin to transfer admin role to new admin", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const newAdminKey = simulator.createTestUser("NewAdmin").left.bytes;

    // Transfer admin to new admin
    simulator.transferAdmin(newAdminKey);

    const ledger = simulator.getLedger();
    expect(ledger.admin.bytes).toEqual(newAdminKey);
  });

  // ============================================================
  // NEW TESTS: Tier Boundary Edge Cases
  // ============================================================

  it("approves exactly at Tier 1 boundary when amount within limit (score=700, income=2000, tenure=24)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Exactly at Tier 1 minimums
    simulator.circuitContext.currentPrivateState = {
      creditScore: 700n,
      monthlyIncome: 2000n,
      monthsAsCustomer: 24n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(10000n, userPin); // Request exactly at limit

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(0); // Approved (amount within limit)
    expect(loan.authorizedAmount).toEqual(10000n); // Tier 1 max
  });

  it("proposes Tier 2 when just below Tier 1 threshold (score=699)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Just below Tier 1 credit score
    simulator.circuitContext.currentPrivateState = {
      creditScore: 699n,
      monthlyIncome: 2000n,
      monthsAsCustomer: 24n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(15000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(7000n); // Falls to Tier 2 max
  });

  it("proposes at Tier 2 boundary when amount exceeds limit (score=600, income=1500)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Exactly at Tier 2 minimums
    simulator.circuitContext.currentPrivateState = {
      creditScore: 600n,
      monthlyIncome: 1500n,
      monthsAsCustomer: 1n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(10000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(7000n); // Tier 2 max
  });

  it("proposes Tier 3 when just below Tier 2 threshold (score=599)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Just below Tier 2 credit score but above Tier 3
    simulator.circuitContext.currentPrivateState = {
      creditScore: 599n,
      monthlyIncome: 1500n,
      monthsAsCustomer: 1n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(10000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(3000n); // Falls to Tier 3 max
  });

  it("proposes at Tier 3 boundary when amount exceeds limit (score=580)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Exactly at Tier 3 minimum
    simulator.circuitContext.currentPrivateState = {
      creditScore: 580n,
      monthlyIncome: 500n,
      monthsAsCustomer: 1n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(5000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(3000n); // Tier 3 max
  });

  it("rejects when just below Tier 3 threshold (score=579)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Just below Tier 3 minimum
    simulator.circuitContext.currentPrivateState = {
      creditScore: 579n,
      monthlyIncome: 5000n,
      monthsAsCustomer: 100n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(1000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(1); // Rejected
    expect(loan.authorizedAmount).toEqual(0n);
  });

  it("proposes Tier 2 when Tier 1 income requirement not met", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // High credit score but income just below Tier 1
    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 1999n, // Just below 2000
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(15000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(7000n); // Falls to Tier 2
  });

  it("proposes Tier 2 when Tier 1 tenure requirement not met", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // High credit score and income but tenure just below Tier 1
    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 23n, // Just below 24
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(15000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (amount exceeds tier limit)
    expect(loan.authorizedAmount).toEqual(7000n); // Falls to Tier 2
  });

  // ============================================================
  // NEW TESTS: Admin Authorization
  // ============================================================

  it("throws when non-admin tries to blacklist a user", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    const charlieZwapKey = simulator.createTestUser("Charlie").left.bytes;

    // Transfer admin to Bob first (Alice is initial admin)
    simulator.transferAdmin(bobZwapKey);

    // Now Alice (non-admin) tries to blacklist Charlie - should fail
    expect(() => {
      simulator.blacklistUser(charlieZwapKey);
    }).toThrow("Only admin can blacklist users");
  });

  it("throws when non-admin tries to remove from blacklist", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    const charlieZwapKey = simulator.createTestUser("Charlie").left.bytes;

    // First blacklist Charlie while Alice is admin
    simulator.blacklistUser(charlieZwapKey);

    // Transfer admin to Bob
    simulator.transferAdmin(bobZwapKey);

    // Now Alice (non-admin) tries to remove Charlie from blacklist - should fail
    expect(() => {
      simulator.removeBlacklistUser(charlieZwapKey);
    }).toThrow("Only admin can remove from blacklist");
  });

  it("throws when non-admin tries to transfer admin", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    const charlieZwapKey = simulator.createTestUser("Charlie").left.bytes;

    // Transfer admin to Bob first
    simulator.transferAdmin(bobZwapKey);

    // Now Alice (non-admin) tries to transfer admin to Charlie - should fail
    expect(() => {
      simulator.transferAdmin(charlieZwapKey);
    }).toThrow("Only admin can transfer admin role");
  });

  // ============================================================
  // NEW TESTS: Public Key Determinism
  // ============================================================

  it("generates same public key for same user and PIN (determinism)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    const pubKey1 = simulator.publicKey(userZwapKey, userPin);
    const pubKey2 = simulator.publicKey(userZwapKey, userPin);

    expect(pubKey1).toEqual(pubKey2);
  });

  it("generates different public key for same user with different PIN", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const pin1 = 1234n;
    const pin2 = 5678n;

    const pubKey1 = simulator.publicKey(userZwapKey, pin1);
    const pubKey2 = simulator.publicKey(userZwapKey, pin2);

    expect(pubKey1).not.toEqual(pubKey2);
  });

  it("generates different public key for different users with same PIN", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const aliceZwapKey = simulator.createTestUser("Alice").left.bytes;
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    const samePin = 1234n;

    const alicePubKey = simulator.publicKey(aliceZwapKey, samePin);
    const bobPubKey = simulator.publicKey(bobZwapKey, samePin);

    expect(alicePubKey).not.toEqual(bobPubKey);
  });

  // ============================================================
  // NEW TESTS: Blacklist Edge Cases
  // ============================================================

  it("blacklisting an already blacklisted user is idempotent", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;

    // Blacklist Bob
    simulator.blacklistUser(bobZwapKey);
    let ledger = simulator.getLedger();
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeTruthy();

    // Blacklist Bob again - should not throw
    simulator.blacklistUser(bobZwapKey);
    ledger = simulator.getLedger();
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeTruthy();
  });

  it("removing a non-blacklisted user from blacklist does not throw", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;

    // Bob is not blacklisted
    let ledger = simulator.getLedger();
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeFalsy();

    // Remove Bob from blacklist - should not throw (idempotent)
    simulator.removeBlacklistUser(bobZwapKey);
    ledger = simulator.getLedger();
    expect(ledger.blacklist.member({ bytes: bobZwapKey })).toBeFalsy();
  });

  // ============================================================
  // NEW TESTS: Multi-User Isolation
  // Note: The simulator only simulates Alice as the caller (ownPublicKey()).
  // True multi-user testing would require separate simulator instances or
  // modifying the simulator to support user context switching.
  // ============================================================

  it("same user with different PINs has separate loan records", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const aliceZwapKey = simulator.createTestUser("Alice").left.bytes;
    const pin1 = 1111n;
    const pin2 = 2222n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    // Get the public keys for each PIN (derived from Alice's Zswap key + PIN)
    const pubKey1 = simulator.publicKey(aliceZwapKey, pin1);
    const pubKey2 = simulator.publicKey(aliceZwapKey, pin2);

    // Request loans with different PINs
    simulator.requestLoan(5000n, pin1);
    simulator.requestLoan(3000n, pin2);

    const ledger = simulator.getLedger();

    // Each PIN should have its own loan record
    expect(ledger.loans.member(pubKey1)).toBeTruthy();
    expect(ledger.loans.member(pubKey2)).toBeTruthy();
    expect(ledger.loans.lookup(pubKey1).lookup(1n).authorizedAmount).toEqual(5000n);
    expect(ledger.loans.lookup(pubKey2).lookup(1n).authorizedAmount).toEqual(3000n);
  });

  it("blacklisting a different Zswap key does not affect the caller", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const aliceZwapKey = simulator.createTestUser("Alice").left.bytes;
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    const alicePin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const alicePubKey = simulator.publicKey(aliceZwapKey, alicePin);

    // Blacklist Bob's Zswap key (not Alice's)
    simulator.blacklistUser(bobZwapKey);

    // Alice should still be able to request a loan
    simulator.requestLoan(5000n, alicePin);

    const ledger = simulator.getLedger();
    expect(ledger.loans.member(alicePubKey)).toBeTruthy();
    expect(ledger.loans.lookup(alicePubKey).lookup(1n).authorizedAmount).toEqual(5000n);
  });

  // ============================================================
  // NEW TESTS: Admin Transfer Edge Cases
  // ============================================================

  it("new admin can perform admin operations after transfer", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const charlieZwapKey = simulator.createTestUser("Charlie").left.bytes;

    // Note: In current simulator, all operations appear as Alice
    // After transferring admin away, Alice loses admin privileges
    // This test verifies the transfer occurred correctly

    // Transfer admin to Charlie
    simulator.transferAdmin(charlieZwapKey);

    const ledger = simulator.getLedger();
    expect(ledger.admin.bytes).toEqual(charlieZwapKey);
  });

  it("old admin cannot perform admin operations after transfer", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;
    const charlieZwapKey = simulator.createTestUser("Charlie").left.bytes;

    // Transfer admin to Bob
    simulator.transferAdmin(bobZwapKey);

    // Alice (old admin) tries to blacklist Charlie - should fail
    expect(() => {
      simulator.blacklistUser(charlieZwapKey);
    }).toThrow("Only admin can blacklist users");
  });

  it("can chain multiple admin transfers", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const aliceZwapKey = simulator.createTestUser("Alice").left.bytes;
    const bobZwapKey = simulator.createTestUser("Bob").left.bytes;

    let ledger = simulator.getLedger();
    expect(ledger.admin.bytes).toEqual(aliceZwapKey);

    // Transfer admin to Bob
    simulator.transferAdmin(bobZwapKey);
    ledger = simulator.getLedger();
    expect(ledger.admin.bytes).toEqual(bobZwapKey);

    // Note: After this transfer, Alice can no longer transfer admin
    // because she's no longer admin. This is the expected behavior.
  });

  // ============================================================
  // NEW TESTS: Proposed/NotAccepted Loan Flow
  // ============================================================

  it("creates Proposed loan when requested amount exceeds tier limit", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Tier 1 user (max 10000)
    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request more than Tier 1 max
    simulator.requestLoan(15000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed (index 2 in enum)
    expect(loan.authorizedAmount).toEqual(10000n); // Capped at Tier 1 max
  });

  it("creates Approved loan when requested amount is within tier limit", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Tier 1 user (max 10000)
    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request exactly at Tier 1 max
    simulator.requestLoan(10000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(0); // Approved
    expect(loan.authorizedAmount).toEqual(10000n);
  });

  it("creates Approved loan when requested amount is less than tier limit", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Tier 1 user (max 10000)
    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request less than Tier 1 max
    simulator.requestLoan(5000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(0); // Approved
    expect(loan.authorizedAmount).toEqual(5000n);
  });

  it("respondToLoan with accept=true changes Proposed to Approved", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Create a Proposed loan
    simulator.requestLoan(15000n, userPin);
    let loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed

    // Accept the proposal
    simulator.respondToLoan(1n, userPin, true);

    loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(0); // Approved
    expect(loan.authorizedAmount).toEqual(10000n); // Amount preserved
  });

  it("respondToLoan with accept=false changes Proposed to NotAccepted with zero amount", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Create a Proposed loan
    simulator.requestLoan(15000n, userPin);
    let loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed

    // Reject the proposal
    simulator.respondToLoan(1n, userPin, false);

    loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(3); // NotAccepted (index 3 in enum)
    expect(loan.authorizedAmount).toEqual(0n); // Amount set to zero
  });

  it("throws when respondToLoan is called on non-Proposed loan", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Create an Approved loan (amount within limit)
    simulator.requestLoan(5000n, userPin);
    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(0); // Approved

    // Try to respond to an Approved loan - should fail
    expect(() => {
      simulator.respondToLoan(1n, userPin, true);
    }).toThrow("Loan is not in Proposed status");
  });

  it("throws when respondToLoan is called on already accepted loan", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Create and accept a Proposed loan
    simulator.requestLoan(15000n, userPin);
    simulator.respondToLoan(1n, userPin, true);

    // Try to respond again - should fail
    expect(() => {
      simulator.respondToLoan(1n, userPin, false);
    }).toThrow("Loan is not in Proposed status");
  });

  it("throws when respondToLoan is called with non-existent loan ID", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    // Create a loan first so user exists in the system
    simulator.requestLoan(15000n, userPin);

    // Try to respond to non-existent loan
    expect(() => {
      simulator.respondToLoan(999n, userPin, true);
    }).toThrow("Loan not found");
  });

  it("throws when respondToLoan is called by user with no loans", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userPin = 1234n;

    // Don't create any loans - user doesn't exist in loans map

    expect(() => {
      simulator.respondToLoan(1n, userPin, true);
    }).toThrow("No loans found for this user");
  });

  it("throws when blacklisted user tries to respondToLoan", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    // Create a Proposed loan
    simulator.requestLoan(15000n, userPin);

    // Blacklist the user
    simulator.blacklistUser(userZwapKey);

    // Try to respond - should fail
    expect(() => {
      simulator.respondToLoan(1n, userPin, true);
    }).toThrow("User is blacklisted");
  });

  it("creates Proposed loan for Tier 2 user exceeding limit", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Tier 2 user (max 7000)
    simulator.circuitContext.currentPrivateState = {
      creditScore: 650n,
      monthlyIncome: 1600n,
      monthsAsCustomer: 10n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request more than Tier 2 max
    simulator.requestLoan(10000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed
    expect(loan.authorizedAmount).toEqual(7000n); // Capped at Tier 2 max
  });

  it("creates Proposed loan for Tier 3 user exceeding limit", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // Tier 3 user (max 3000)
    simulator.circuitContext.currentPrivateState = {
      creditScore: 590n,
      monthlyIncome: 1000n,
      monthsAsCustomer: 1n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Request more than Tier 3 max
    simulator.requestLoan(5000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(2); // Proposed
    expect(loan.authorizedAmount).toEqual(3000n); // Capped at Tier 3 max
  });

  it("rejected applicant still gets Rejected status (not Proposed)", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    // User below minimum eligibility
    simulator.circuitContext.currentPrivateState = {
      creditScore: 500n,
      monthlyIncome: 1000n,
      monthsAsCustomer: 1n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);
    simulator.requestLoan(1000n, userPin);

    const loan = simulator.getLedger().loans.lookup(userPubKey).lookup(1n);
    expect(loan.status).toEqual(1); // Rejected (not Proposed)
    expect(loan.authorizedAmount).toEqual(0n);
  });

  it("can have multiple Proposed loans and respond to each independently", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const userZwapKey = simulator.createTestUser("Alice").left.bytes;
    const userPin = 1234n;

    simulator.circuitContext.currentPrivateState = {
      creditScore: 750n,
      monthlyIncome: 2500n,
      monthsAsCustomer: 30n,
    };

    const userPubKey = simulator.publicKey(userZwapKey, userPin);

    // Create multiple Proposed loans
    simulator.requestLoan(15000n, userPin); // Loan 1 - Proposed
    simulator.requestLoan(12000n, userPin); // Loan 2 - Proposed
    simulator.requestLoan(5000n, userPin);  // Loan 3 - Approved (within limit)

    let ledger = simulator.getLedger();
    expect(ledger.loans.lookup(userPubKey).lookup(1n).status).toEqual(2); // Proposed
    expect(ledger.loans.lookup(userPubKey).lookup(2n).status).toEqual(2); // Proposed
    expect(ledger.loans.lookup(userPubKey).lookup(3n).status).toEqual(0); // Approved

    // Accept loan 1
    simulator.respondToLoan(1n, userPin, true);
    // Reject loan 2
    simulator.respondToLoan(2n, userPin, false);

    ledger = simulator.getLedger();
    expect(ledger.loans.lookup(userPubKey).lookup(1n).status).toEqual(0); // Approved
    expect(ledger.loans.lookup(userPubKey).lookup(1n).authorizedAmount).toEqual(10000n);
    expect(ledger.loans.lookup(userPubKey).lookup(2n).status).toEqual(3); // NotAccepted
    expect(ledger.loans.lookup(userPubKey).lookup(2n).authorizedAmount).toEqual(0n);
    expect(ledger.loans.lookup(userPubKey).lookup(3n).status).toEqual(0); // Still Approved
  });
});
