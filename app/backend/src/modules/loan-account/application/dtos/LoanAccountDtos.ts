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
  /** 2026-07-16 — see `LoanAccountProps.sourceApplicationId`'s own doc comment. */
  sourceApplicationId?: string;
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

/**
 * 2026-07-16 (Edit Loan Account) — every field optional, mirrors `UpdateLoanAccountProps`'s own
 * doc comment on why identity/ownership/linkage fields are excluded. `undefined` on a fee field
 * means "leave unchanged" — `UpdateLoanAccountUseCase` merges any supplied fee sub-fields onto
 * the loan's existing `originationFees` before calling `LoanAccount.update()` (which itself
 * replaces the whole `OriginationFees` value object, having no concept of a partial merge of its
 * own), so a caller editing just one fee never has to resend the other eight.
 */
export interface UpdateLoanAccountInput {
  loanProductVersionId?: string;
  principalAmount?: string;
  interestRate?: string;
  addOnInterestRate?: string;
  contractualInterestRate?: string;
  installmentCount?: number;
  gracePeriodDays?: number;
  firstRepaymentDate?: Date;
  anticipatedDisbursementDate?: Date;
  processingFee?: string;
  advanceInterestFee?: string;
  outstandingBalancePayoff?: string;
  docStampFee?: string;
  accountManagementFee?: string;
  otherFees?: string;
  notarialFee?: string;
  webFee?: string;
  insuranceFee?: string;
}
