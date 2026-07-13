import type { LoanTransaction } from '../../../domain/LoanTransaction';

/** Milestone 8 / D-5: the only place LoanTransaction becomes JSON-safe — Money/Date formatting never happens in the controller. */
export function presentLoanTransaction(transaction: LoanTransaction) {
  return {
    id: transaction.id,
    loanAccountId: transaction.loanAccountId,
    type: transaction.type,
    amount: transaction.amount.toString(),
    principalComponent: transaction.components.principalComponent.toString(),
    interestComponent: transaction.components.interestComponent.toString(),
    feesComponent: transaction.components.feesComponent.toString(),
    penaltyComponent: transaction.components.penaltyComponent.toString(),
    balanceAfter: transaction.balanceAfter.toString(),
    postedByUserId: transaction.postedByUserId ?? null,
    branchId: transaction.branchId,
    entryDate: transaction.entryDate.toISOString(),
    comment: transaction.comment ?? null,
    orNumber: transaction.orNumber ?? null,
    arNumber: transaction.arNumber ?? null,
    reversesTransactionId: transaction.reversesTransactionId ?? null,
    legacyId: transaction.legacyId ?? null,
    createdAt: transaction.createdAt.toISOString(),
  };
}
