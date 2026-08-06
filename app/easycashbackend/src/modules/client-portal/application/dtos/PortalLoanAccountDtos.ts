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
  /** Penalty-inclusive total still owed (LoanAccount.collectionsBalance) - see ADR-007 §3. Doubles
   * as the "Payoff Amount" figure (2026-08-06 user request): the system's own definition of
   * "settled" (see LoanAccount.isFullyPaid) - not a full accrual recalculation like the staff-only
   * Statement of Account generator, which needs judgment-call inputs (collection/other fee,
   * penalty date range) with no honest client-facing default. Shown to the client with an explicit
   * "as of last posted transaction" caveat rather than silently implying more precision than this
   * figure actually has. */
  outstandingBalance: string;
  /** Payoff Amount breakdown (2026-08-06 user request) - same four components summed into
   * `outstandingBalance`, shown individually so a client can see what they actually still owe. */
  principalBalance: string;
  interestBalance: string;
  feesBalance: string;
  penaltyBalance: string;
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

/** "My Statement of Account" list item (2026-08-06 user request) - narrowed from the staff-facing
 * `GeneratedStatementOfAccountView`: no `generatedByUserId`/`generatedByName` (irrelevant to the
 * client viewing their own statement) or the fee/penalty-window fields (only meaningful context
 * for the staff member who generated it). Scoped to one loan account (the route's `:id`), same
 * "no loanCode repeated per row" convention as `PortalInstallmentEntry`. */
export interface PortalStatementOfAccountEntry {
  id: string;
  soaNumber: string;
  totalAmountDue: string;
  generatedAt: Date;
}
