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
