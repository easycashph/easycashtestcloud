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
  /** 2026-07-22 (optimistic concurrency, client-facing): the `version` the caller last saw when
   * they opened the edit form. Checked against the current row's `version` BEFORE any mutation is
   * applied — distinct from `PrismaLoanAccountRepository.save()`'s own conditional-update guard,
   * which only protects against two requests racing within the same moment (it always re-reads
   * fresh inside `findById()`, so by itself it can never catch a stale browser tab). Omit to skip
   * the check (e.g. server-side/internal callers that don't track a version). */
  expectedVersion?: number;
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
