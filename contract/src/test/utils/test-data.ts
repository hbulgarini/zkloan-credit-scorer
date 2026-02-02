// This file is part of the ZKLoan Credit Scorer example.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0

import { type ZKLoanCreditScorerPrivateState } from '../../witnesses.js';

export const userProfiles = [
  {
    "applicantId": "user-001",
    "creditScore": 720,
    "monthlyIncome": 2500,
    "monthsAsCustomer": 24
  },
  {
    "applicantId": "user-002",
    "creditScore": 650,
    "monthlyIncome": 1800,
    "monthsAsCustomer": 11
  },
  {
    "applicantId": "user-003",
    "creditScore": 580,
    "monthlyIncome": 2200,
    "monthsAsCustomer": 36
  },
  {
    "applicantId": "user-004",
    "creditScore": 710,
    "monthlyIncome": 1900,
    "monthsAsCustomer": 5
  },
  {
    "applicantId": "user-005",
    "creditScore": 520,
    "monthlyIncome": 3000,
    "monthsAsCustomer": 48
  },
  {
    "applicantId": "user-006",
    "creditScore": 810,
    "monthlyIncome": 4500,
    "monthsAsCustomer": 60
  },
  {
    "applicantId": "user-007",
    "creditScore": 639,
    "monthlyIncome": 2100,
    "monthsAsCustomer": 18
  },
  {
    "applicantId": "user-008",
    "creditScore": 680,
    "monthlyIncome": 1450,
    "monthsAsCustomer": 30
  },
  {
    "applicantId": "user-009",
    "creditScore": 750,
    "monthlyIncome": 2100,
    "monthsAsCustomer": 23
  },
  {
    "applicantId": "user-010",
    "creditScore": 579,
    "monthlyIncome": 1900,
    "monthsAsCustomer": 12
  }
];

export function getUserProfile(index?: number): ZKLoanCreditScorerPrivateState {
  let profile;
  if (index !== undefined) {
    if (index < 0 || index >= userProfiles.length) {
      throw new Error(`Index ${index} is out of bounds. Must be between 0 and ${userProfiles.length - 1}.`);
    }
    profile = userProfiles[index];
  } else {
    const randomIndex = Math.floor(Math.random() * userProfiles.length);
    profile = userProfiles[randomIndex];
  }
  return {
    creditScore: BigInt(profile.creditScore),
    monthlyIncome: BigInt(profile.monthlyIncome),
    monthsAsCustomer: BigInt(profile.monthsAsCustomer),
  };
}
