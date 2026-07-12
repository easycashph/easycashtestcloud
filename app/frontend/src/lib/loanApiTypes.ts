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
  /** CP12 migration follow-up (2026-07-09): true means every `balances` field is 0.00 only because the legacy record had no balance snapshot at all - NOT because the loan is settled. See docs/Architecture/CP12-missing-balance-loans.md. */
  legacyBalanceDataMissing: boolean;
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
  gender?: string;
  birthDate?: string;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
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
}

/** Body for `POST /co-borrowers`. */
export interface CreateCoBorrowerRequest {
  firstName: string;
  lastName: string;
  middleName?: string;
  relationship?: string;
  employer?: string;
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
  /** Null until first paid. Compare against `dueDate` to tell a settled (PAID) installment was
   * paid late - `status` alone can't, since it's a live-derived value that resets to PAID once
   * fully settled (see backend `RepaymentInstallment.status`'s own doc comment). */
  lastPaidAt: string | null;
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
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProcessPaymentResponse {
  loanAccount: LoanAccount;
  remainder: string;
}
