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

/**
 * 2026-07-17: the remaining 8 legacy reports (`docs/SESSION_LOG_2026-07-15.md`'s Report Generation
 * scoping section), header layouts verified directly against the real legacy `.xlsx` samples
 * (`C:\Users\EASYCASH\Downloads\Reports\`). Originally believed "as-of-today" snapshots with no
 * date filter for Aging, Detailed Ending Current Balance, Accounts with Past Due, Fully Paid
 * Accounts, matching those legacy sample files having no date-range columns.
 *
 * 2026-08-03 correction (user-verified directly against the live SDevTech UI, not just the old
 * static file sample): SDevTech's own "Accounts with Past Due" report DOES prompt for a start/end
 * date — the "no date filter" assumption for this one was wrong. Found via a scale mismatch (1206
 * LMS rows vs 16 SDevTech rows) — the extra ~1190 were genuinely ancient (2012-2021) unpaid
 * installments with no upper bound, since this report had never had a date filter to begin with.
 * Aging/Detailed Ending Current Balance/Fully Paid Accounts are unconfirmed either way — left
 * unfiltered until similarly verified.
 */
export interface AgingReportRow {
  clientName: string;
  product: string;
  accountId: string;
  state: string;
  maturityDate: Date | null;
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  days91to120: string;
  days121to150: string;
  days150Plus: string;
  total: string;
}

export interface EndingBalanceReportRow {
  clientName: string;
  product: string;
  loanAccountId: string;
  loanAmount: string;
  principalBalance: string;
  interestBalance: string;
  feesBalance: string;
  totalObligation: string;
  maturityDate: Date | null;
  /** "N Month/s" - `installmentCount` + `repaymentPeriodUnit`, matching the legacy sample's text format exactly. */
  termRate: string;
  interestRate: string;
  accountState: string;
}

export interface AccountsWithPastDueReportRow {
  clientName: string;
  product: string;
  accountId: string;
  accountState: string;
  /** Oldest unpaid installment's due date. */
  dueDate: Date;
  maturityDate: Date | null;
  lastPaidDate: Date | null;
  currentAmountDue: string;
  pastAmountDue: string;
  daysLate: number;
  repayment: string;
  lackOrExcess: string;
  repaymentState: string;
  countOfPaidDue: number;
}

export interface CollectionHistoryReportRow {
  clientName: string;
  product: string;
  accountId: string;
  dueDate: Date;
  maturityDate: Date | null;
  lastPaidDate: Date | null;
  amountDue: string;
  repayment: string;
  lackOrExcess: string;
  repaymentState: string;
  repaymentCount: number;
  installmentNumber: number;
}

export interface ExpectedCollectionReportRow {
  clientName: string;
  product: string;
  accountId: string;
  mobileNumber: string;
  accountState: string;
  dueDate: Date;
  maturityDate: Date | null;
  lastPaidDate: Date | null;
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

export interface FirstAmortizationReportRow {
  clientName: string;
  product: string;
  accountId: string;
  accountState: string;
  firstAmortizationDate: Date;
  principalDue: string;
  interestDue: string;
  feesDue: string;
  penaltyDue: string;
  obligation: string;
  payment: string;
  lastDatePaid: Date | null;
  repaymentState: string;
}

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
  expectedMaturityDate: Date | null;
  valueDate: Date;
  orNumber: string;
  arNumber: string;
  channel: string;
  type: string;
}

export interface FullyPaidAccountsReportRow {
  clientName: string;
  product: string;
  productId: string;
  accountId: string;
  loanAmount: string;
  maturityDate: Date | null;
  fullyPaidDate: Date | null;
}

export interface IReportingRepository {
  getLoanOriginationReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<OriginationReportRow[]>;
  getCollectionReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<CollectionReportRow[]>;
  listTransactions(options: ListReportTransactionsOptions): Promise<TransactionReportRow[]>;
  getLoanReleasesReport(filter: DateRangeFilter & { branchId?: string }): Promise<LoanReleaseReportRow[]>;
  getAgingReport(filter: { branchId?: string }): Promise<AgingReportRow[]>;
  getEndingBalanceReport(filter: { branchId?: string }): Promise<EndingBalanceReportRow[]>;
  getAccountsWithPastDueReport(filter: DateRangeFilter & { branchId?: string }): Promise<AccountsWithPastDueReportRow[]>;
  getCollectionHistoryReport(filter: DateRangeFilter & { branchId?: string }): Promise<CollectionHistoryReportRow[]>;
  getExpectedCollectionReport(filter: DateRangeFilter & { branchId?: string }): Promise<ExpectedCollectionReportRow[]>;
  getFirstAmortizationReport(filter: DateRangeFilter & { branchId?: string }): Promise<FirstAmortizationReportRow[]>;
  getDailyCollectionReport(filter: DateRangeFilter & { branchId?: string }): Promise<DailyCollectionReportRow[]>;
  getFullyPaidAccountsReport(filter: { branchId?: string }): Promise<FullyPaidAccountsReportRow[]>;
}
