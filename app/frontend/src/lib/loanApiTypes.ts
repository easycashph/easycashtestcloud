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
  status: LoanAccountStatus;
  principalAmount: string;
  balances: LoanAccountBalances;
  collectionsBalance: string;
  accountingBalance: string;
  interestRate: string;
  installmentCount: number;
  firstRepaymentDate: string;
  approvedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
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

export interface LoanProductVersion {
  id: string;
  loanProductId: string;
  isActive: boolean;
}

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
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
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProcessPaymentResponse {
  loanAccount: LoanAccount;
  remainder: string;
}
