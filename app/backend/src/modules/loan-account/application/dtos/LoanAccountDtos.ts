export interface CreateLoanAccountInput {
  loanCode: string;
  borrowerId: string;
  loanProductVersionId: string;
  branchId: string;
  loanOfficerId?: string;
  principalAmount: string;
  interestRate: string;
  addOnInterestRate?: string;
  contractualInterestRate?: string;
  installmentCount: number;
  gracePeriodDays?: number;
  /** ADR-045 (Concept 1 — Exact First Repayment Date): explicit input, never derived. */
  firstRepaymentDate: Date;
  legacyId?: string;
}
