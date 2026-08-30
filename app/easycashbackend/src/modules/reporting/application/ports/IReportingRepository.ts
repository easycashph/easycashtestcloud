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
  /**
   * 2026-08-05 (user-confirmed): column set/order matches the Daily Collection Report export
   * exactly (same underlying data - `getDailyCollectionReport`'s own field computation is
   * reused verbatim in `listTransactions`), so the on-screen Transaction Report table can show
   * every field as a direct column instead of a click-to-expand breakdown row.
   */
  productId: string;
  totalBalance: string;
  expectedMaturityDate: Date | null;
  orNumber: string;
  arNumber: string;
  channel: string;
}

export interface ListReportTransactionsOptions extends DateRangeFilter {
  branchId?: string;
  /** 2026-08-15: was a single `type`. Staff need several at once — e.g. REPAYMENT alongside
   * FEE_REPAYMENT/PENALTY_REPAYMENT, which are separate types on migrated SDevTech rows, so a
   * single-type filter on "REPAYMENT" silently hid real collections. Undefined/empty means no type
   * filter at all (every type). */
  types?: string[];
  /** 2026-08-15 (multi-select channel filter, user request): raw `LoanTransaction.paymentMethod`
   * values (not display labels — the stored column mixes migrated free-text channel names like
   * "Loan Deduct" with native ACTIVE_PAYMENT_METHODS codes like "BANK_TRANSFER", so filtering
   * happens against whatever's actually stored; `listDistinctChannels()` is what the frontend uses
   * to offer the exact set of values that exist, each already paired with its display label).
   * Undefined/empty means no channel filter (every channel, including a transaction with none set). */
  channels?: string[];
  limit: number;
  cursor?: string;
}

export interface ChannelOption {
  /** Display label, same resolution `channel` report columns already use. */
  label: string;
  /**
   * Every raw stored `paymentMethod` value that resolves to this label — usually one, but two when
   * a native code (e.g. "BANK_TRANSFER") and its migrated free-text counterpart (e.g.
   * "Bank Transfer") both exist and share a label (see `PAYMENT_METHOD_LABEL`'s own doc comment).
   * A filter's `channels` entries must match one of these exactly; selecting this option should
   * pass ALL of them, not just the first.
   */
  values: string[];
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
  /** 2026-08-29 (user request): distinguishes a genuine new-money disbursement from a loan account
   * that only exists to carry forward an old loan's balance under new terms - a Restructure,
   * Adjustment, or Compromise Settlement all create a fresh `LoanAccount` (see
   * `LoanRestructure`/`LoanAdjustment`/`LoanCompromiseSettlement.newLoanAccountId`), which
   * previously counted as a "release" here even though no new funds went out. Defaults to
   * `ORIGINATION`-only when the caller doesn't filter by origin - see
   * `PrismaReportingRepository.getLoanReleasesReport`'s own doc comment. */
  origin: 'ORIGINATION' | 'RESTRUCTURE' | 'ADJUSTMENT' | 'COMPROMISE';
}

export type LoanReleaseOrigin = LoanReleaseReportRow['origin'];

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

/** 2026-08-22 (user request): every client self-service Portal account on file. `name` prefers
 * the linked Borrower's name (authoritative once linked, per PortalAccount's own schema doc
 * comment) and falls back to the account's own pre-application profile fields, then finally the
 * email if neither has a name on file yet. `linkedTo` is the Borrower's display name when linked,
 * `null` otherwise - deliberately not a specific loan code, since a Borrower can have more than
 * one loan account and there's no single "the" one to pick without inventing a rule. */
