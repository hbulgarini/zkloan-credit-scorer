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
import {
  NetworkId,
  setNetworkId
} from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";

setNetworkId(NetworkId.Undeployed);

describe("ZKLoanCreditScorer smart contract", () => {
/*   it("generates initial ledger state deterministically", () => {
    const simulator0 = new ZKLoanCreditScorerSimulator();
    const simulator1 = new ZKLoanCreditScorerSimulator();
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  }); */

   it("properly adds a new item in the simpleMap", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const newLedgerState = simulator.addFieldItem(0n, 1n);
    const initialLedgerState = simulator.getLedger();
  //  console.log("Next Ledger State:", newLedgerState);
    const item = newLedgerState.simpleMap.lookup(0n);
    expect(item).toEqual(1n);
    expect(initialLedgerState.simpleMap.size()).toEqual(1n);
    //const initialPrivateState = simulator.getPrivateState();
   // expect(initialPrivateState).toEqual({ privateZKLoanCreditScorer: 0 });
  });

  /*
  it("properly adds a new item in the simpleMap", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const newLedgerState = simulator.addAccountFieldItem(1n);
    console.log("Next Ledger State:", newLedgerState);
    const item = newLedgerState.simpleMap.lookup(0n);
    expect(item).toEqual(1n);
   // expect(initialLedgerState.simpleMap.size()).toEqual(1n);
    //const initialPrivateState = simulator.getPrivateState();
   // expect(initialPrivateState).toEqual({ privateZKLoanCreditScorer: 0 });
  });
  */

  it("properly insert value in nested maps", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const prevState = simulator.getLedger();
    const shouldNotExist = prevState.simpleNestedMap.member(1n);
    expect(shouldNotExist).toBeFalsy();
    let newLedgerState = simulator.insertNestedFieldItem(1n,1n, 1n);
    const item = newLedgerState.simpleNestedMap.lookup(1n).lookup(1n);
    expect(item).toEqual(1n);
    newLedgerState = simulator.insertNestedFieldItem(1n,1n, 2n);
    const item2 = newLedgerState.simpleNestedMap.lookup(1n).lookup(1n);
    expect(item2).toEqual(2n);
  });
  

  it("properly initializes ledger state and private state", () => {
    const simulator = new ZKLoanCreditScorerSimulator();
    const initialLedgerState = simulator.getLedger();
    //console.log("Initial Ledger State:", initialLedgerState);
    expect(initialLedgerState.simpleMap.size()).toEqual(0n);
    const initialPrivateState = simulator.getPrivateState();
    expect(initialPrivateState).toEqual({ privateZKLoanCreditScorer: 0 });
  });
});
