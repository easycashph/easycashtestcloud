/**
 * Mirrors `app/backend`'s `LoanAccountPresenter`/`RepaymentInstallmentPresenter` JSON shapes —
 * see `apiClient.ts`'s doc comment for why this pilot hand-maintains these instead of generating
 * them. All Money fields are decimal strings, exactly as the backend sends them (never floats on
 * the wire) — parsed to numbers only where a specific UI computation needs it (see
 * `PaymentRecordingPage.tsx`), same discipline the backend itself uses internally via `Money`.
 */
export interface LoanAccountBalances {
  principalBalance: string;
  principalPaid: string;
  principalDue: string;
  interestBalance: string;
  interestPaid: string;
  interestDue: string;
  feesBalance: string;
  feesPaid: string;
  feesDue: string;
  penaltyBalance: string;
  penaltyPaid: string;
  penaltyDue: string;
}

/** Matches `LoanAccountStatus` in `app/backend/prisma/schema.prisma` exactly — note plain `CLOSED`, not `CLOSED_PAID`. */
export type LoanAccountStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ACTIVE_IN_ARREARS'
  | 'CLOSED'
  | 'CLOSED_WRITTEN_OFF'
  | 'CLOSED_REJECTED';

export interface LoanAccount {
  id: string;
  loanCode: string;
  borrowerId: string;
  loanProductVersionId: string;
  branchId: string;
  loanOfficerId: string | null;
  status: LoanAccountStatus;
  principalAmount: string;
  balances: LoanAccountBalances;
  collectionsBalance: string;
  accountingBalance: string;
  interestRate: string;
  installmentCount: number;
  repaymentPeriodUnit: string;
  firstRepaymentDate: string;
  approvedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  /** CP12 migration follow-up (2026-07-09): true means every `balances` field is 0.00 only because the legacy record had no balance snapshot at all — NOT because the loan is settled. See docs/Architecture/CP12-missing-balance-loans.md. */
  legacyBalanceDataMissing: boolean;
  /** 2026-07-11 (Create Loan Account origination fees) — one-time deductions taken at disbursement, set once at creation. */
  originationFees: {
    processingFee: string;
    advanceInterestFee: string;
    outstandingBalancePayoff: string;
    docStampFee: string;
    accountManagementFee: string;
    otherFees: string;
    notarialFee: string;
    webFee: string;
    insuranceFee: string;
  };
  netProceeds: string;
  createdAt: string;
}

export interface BorrowerIncomeDetail {
  employmentType: string | null;
  employerName: string | null;
  employerAddress: string | null;
  natureOfBusiness: string | null;
  position: string | null;
  yearsEmployed: number | null;
}

export interface BorrowerGovernmentId {
  sssNumber: string | null;
  tinNumber: string | null;
}

export interface BorrowerAddress {
  addressType: string | null;
  houseUnitNumber: string | null;
  street: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  zipCode: string | null;
  lengthOfStayMonths: number | null;
  ownershipStatus: string | null;
}

export type BorrowerStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

/** Mirrors `BorrowerPresenter.presentBorrower()` in app/backend exactly. */
export interface Borrower {
  id: string;
  branchId: string;
  assignedLoanOfficerId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  gender: string | null;
  birthDate: string | null;
  civilStatus: string | null;
  mobilePhone1: string | null;
  mobilePhone2: string | null;
  email: string | null;
  status: BorrowerStatus;
  loanCycle: number;
  legacyId: string | null;
  createdAt: string;
  updatedAt: string;
  incomeDetail: BorrowerIncomeDetail | null;
  governmentId: BorrowerGovernmentId | null;
  addresses: BorrowerAddress[];
}

export type PenaltyCalculationMethod = 'NONE' | 'OVERDUE_BALANCE_AND_INTEREST' | 'ON_REPAYMENT';
export type FeeCalculationMethod = 'FLAT' | 'PERCENTAGE_OF_LOAN_AMOUNT';
export type FeeTriggerEvent = 'DISBURSEMENT' | 'MANUAL' | 'CAPITALIZED_DISBURSEMENT';
export type FeeApplicationType = 'REQUIRED' | 'OPTIONAL';
export type RoundingMethod = 'NO_ROUNDING' | 'ROUND_REMAINDER_INTO_LAST_REPAYMENT';

export interface PenaltyRule {
  id: string;
  calculationMethod: PenaltyCalculationMethod;
  ratePercent: string | null;
  capPercent: string | null;
  gracePeriodDays: number;
}

export interface FeeRule {
  id: string;
  name: string;
  calculationMethod: FeeCalculationMethod;
  triggerEvent: FeeTriggerEvent;
  applicationType: FeeApplicationType;
  flatAmount: string | null;
  percentage: string | null;
  isActive: boolean;
}

/** Mirrors `LoanProductPresenter.presentLoanProductVersion()` in app/backend exactly. */
export interface LoanProductVersion {
  id: string;
  loanProductId: string;
  versionNumber: number;
  previousVersionId: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  interestCalculationMethod: string;
  daysInYearConvention: string;
  repaymentPeriodUnit: string;
  loanAmountMin: string;
  loanAmountMax: string | null;
  loanAmountDefault: string | null;
  installmentCountMin: number;
  installmentCountMax: number | null;
  installmentCountDefault: number | null;
  gracePeriodDefaultDays: number;
  roundingMethod: RoundingMethod;
  defaultInterestRate: string | null;
  minInterestRate: string | null;
  maxInterestRate: string | null;
  penaltyRule: PenaltyRule | null;
  feeRules: FeeRule[];
}

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  description: string | null;
  versions: LoanProductVersion[];
}

/** `GET /interest-rate-chart` — Add-On Rate + Term -> Contractual Rate lookup (Create Loan Account). See the backend Prisma model's own doc comment for provenance. */
export interface InterestRateChartEntry {
  id: string;
  addOnRatePercent: string;
  termMonths: number;
  contractualRatePercent: string;
}

export interface InstallmentAmounts {
  principal: string;
  interest: string;
  fees: string;
  penalty: string;
  total: string;
}

export interface RepaymentInstallment {
  id: string;
  loanAccountId: string;
  installmentNumber: number;
  dueDate: string;
  due: InstallmentAmounts;
  paid: InstallmentAmounts;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE';
}

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
  | 'REVERSAL';

export interface LoanTransaction {
  id: string;
  loanAccountId: string;
  type: LoanTransactionType;
  amount: string;
  principalComponent: string;
  interestComponent: string;
  feesComponent: string;
  penaltyComponent: string;
  balanceAfter: string;
  entryDate: string;
  comment: string | null;
  orNumber: string | null;
  arNumber: string | null;
  /** 2026-07-11 (Reverse Payment feature): set on a REVERSAL transaction, pointing at the REPAYMENT it corrects — used to tell whether a given transaction has already been reversed (see LoanDetailPage's payments tab). */
  reversesTransactionId: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

/** 2026-07-11 (user request, Collections use case): free-text note on a loan account. */
export interface LoanNote {
  id: string;
  loanAccountId: string;
  authorUserId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface ProcessPaymentResponse {
  loanAccount: LoanAccount;
  remainder: string;
}
