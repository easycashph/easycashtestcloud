/**
 * Mirrors `app/backend`'s `LoanAccountPresenter`/`RepaymentInstallmentPresenter` JSON shapes -
 * see `apiClient.ts`'s doc comment for why this pilot hand-maintains these instead of generating
 * them. All Money fields are decimal strings, exactly as the backend sends them (never floats on
 * the wire) - parsed to numbers only where a specific UI computation needs it (see
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

/** Matches `LoanAccountStatus` in `app/backend/prisma/schema.prisma` exactly - note plain `CLOSED`, not `CLOSED_PAID`. */
export type LoanAccountStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ACTIVE_IN_ARREARS'
  | 'CLOSED'
  | 'CLOSED_WRITTEN_OFF'
  | 'CLOSED_REJECTED'
  | 'CLOSED_RESTRUCTURED'
  | 'CLOSED_ADJUSTED';

/** 2026-07-24 (Loan Restructure feature) - mirrors `LoanRestructurePresenter`'s output. Fetched via
 * `GET /loan-accounts/:id/restructure`, null unless this loan account was either side of one. */
export interface LoanRestructureView {
  id: string;
  oldLoanAccountId: string;
  oldLoanCode: string;
  newLoanAccountId: string;
  newLoanCode: string;
  previousCollectionsBalance: string;
  newPrincipalAmount: string;
  reason: string | null;
  restructuredByUserId: string;
  restructuredByName: string | null;
  createdAt: string;
}

/** 2026-07-24 (Loan Adjustment feature) - mirrors `LoanAdjustmentPresenter`'s output. Fetched via
 * `GET /loan-accounts/:id/adjust`, null unless this loan account was either side of one. */
export interface LoanAdjustmentView {
  id: string;
  oldLoanAccountId: string;
  oldLoanCode: string;
  newLoanAccountId: string;
  newLoanCode: string;
  previousFirstRepaymentDate: string;
  newFirstRepaymentDate: string;
  reason: string | null;
  adjustedByUserId: string;
  adjustedByName: string | null;
  createdAt: string;
}

/** 2026-07-24 (user-confirmed) - mirrors `AccruedInterestPresenter`'s output. Fetched via
 * `GET /loan-accounts/:id/accrued-interest`, null for a legacy (migrated) loan. */
export interface AccruedInterestBreakdownRow {
  installmentNumber: number;
  dueDate: string;
  unpaidPrincipal: string;
  unpaidInterest: string;
  frozenPenalty: string;
}

export interface AccruedInterestFigures {
  maturityDate: string;
  totalPastDuePrincipal: string;
  totalPastDueInterest: string;
  totalPastDuePenalty: string;
  totalPastDue: string;
  daysLate: number;
  contractualRate: string | null;
  accruedInterest: string;
  /** 2026-07-24 (Loan Restructure follow-up) - what a Restructure would set the new loan's
   * principal to right now: unpaid principal + unpaid interest across the WHOLE remaining
   * schedule (every installment, due or not) + unpaid penalty + accruedInterest + unpaid fees. */
  restructureNewPrincipal: string;
  breakdown: AccruedInterestBreakdownRow[];
}

export interface LoanAccount {
  id: string;
  /** 2026-07-22 (optimistic concurrency) - echo this back as `expectedVersion` on
   * `PATCH /loan-accounts/:id`. A mismatch means someone else changed the record since this was
   * fetched; the server rejects with 409 `CONCURRENCY_CONFLICT` before applying anything. */
  version: number;
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
  addOnInterestRate: string | null;
  contractualInterestRate: string | null;
  installmentCount: number;
  repaymentPeriodUnit: string;
  gracePeriodDays: number;
  firstRepaymentDate: string;
  anticipatedDisbursementDate: string | null;
  approvedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  /** CP12 migration follow-up (2026-07-09): true means every `balances` field is 0.00 only because the legacy record had no balance snapshot at all - NOT because the loan is settled. See docs/Architecture/CP12-missing-balance-loans.md. */
  legacyBalanceDataMissing: boolean;
  /** ADR-007 §4 (2026-07-08 decision, backfilled 2026-07-23): true for one of the 79 legacy CLOSED
   * loans whose migrated balance columns don't sum to zero despite being marked fully settled -
   * migrated as-is, flagged for manual accounting review rather than a fabricated correction. */
  legacyNonReconcilingClosedBalance: boolean;
  /** 2026-07-13: "Matured" per Investopedia's definition - the loan's full scheduled term has
   * ended (last installment's due date passed) and it's still unpaid, distinct from "in arrears"
   * (still mid-term with a missed payment). Computed server-side, not a `status` enum value - only
   * meaningful when `status` is `ACTIVE`/`ACTIVE_IN_ARREARS`; always `false` otherwise. */
  isMatured: boolean;
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
  /** Set at "Create Loan Account" time to the LoanApplication this account was actually produced
   * from - null for legacy-migrated accounts and any account created before this field existed. */
  sourceApplicationId: string | null;
  /** Non-null only for a CP12-migrated legacy loan. Drives "prospective vs migrated" branching
   * (e.g. live-computed vs manual-date-range Penalty on the Statement of Account, ADR-052 addendum). */
  legacyId: string | null;
}

