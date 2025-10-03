import { Ledger } from "./managed/zkloan-credit-scorer/contract/index.cjs";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";
export type ZKLoanCreditScorerPrivateState = {
    creditScore: bigint;
    monthlyIncome: bigint;
    monthsAsCustomer: bigint;
};
export declare const witnesses: {
    getRequesterScoringWitness: ({ privateState }: WitnessContext<Ledger, ZKLoanCreditScorerPrivateState>) => [ZKLoanCreditScorerPrivateState, ZKLoanCreditScorerPrivateState];
};
