import type { LoanTransactionType } from '../../domain/LoanTransaction';

export interface RecordLoanTransactionInput {
  loanAccountId: string;
  type: LoanTransactionType;
  amount: string;
  principalComponent?: string;
  interestComponent?: string;
  feesComponent?: string;
  penaltyComponent?: string;
  balanceAfter: string;
  postedByUserId?: string;
  branchId: string;
  entryDate: Date;
  comment?: string;
  reversesTransactionId?: string;
  legacyId?: string;
}
