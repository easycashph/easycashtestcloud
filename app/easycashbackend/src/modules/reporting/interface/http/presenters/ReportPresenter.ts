import type { ExpectedCollectionReportRow, LoanReleaseReportRow, TransactionReportRow } from '../../../application/ports/IReportingRepository';

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