export interface BorrowerIncomeDetail {
  employmentType: string | null;
  employerName: string | null;
  employerAddress: string | null;
  natureOfBusiness: string | null;
  position: string | null;
  yearsEmployed: number | null;
  monthsEmployed: number | null;
  monthlyIncome: number | null;
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

export interface BorrowerCharacterReference {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
}

export interface BorrowerDependant {
  name: string;
  age?: string;
  relationship?: string;
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
  suffix: string | null;
  fullName: string;
  gender: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  civilStatus: string | null;
  homeOwnership: string | null;
  mobilePhone1: string | null;
  mobilePhone2: string | null;
  email: string | null;
  facebookLink: string | null;
  dependants: BorrowerDependant[];
  note: string | null;
  status: BorrowerStatus;
  loanCycle: number;
  legacyId: string | null;
  /** Set when this client was created via "Create Client Profile" from an APPROVED loan application. */
  sourceApplicationId: string | null;
  createdAt: string;
  updatedAt: string;
  incomeDetail: BorrowerIncomeDetail | null;
  governmentId: BorrowerGovernmentId | null;
  characterReferences: BorrowerCharacterReference[];
  addresses: BorrowerAddress[];
}

/** Body for `POST /borrowers`. */
export interface CreateBorrowerRequest {
  branchId: string;
  assignedLoanOfficerId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  gender?: string;
  birthDate?: string;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  facebookLink?: string;
  dependants?: BorrowerDependant[];
  note?: string;
  /** Set by the "Create Client Profile" flow on an APPROVED loan application - links the new
   * client back to it so the application can't be used to create a duplicate. */
  sourceApplicationId?: string;
  incomeDetail?: {
    employmentType?: string;
    employerName?: string;
    employerAddress?: string;
    natureOfBusiness?: string;
    position?: string;
    yearsEmployed?: number;
    monthsEmployed?: number;
    monthlyIncome?: number;
  };
  governmentId?: {
    sssNumber?: string;
    tinNumber?: string;
  };
  characterReferences?: {
    firstName: string;
    lastName?: string;
    relationship?: string;
    phoneNumber?: string;
    emailAddress?: string;
  }[];
  addresses?: {
    addressType?: string;
    houseUnitNumber?: string;
    street?: string;
    barangay?: string;
    cityMunicipality?: string;
    province?: string;
    zipCode?: string;
    lengthOfStayMonths?: number;
    ownershipStatus?: string;
  }[];
}

/** Response shape for `GET /co-borrowers/:id` / `GET /borrowers/:id/co-borrowers` - see BorrowerPresenter.presentCoBorrower. */
export interface CoBorrower {
  id: string;
  borrowerId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  gender: string | null;
  civilStatus: string | null;
  birthDate: string | null;
  phoneNumber: string | null;
  emailAddress: string | null;
  relationship: string | null;
  employer: string | null;
  addresses: BorrowerAddress[];
}

/** Body for `POST /co-borrowers`. */
export interface CreateCoBorrowerRequest {
  /** 2026-07-16 (ADR-015 resolved: per-Borrower) - attaches the co-borrower directly to a client. */
  borrowerId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  relationship?: string;
  employer?: string;
  phoneNumber?: string;
  emailAddress?: string;
  addresses?: {
    addressType?: string;
    houseUnitNumber?: string;
    street?: string;
    barangay?: string;
    cityMunicipality?: string;
    province?: string;
    zipCode?: string;
    lengthOfStayMonths?: number;
    ownershipStatus?: string;
  }[];
}

/** Body for `PATCH /co-borrowers/:id`. All fields optional — PATCH semantics, send only what changed. */
export interface UpdateCoBorrowerRequest {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  relationship?: string;
  employer?: string;
  phoneNumber?: string;
  emailAddress?: string;
  addresses?: {
    addressType?: string;
    houseUnitNumber?: string;
    street?: string;
    barangay?: string;
    cityMunicipality?: string;
    province?: string;
    zipCode?: string;
    lengthOfStayMonths?: number;
    ownershipStatus?: string;
  }[];
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

export type RepaymentInstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE';

export interface RepaymentInstallment {
  id: string;
  loanAccountId: string;
  installmentNumber: number;
  dueDate: string;
  due: InstallmentAmounts;
  paid: InstallmentAmounts;
  status: RepaymentInstallmentStatus;
  /**
   * 2026-07-11 (ADR-050 / CALCULATION_ENGINE_SPEC.md §12): live "as of today" penalty — `null` for
   * a migrated loan (its `due.penalty` is the real historical figure instead) or a fully-paid
   * installment. Distinct from `due.penalty`, which stays fixed/immutable.
   */
  currentPenaltyOwed: string | null;
  /** `true` only when `currentPenaltyOwed` reflects the live ADR-050 formula, not a frozen penaltyOverride. */
  isLivePenalty: boolean;
  /** 2026-07-15 (Reduce Penalty feature) — set when Accounting/MIS has reduced this installment's penalty; freezes `currentPenaltyOwed` at `amount`. */
  penaltyOverride: { amount: string; reason: string; byUserId: string; byName: string | null; at: string } | null;
  /** Null until first paid. Compare against `dueDate` to tell a settled (PAID) installment was
   * paid late - `status` alone can't, since it's a live-derived value that resets to PAID once
   * fully settled (see backend `RepaymentInstallment.status`'s own doc comment). */
  lastPaidAt: string | null;
  /** 2026-07-16 (Adjust Fees feature) — the fees override amount if one is set, else `due.fees`. Always non-null, unlike `currentPenaltyOwed` — fees have no "live computation" to fall back to null for. */
  currentFeesDue: string;
  /** 2026-07-16 (Adjust Fees feature) — set when Accounting/MIS has adjusted this installment's fees; may raise or lower, unlike penaltyOverride. */
  feesOverride: { amount: string; reason: string; byUserId: string; byName: string | null; at: string } | null;
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
  /** 2026-07-17 (Reports): Mode of Payment selected on Record Payment (ACTIVE_PAYMENT_METHODS' `code`). */
  paymentMethod: string | null;
  /** 2026-07-11 (Reverse Payment feature): set on a REVERSAL transaction, pointing at the REPAYMENT it corrects — used to tell whether a given transaction has already been reversed (see LoanDetailPage's payments tab). */
  reversesTransactionId: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}


/** ADR-051 — one row per applicable document template, with its latest generation (if any). */
export interface LoanDocumentListItem {
  documentTemplateId: string;
  documentTemplateCode: string;
  documentTemplateName: string;
  isRequired: boolean;
  latestGeneration: {
    id: string;
    generatedByUserId: string;
    generatedByName: string;
    generatedAt: string;
  } | null;
}

/** ADR-052 — one row per generated Statement of Account (append-only history, newest first). */
export interface GeneratedStatementOfAccountListItem {
  id: string;
  loanAccountId: string;
  soaNumber: string;
  penaltyFromDate: string;
  penaltyToDate: string;
  accruedInterestAsOfDate: string;
  totalAmountDue: string;
  generatedByUserId: string;
  generatedByName: string;
  generatedAt: string;
}

/** One installment a payment actually touched — from `payment_allocations`, the same rows Reverse Payment reads. */
export interface PaymentAllocationDetail {
  repaymentInstallmentId: string;
  installmentNumber: number | null;
  installmentDueDate: string | null;
  principalApplied: string;
  interestApplied: string;
  feesApplied: string;
  penaltyApplied: string;
}

export interface ProcessPaymentResponse {
  loanAccount: LoanAccount;
  remainder: string;
  appliedAllocations: PaymentAllocationDetail[];
}

/** 2026-07-16 (unified Payment History timeline) — a penalty reduction or fee adjustment event, merged with LoanTransaction rows for display. No ledger/balance impact of its own. */
export interface InstallmentAdjustment {
  kind: 'PENALTY_REDUCTION' | 'FEE_ADJUSTMENT';
  id: string;
  repaymentInstallmentId: string;
  installmentNumber: number;
  installmentDueDate: string;
  previousAmount: string;
  newAmount: string;
  reason: string;
  byUserId: string;
  byName: string | null;
  at: string;
}
