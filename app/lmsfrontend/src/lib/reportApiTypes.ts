/**
 * Mirrors `app/backend`'s reporting module presenters/DTOs exactly - see `apiClient.ts`'s doc
 * comment for why this pilot hand-maintains DTOs instead of generating them.
 */
export type ReportGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY';

export interface OriginationReportRow {
  /** 'YYYY-MM-DD' (daily), 'YYYY-MM' (monthly), or 'YYYY' (yearly). */
  period: string;
  loansOriginated: number;
  amountOriginated: string;
}

export interface CollectionReportRow {
  period: string;
  amountCollected: string;
}

/** Matches `LoanTransactionType` in `app/backend/prisma/schema.prisma` exactly. */
export type LoanTransactionType =
  | 'DISBURSEMENT'
  | 'REPAYMENT'
  | 'FEE_CHARGED'
  | 'PENALTY_APPLIED'
  | 'INTEREST_APPLIED'
  | 'DEFERRED_INTEREST_APPLIED'
  | 'DEFERRED_INTEREST_PAID'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'REVERSAL'
  // Migrated SDevTech history only — see schema.prisma's LoanTransactionType doc comment.
  | 'FEE_REPAYMENT'
  | 'PENALTY_REPAYMENT';

export interface TransactionReportRow {
  id: string;
  loanAccountId: string;
  loanCode: string;
  borrowerName: string;
  branchId: string;
  branchName: string;
  type: LoanTransactionType;
  amount: string;
  components: { principal: string; interest: string; fees: string; penalty: string };
  entryDate: string;
  comment: string | null;
  productId: string;
  totalBalance: string;
  expectedMaturityDate: string | null;
  orNumber: string;
  arNumber: string;
  channel: string;
}

export interface LoanReleaseReportRow {
  clientId: string;
  clientName: string;
  address: string;
  product: string;
  accountId: string;
  agencyCompany: string;
  disbursementDate: string;
  loanCreated: string;
  maturityDate: string | null;
  term: number;
  nthLoan: number;
  newOrRenew: 'New' | 'Renew';
  firstRepaymentDate: string;
  amortization: string;
  loanAmount: string;
  totalInterest: string;
  totalOB: string;
  addOnInterestRate: string | null;
  contractualInterestRate: string | null;
  advanceInterestFee: string;
  processingFee: string;
  documentationFee: string;
  outstandingLoanBalance: string;
  accountManagementFee: string;
  insurance: string;
  notarial: string;
  webFee: string;
  totalNetAmount: string;
  /** 2026-08-29 (user request): distinguishes a genuine new-money disbursement from a loan account
   * that only exists to carry an old loan's balance forward (Restructure/Adjustment/Compromise
   * Settlement each create a fresh LoanAccount, previously miscounted as a release). */
  origin: LoanReleaseOrigin;
}

export type LoanReleaseOrigin = 'ORIGINATION' | 'RESTRUCTURE' | 'ADJUSTMENT' | 'COMPROMISE';

/** 2026-08-19 (user request): JSON counterpart of the backend's ExpectedCollectionReportResponse. */
export interface ExpectedCollectionReportRow {
  clientName: string;
  product: string;
  accountId: string;
  mobileNumber: string;
  accountState: string;
  dueDate: string;
  maturityDate: string | null;
  lastPaidDate: string | null;
  principalDue: string;
  interestDue: string;
  principalPaid: string;
  interestPaid: string;
  monthDue: string;
  pastDueAmount: string;
  daysLate: number;
  repayment: string;
  state: string;
}

/** 2026-08-20 (user request): JSON counterpart of the backend's AccountsWithPastDueReportResponse. */
export interface AccountsWithPastDueReportRow {
  clientName: string;
  product: string;
  accountId: string;
  accountState: string;
  dueDate: string;
  maturityDate: string | null;
  lastPaidDate: string | null;
  currentAmountDue: string;
  pastAmountDue: string;
  daysLate: number;
  repayment: string;
  lackOrExcess: string;
  repaymentState: string;
  countOfPaidDue: number;
}

/** 2026-08-20 (user request): JSON counterpart of the backend's CollectionHistoryReportResponse. */
export interface CollectionHistoryReportRow {
  clientName: string;
  product: string;
  accountId: string;
  dueDate: string;
  maturityDate: string | null;
  lastPaidDate: string | null;
  amountDue: string;
  repayment: string;
  lackOrExcess: string;
  repaymentState: string;
  repaymentCount: number;
  installmentNumber: number;
}

/** 2026-08-20 (user request): JSON counterpart of the backend's FirstAmortizationReportResponse. */
export interface FirstAmortizationReportRow {
  clientName: string;
  product: string;
  accountId: string;
  accountState: string;
  firstAmortizationDate: string;
  principalDue: string;
  interestDue: string;
  feesDue: string;
  penaltyDue: string;
  obligation: string;
  payment: string;
  lastDatePaid: string | null;
  repaymentState: string;
}

/** 2026-08-20 (user request): JSON counterpart of the backend's DailyCollectionReportResponse. */
export interface DailyCollectionReportRow {
  fullName: string;
  productId: string;
  accountId: string;
  totalBalance: string;
  amount: string;
  principalAmount: string;
  interestAmount: string;
  feesAmount: string;
  penaltyAmount: string;
  expectedMaturityDate: string | null;
  valueDate: string;
  orNumber: string;
  arNumber: string;
  channel: string;
  type: string;
}

/** 2026-08-20 (user request): JSON counterpart of the backend's FullyPaidAccountsReportResponse. */
export interface FullyPaidAccountsReportRow {
  clientName: string;
  product: string;
  productId: string;
  accountId: string;
  loanAmount: string;
  maturityDate: string | null;
  fullyPaidDate: string | null;
}

/** 2026-08-22 (user request): JSON counterpart of the backend's PortalAccountReportResponse. */
export interface PortalAccountReportRow {
  name: string;
  email: string;
  contactNumber: string | null;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'DELETED';
  linkedTo: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}
