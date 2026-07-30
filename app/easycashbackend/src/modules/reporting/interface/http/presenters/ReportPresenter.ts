import type { TransactionReportRow } from '../../../application/ports/IReportingRepository';

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
  };
}
