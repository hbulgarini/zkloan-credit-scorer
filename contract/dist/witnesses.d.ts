import { Ledger, SchnorrSignature } from "./managed/zkloan-credit-scorer/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";
export type ZKLoanCreditScorerPrivateState = {
    creditScore: bigint;
    monthlyIncome: bigint;
    monthsAsCustomer: bigint;
    attestationSignature: SchnorrSignature;
    attestationProviderId: bigint;
};
export declare const witnesses: {
    getAttestedScoringWitness: ({ privateState }: WitnessContext<Ledger, ZKLoanCreditScorerPrivateState>) => [ZKLoanCreditScorerPrivateState, [{
        creditScore: bigint;
        monthlyIncome: bigint;
        monthsAsCustomer: bigint;
    }, SchnorrSignature, bigint]];
    getSchnorrReduction: ({ privateState }: WitnessContext<Ledger, ZKLoanCreditScorerPrivateState>, challengeHash: bigint) => [ZKLoanCreditScorerPrivateState, [bigint, bigint]];
};
