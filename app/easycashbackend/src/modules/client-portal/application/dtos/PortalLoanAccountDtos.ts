/** 2026-07-31 (user request, "top reputable lending site" checklist): payment history + a
 * downloadable amortization schedule for a linked client's real, booked LoanAccount(s) - a
 * deliberately narrower field set than the staff-facing LoanAccountPresenter (no loanOfficerId,
 * legacy-migration flags, or internal fee-rule ids), matching what a borrower actually needs to
 * see about their own loan. */
export interface PortalLoanAccountSummary {
  id: string;
  loanCode: string;
  status: string;
  principalAmount: string;
  /** Penalty-inclusive total still owed (LoanAccount.collectionsBalance) - see ADR-007 §3. */
  outstandingBalance: string;
  contractualInterestRate: string | null;
  installmentCount: number;
  firstRepaymentDate: Date;
  activatedAt: Date | null;
}

export interface PortalInstallmentEntry {
  installmentNumber: number;
  dueDate: Date;
  principalDue: string;
  interestDue: string;
  feesDue: string;
  penaltyDue: string;
  totalDue: string;
  totalPaid: string;
  status: string;
  lastPaidAt: Date | null;
}
