import { Ledger } from "./managed/zkloan-credit-scorer/contract/index.cjs";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";
export type ZKLoanCreditScorerPrivateState = {
    applicantId: string;
    creditScore: number;
    monthlyIncome: number;
    monthsAsCustomer: number;
};
export declare const witnesses: {
    getRequesterScoringWitness: ({ privateState }: WitnessContext<Ledger, ZKLoanCreditScorerPrivateState>) => ZKLoanCreditScorerPrivateState;
};
