import type {
  AccountsWithPastDueReportRow,
  CollectionHistoryReportRow,
  DailyCollectionReportRow,
  ExpectedCollectionReportRow,
  FirstAmortizationReportRow,
  FullyPaidAccountsReportRow,
  LoanReleaseReportRow,
  PortalAccountReportRow,
  TransactionReportRow,
} from '../../../application/ports/IReportingRepository';

export interface TransactionReportResponse {
  id: string;
  loanAccountId: string;
  loanCode: string;
  borrowerName: string;
  branchId: string;
  branchName: string;
  type: string;
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

export function presentTransactionReportRow(row: TransactionReportRow): TransactionReportResponse {
  return {
    id: row.id,
    loanAccountId: row.loanAccountId,
    loanCode: row.loanCode,
    borrowerName: row.borrowerName,
    branchId: row.branchId,
    branchName: row.branchName,
    type: row.type,
    amount: row.amount,
    components: row.components,
    entryDate: row.entryDate.toISOString(),
    comment: row.comment,
    productId: row.productId,
    totalBalance: row.totalBalance,
    expectedMaturityDate: row.expectedMaturityDate ? row.expectedMaturityDate.toISOString() : null,
    orNumber: row.orNumber,
    arNumber: row.arNumber,
    channel: row.channel,
  };
}

/** 2026-08-17: JSON counterpart to the existing `.xlsx` export (`ExcelJsLoanReleasesReportWriter`)
 * - powers the Loan Releases Report's new on-screen table + column picker (user request). Every
 * field the `.xlsx` writer emits stays here too so the export always has the full column set
 * regardless of which columns are toggled visible on screen. */
export interface LoanReleaseReportResponse {
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
}

export function presentLoanReleaseReportRow(row: LoanReleaseReportRow): LoanReleaseReportResponse {
  return {
    ...row,
    disbursementDate: row.disbursementDate.toISOString(),
    loanCreated: row.loanCreated.toISOString(),
    maturityDate: row.maturityDate ? row.maturityDate.toISOString() : null,
    firstRepaymentDate: row.firstRepaymentDate.toISOString(),
  };
}

/** 2026-08-19 (user request): JSON counterpart of ExpectedCollectionReportRow (the existing `.xlsx`
 * shape), for the report's new on-screen table - mirrors presentLoanReleaseReportRow's own pattern. */
export interface ExpectedCollectionReportResponse {
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

export function presentExpectedCollectionReportRow(row: ExpectedCollectionReportRow): ExpectedCollectionReportResponse {
  return {
    ...row,
    dueDate: row.dueDate.toISOString(),
    maturityDate: row.maturityDate ? row.maturityDate.toISOString() : null,
    lastPaidDate: row.lastPaidDate ? row.lastPaidDate.toISOString() : null,
  };
}

/** 2026-08-20 (user request): JSON counterpart of AccountsWithPastDueReportRow. */
export interface AccountsWithPastDueReportResponse {
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

export function presentAccountsWithPastDueReportRow(row: AccountsWithPastDueReportRow): AccountsWithPastDueReportResponse {
  return {
    ...row,
    dueDate: row.dueDate.toISOString(),
    maturityDate: row.maturityDate ? row.maturityDate.toISOString() : null,
    lastPaidDate: row.lastPaidDate ? row.lastPaidDate.toISOString() : null,
  };
}

/** 2026-08-20 (user request): JSON counterpart of CollectionHistoryReportRow. */
export interface CollectionHistoryReportResponse {
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

export function presentCollectionHistoryReportRow(row: CollectionHistoryReportRow): CollectionHistoryReportResponse {
  return {
    ...row,
    dueDate: row.dueDate.toISOString(),
    maturityDate: row.maturityDate ? row.maturityDate.toISOString() : null,
    lastPaidDate: row.lastPaidDate ? row.lastPaidDate.toISOString() : null,
  };
}

/** 2026-08-20 (user request): JSON counterpart of FirstAmortizationReportRow. */
export interface FirstAmortizationReportResponse {
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

export function presentFirstAmortizationReportRow(row: FirstAmortizationReportRow): FirstAmortizationReportResponse {
  return {
    ...row,
    firstAmortizationDate: row.firstAmortizationDate.toISOString(),
    lastDatePaid: row.lastDatePaid ? row.lastDatePaid.toISOString() : null,
  };
}

/** 2026-08-20 (user request): JSON counterpart of DailyCollectionReportRow. */
export interface DailyCollectionReportResponse {
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

export function presentDailyCollectionReportRow(row: DailyCollectionReportRow): DailyCollectionReportResponse {
  return {
    ...row,
    expectedMaturityDate: row.expectedMaturityDate ? row.expectedMaturityDate.toISOString() : null,
    valueDate: row.valueDate.toISOString(),
  };
}

/** 2026-08-20 (user request): JSON counterpart of FullyPaidAccountsReportRow. */
export interface FullyPaidAccountsReportResponse {
  clientName: string;
  product: string;
  productId: string;
  accountId: string;
  loanAmount: string;
  maturityDate: string | null;
  fullyPaidDate: string | null;
}

export function presentFullyPaidAccountsReportRow(row: FullyPaidAccountsReportRow): FullyPaidAccountsReportResponse {
  return {
    ...row,
    maturityDate: row.maturityDate ? row.maturityDate.toISOString() : null,
    fullyPaidDate: row.fullyPaidDate ? row.fullyPaidDate.toISOString() : null,
  };
}

/** 2026-08-22 (user request): JSON counterpart of PortalAccountReportRow. */
export interface PortalAccountReportResponse {
  name: string;
  email: string;
  contactNumber: string | null;
  status: string;
  linkedTo: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export function presentPortalAccountReportRow(row: PortalAccountReportRow): PortalAccountReportResponse {
  return {
    ...row,
    emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
