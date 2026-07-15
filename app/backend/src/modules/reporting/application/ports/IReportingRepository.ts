export type ReportGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY';

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface OriginationReportRow {
  /** Bucket start, formatted per granularity: 'YYYY-MM-DD' (daily), 'YYYY-MM' (monthly), 'YYYY' (yearly). */
  period: string;
  loansOriginated: number;
  amountOriginated: string;
}

export interface CollectionReportRow {
  period: string;
  amountCollected: string;
}

export interface TransactionReportRow {
  id: string;
  loanAccountId: string;
  loanCode: string;
  borrowerName: string;
  branchId: string;
  branchName: string;
  type: string;
  amount: string;
  components: { principal: string; interest: string; fees: string; penalty: string };
  entryDate: Date;
  comment: string | null;
}

export interface ListReportTransactionsOptions extends DateRangeFilter {
  branchId?: string;
  type?: string;
  limit: number;
  cursor?: string;
}

/**
 * One row of the Monthly Loan Releases report — matches the legacy Excel report's 28-column shape
 * exactly (`legacy/reports/.../Monthly-Loan-Releases (2).xlsx`, header row verified 2026-07-15).
 * Every field maps to an existing schema field except `nthLoan`/`newOrRenew`/`maturityDate`/
 * `totalInterest`/`totalOB`/`amortization`, which are derived — see each field's own comment and
 * `PrismaReportingRepository.getLoanReleasesReport` for the exact derivation, confirmed with the
 * user rather than guessed (CLAUDE.md "never invent business rules").
 */
export interface LoanReleaseReportRow {
  clientId: string;
  clientName: string;
  address: string;
  product: string;
  accountId: string;
  agencyCompany: string;
  disbursementDate: Date;
  loanCreated: Date;
  /** Last installment's due date — the schedule's own end, not a separately stored field. */
  maturityDate: Date | null;
  term: number;
  /** `Borrower.loanCycle` at report time — confirmed with the user 2026-07-15. */
  nthLoan: number;
  /** "Renew" when `Borrower.loanCycle > 1`, else "New" — confirmed with the user 2026-07-15 (no explicit field exists). */
  newOrRenew: 'New' | 'Renew';
  firstRepaymentDate: Date;
  /** First installment's principal + interest — the recurring per-period payment. */
  amortization: string;
  loanAmount: string;
  /** SUM of every installment's `interestDue` for this loan. */
  totalInterest: string;
  /** loanAmount + totalInterest. */
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
}

export interface IReportingRepository {
  getLoanOriginationReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<OriginationReportRow[]>;
  getCollectionReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<CollectionReportRow[]>;
  listTransactions(options: ListReportTransactionsOptions): Promise<TransactionReportRow[]>;
  getLoanReleasesReport(filter: DateRangeFilter & { branchId?: string }): Promise<LoanReleaseReportRow[]>;
}
