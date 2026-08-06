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

/** Dashboard "Next Payment Due" reminder (2026-08-06 user request) - the single soonest unpaid
 * (PENDING/PARTIALLY_PAID/LATE) installment across every one of the client's still-open
 * (ACTIVE/ACTIVE_IN_ARREARS) loan accounts. `null` (not this type) when there is nothing upcoming -
 * no open loan, or every installment already paid. */
export interface PortalNextPaymentDue {
  loanAccountId: string;
  loanCode: string;
  installmentNumber: number;
  dueDate: Date;
  totalDue: string;
  totalPaid: string;
  status: string;
}

/** Dashboard "Recent Payments" widget (2026-08-06 user request) - ACTUAL posted payments (real
 * money the client paid in), never the schedule - narrowed from the ledger's `LoanTransaction`
 * (type `REPAYMENT` only; disbursements/fees/interest accruals/reversals/etc. never appear here). */
export interface PortalPaymentEntry {
  id: string;
  loanAccountId: string;
  loanCode: string;
  entryDate: Date;
  amount: string;
  principalComponent: string;
  interestComponent: string;
  feesComponent: string;
  penaltyComponent: string;
  orNumber: string | null;
  paymentMethod: string | null;
}
