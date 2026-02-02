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

import {
  type CircuitContext,
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger
} from "../managed/zkloan-credit-scorer/contract/index.js";
import { type ZKLoanCreditScorerPrivateState, witnesses } from "../witnesses.js";
import { createEitherTestUser } from "./utils/address.js";
import { getUserProfile } from "./utils/test-data.js";


// This is over-kill for such a simple contract, but the same pattern can be used to test more
// complex contracts.
export class ZKLoanCreditScorerSimulator {
  readonly contract: Contract<ZKLoanCreditScorerPrivateState>;
  circuitContext: CircuitContext<ZKLoanCreditScorerPrivateState>;

  constructor() {
    const user = createEitherTestUser("Alice");
    this.contract = new Contract<ZKLoanCreditScorerPrivateState>(witnesses);
    const initialPrivateState: ZKLoanCreditScorerPrivateState = getUserProfile(0);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext(initialPrivateState, user.left.hex)
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): ZKLoanCreditScorerPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public requestLoan(amountRequested: bigint, secretPin: bigint): Ledger {
    // Update the current context to be the result of executing the circuit.
    this.circuitContext = this.contract.impureCircuits.requestLoan(
      this.circuitContext,
      amountRequested,
      secretPin
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public blacklistUser(account: Uint8Array): Ledger {
    // Update the current context to be the result of executing the circuit.
    this.circuitContext = this.contract.impureCircuits.blacklistUser(
      this.circuitContext,
      { bytes: account }
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public removeBlacklistUser(account: Uint8Array): Ledger {
    // Update the current context to be the result of executing the circuit.
    this.circuitContext = this.contract.impureCircuits.removeBlacklistUser(
      this.circuitContext,
      { bytes: account }
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public changePin(oldPin: bigint, newPin: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.changePin(
      this.circuitContext,
      oldPin,
      newPin
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public respondToLoan(loanId: bigint, secretPin: bigint, accept: boolean): Ledger {
    this.circuitContext = this.contract.impureCircuits.respondToLoan(
      this.circuitContext,
      loanId,
      secretPin,
      accept
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public transferAdmin(newAdmin: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.transferAdmin(
      this.circuitContext,
      { bytes: newAdmin }
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public publicKey(sk: Uint8Array, pin: bigint): Uint8Array {
    return this.contract.circuits.publicKey(
      this.circuitContext,
      sk,
      pin
    ).result;
  }


  public createTestUser(str: string): any {
    return createEitherTestUser(str);
  }
}
