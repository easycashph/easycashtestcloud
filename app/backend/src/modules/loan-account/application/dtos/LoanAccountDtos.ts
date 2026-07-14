export interface CreateLoanAccountInput {
  /** 2026-07-11: optional — omit to auto-generate `{product.code}_{NNNNN}` (see CreateLoanAccountUseCase). */
  loanCode?: string;
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
  /** 2026-07-14: staff-entered estimate, reused as the Promissory Note's `{AnticipatedDisbursementDate}`. */
  anticipatedDisbursementDate?: Date;
  /** 2026-07-11 (Create Loan Account origination fees) — each omitted/undefined defaults to 0. */
  processingFee?: string;
  advanceInterestFee?: string;
  outstandingBalancePayoff?: string;
  docStampFee?: string;
  accountManagementFee?: string;
  otherFees?: string;
  notarialFee?: string;
  webFee?: string;
  insuranceFee?: string;
  legacyId?: string;
}