export interface PortalAccountReportRow {
  name: string;
  email: string;
  contactNumber: string | null;
  status: string;
  linkedTo: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

/**
 * CIC (Credit Information Corporation) monthly report (2026-08-30, user-confirmed scope: ID +
 * CI record types only for this first version - see docs/session-logs/macbook-nomer's §30 for the
 * full investigation). Field names/order below match the CSDF format's `ID`/`CI` record layouts,
 * verified position-by-position against a real accepted submission
 * (`legacy/CIC /07 2026 July/PF017290_CSDF_20260811105959.csv`) - `CicCsdfReportWriter` is what
 * actually renders these into the pipe-delimited file.
 *
 * Domain-code mappings below were confirmed 2026-08-30 by reading the official
 * `Manual_CIC_Philippines_Submission_v.1.7.pdf` (civil status, identification type, occupation
 * status codes) and the CIC field-spec Excel's own "CI - Installment Contract" domain sheet
 * (contract type codes) - never guessed. PSIC/PSOC (industry/occupation classification) remain
 * unmapped - this system has no coded equivalent field to map from at all (free text only).
 */
export interface CicIndividualRow {
  /** Permanent CIC identifier - `Borrower.cicProviderSubjectNo`. Every row here is guaranteed to have one (rows without it are excluded upstream, never fabricated - see `getCicMonthlyReportData`'s own doc comment). */
  providerSubjectNo: string;
  /** 'M' -> 10 (Mr), 'F' -> 11 (Ms) - user-confirmed 2026-08-30. Blank if gender isn't one of those two. */
  title: '10' | '11' | '';
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  /** Raw `Borrower.gender` passed through as-is (already 'M'/'F' in this system's data). */
  gender: string;
  birthDate: Date | null;
  nationality: string;
  mobile: string;
  email: string;
  employerName: string;
  /** CivilStatusDomain code (1=Single, 2=Married, 3=Divorced/Separated, 4=Widow) mapped from
   * `Borrower.civilStatus` free text. Blank if the stored text doesn't match a known variant. */
  civilStatusCode: string;
  /** IdentificationTypeDomain (TIN/SSS/GSIS/Philhealth/UMID/business-registration codes) OR
   * IDTypeDomain (Driver's License/Passport/Voter's ID/etc government photo IDs) code, mapped from
   * the borrower's first `IdentificationDocument.documentType`. Blank if unrecognized. */
  identificationTypeCode: string;
  /** Which domain `identificationTypeCode` belongs to - CicCsdfReportWriter places it in the
   * correct field group accordingly (they're two different field groups in the CSDF layout). */
  identificationDomain: 'IDENTIFICATION' | 'ID' | '';
  identificationNumber: string;
  /** OccupationStatusDomain code. Only 'Self Employed' maps confidently (-> 5) - `BorrowerIncomeDetail.employmentType`'s other stored value, plain 'Employed', doesn't distinguish permanent/temporary or private/government sector, so it's left blank rather than guessed. */
  occupationStatusCode: string;
}

export interface CicContractRow {
  /** The borrower's permanent identifier - links this contract back to its `ID` record. */
  providerSubjectNo: string;
  /** This loan's own permanent identifier (`LoanAccount.cicProviderContractNo`) - NOT the same as `loanCode`, which is this system's internal code and has no relationship to CIC's historical numbering (see `backfill-cic-provider-contract-no.ts`'s own doc comment). */
  providerContractNo: string;
  loanCode: string;
  /** InstallmentContractTypeDomain code, derived from the loan's product code prefix
   * (user-confirmed 2026-08-30): SL- -> '20' (Salary Loan), BL- -> '22' (Business Loan),
   * PL-, PFL-, SML -> '12' (Personal Loan), CL- -> '12' (Personal Loan). Blank for any other
   * product prefix (not yet confirmed). */
  contractTypeCode: string;
  /** CreditPurposeDomain code. '32' (Loans to Individual for other purposes) when
   * `contractTypeCode` is '12' or '20' - the only code that fits an "Individual" purpose
   * description, matching this being this system's dominant real code (765/1,312 in the real July
   * submission). Blank for '22' (Business Loan) - no confirmed purpose code fits a business
   * borrower without guessing between the several SME/corporate options. */
  purposeOfCreditCode: string;
  /** 'AC' (Active) or 'CL' (Closed) - from `LoanAccount.status`/`closedAt`. */
  contractPhase: 'AC' | 'CL';
  contractStartDate: Date;
  /** `LoanAccount.createdAt` - the application/request date, distinct from the actual disbursement (`contractStartDate`). */
  contractRequestDate: Date;
  contractEndPlannedDate: Date | null;
  /** Only set when `contractPhase` is 'CL'. */
  contractEndActualDate: Date | null;
  financedAmount: string;
  installmentsNumber: number;
  /** First unpaid installment's `principalDue + interestDue` - the recurring per-period payment amount. */
  monthlyPaymentAmount: string;
  firstPaymentDate: Date;
  /** Most recent installment with a payment recorded, or null if none yet. */
  lastPaymentDate: Date | null;
  lastPaymentAmount: string;
  /** Earliest still-unpaid installment's due date/amount, or null if the loan is fully paid. */
  nextPaymentDate: Date | null;
  nextPaymentAmount: string;
  /** Count of installments not yet fully paid. */
  outstandingPaymentsNumber: number;
  /** `principalBalance + interestBalance + feesBalance + penaltyBalance`. */
  outstandingBalance: string;
  /** Of the outstanding installments, how many are past their due date as of the report's reference date. */
  overduePaymentsNumber: number;
  /** Sum of (due - paid) across those overdue installments. */
  overduePaymentsAmount: string;
  /** Report reference date minus the earliest overdue installment's due date, in days. 0 if none overdue. */
  overdueDays: number;
}

export interface CicMonthlyReportFilter {
  year: number;
  /** 1-12. */
  month: number;
  branchId?: string;
}

export interface CicMonthlyReportData {
  /** Last day of the reporting month - the CSDF `File Reference Date` / `Subject Reference Date` / `Contract Reference Date`. */
  referenceDate: Date;
  individuals: CicIndividualRow[];
  contracts: CicContractRow[];
  /** Loans excluded because their borrower is missing `cicProviderSubjectNo` OR the loan itself is
   * missing `cicProviderContractNo` - never submitted with a fabricated ID. `reason` distinguishes
   * the two so the caller can flag them for manual assignment before the file is trusted. */
  skippedMissingSubjectNo: { loanCode: string; borrowerName: string; reason: 'MISSING_SUBJECT_NO' | 'MISSING_CONTRACT_NO' }[];
}

export interface IReportingRepository {
  getLoanOriginationReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<OriginationReportRow[]>;
  getCollectionReport(granularity: ReportGranularity, filter: DateRangeFilter & { branchId?: string }): Promise<CollectionReportRow[]>;
  listTransactions(options: ListReportTransactionsOptions): Promise<TransactionReportRow[]>;
  /** Distinct `paymentMethod` values currently in use, each paired with its display label — powers the Transaction Report's channel filter dropdown. */
  listDistinctChannels(): Promise<ChannelOption[]>;
  /** `origins` unfiltered (undefined/empty) defaults to `['ORIGINATION']` - see
   * `LoanReleaseReportRow.origin`'s own doc comment for why. */
  getLoanReleasesReport(filter: DateRangeFilter & { branchId?: string; origins?: LoanReleaseOrigin[] }): Promise<LoanReleaseReportRow[]>;
  getAgingReport(filter: { branchId?: string }): Promise<AgingReportRow[]>;
  getEndingBalanceReport(filter: { branchId?: string }): Promise<EndingBalanceReportRow[]>;
  getAccountsWithPastDueReport(filter: DateRangeFilter & { branchId?: string }): Promise<AccountsWithPastDueReportRow[]>;
  getCollectionHistoryReport(filter: DateRangeFilter & { branchId?: string }): Promise<CollectionHistoryReportRow[]>;
  /** 2026-08-20 (user request): `productCodes` - multi-select filter on `LoanProduct.code`, undefined/empty means every product. */
  getExpectedCollectionReport(filter: DateRangeFilter & { branchId?: string; productCodes?: string[] }): Promise<ExpectedCollectionReportRow[]>;
  getFirstAmortizationReport(filter: DateRangeFilter & { branchId?: string }): Promise<FirstAmortizationReportRow[]>;
  getDailyCollectionReport(filter: DateRangeFilter & { branchId?: string; types?: string[]; channels?: string[] }): Promise<DailyCollectionReportRow[]>;
  getFullyPaidAccountsReport(filter: DateRangeFilter & { branchId?: string }): Promise<FullyPaidAccountsReportRow[]>;
  /** Not branch-scoped - a PortalAccount has no `branchId` of its own (only gains one indirectly,
   * once linked to a Borrower), and the login itself isn't a per-branch concept. */
  getPortalAccountsReport(filter: { search?: string; status?: string }): Promise<PortalAccountReportRow[]>;
  getCicMonthlyReportData(filter: CicMonthlyReportFilter): Promise<CicMonthlyReportData>;
}
